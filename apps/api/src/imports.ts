import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { Database, TransactionClient } from './restaurants';
import { buildImportPlan, ImportPlan } from './importPlan';
import { nameKey, validId } from './validation';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function snapshot(client: TransactionClient, restaurantId: string, lock = false) {
  const catalog = await client.query(`SELECT * FROM ingredients WHERE restaurant_id = $1 ORDER BY ingredient_id${lock ? ' FOR SHARE' : ''}`, [restaurantId]);
  const recipes = await client.query(`SELECT * FROM recipes WHERE restaurant_id = $1 ORDER BY recipe_id${lock ? ' FOR SHARE' : ''}`, [restaurantId]);
  return { catalog: catalog.rows, recipes: recipes.rows, hash: hash([catalog.rows, recipes.rows]) };
}
function previewResponse(batch: any) {
  return { import_id: batch.import_id, status: batch.status, can_commit: batch.status === 'preview', expires_at: batch.expires_at,
    expired: batch.expired ?? false, preview: batch.status === 'preview' ? batch.plan : undefined, summary: batch.summary ?? undefined };
}
export function importRoutes(database: Database) {
  const router = Router({ mergeParams: true });
  router.use((req, res, next) => {
    if (!validId(req.params.restaurantId)) { res.status(400).json({ error: 'Invalid restaurant ID' }); return; }
    next();
  });
  router.post<{ restaurantId: string }>('/preview', async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['ingredients_csv', 'recipes_csv'].includes(key)) ||
      (body.ingredients_csv !== undefined && typeof body.ingredients_csv !== 'string') || (body.recipes_csv !== undefined && typeof body.recipes_csv !== 'string') ||
      !((body.ingredients_csv ?? '').trim() || (body.recipes_csv ?? '').trim())) {
      res.status(400).json({ error: 'Provide ingredients_csv and/or recipes_csv as nonempty CSV text' }); return;
    }
    let client: TransactionClient | undefined;
    try {
      if (!database.connect) throw new Error('Transaction connection required');
      client = await database.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const restaurant = await client.query('SELECT restaurant_id FROM restaurants WHERE restaurant_id = $1', [req.params.restaurantId]);
      if (!restaurant.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Restaurant not found' }); return; }
      const sourceHash = hash(['csv-v1', body.ingredients_csv ?? '', body.recipes_csv ?? '']);
      const previous = await client.query("SELECT * FROM import_batches WHERE restaurant_id = $1 AND source_hash = $2 AND status = 'committed'", [req.params.restaurantId, sourceHash]);
      if (previous.rows[0]?.status === 'committed') { await client.query('COMMIT'); res.json({ ...previewResponse(previous.rows[0]), already_imported: true }); return; }
      const state = await snapshot(client, req.params.restaurantId);
      const plan = buildImportPlan(body.ingredients_csv ?? '', body.recipes_csv ?? '', state.catalog, state.recipes);
      if (plan.errors.length) { await client.query('ROLLBACK'); res.json({ import_id: null, status: 'invalid', can_commit: false, preview: plan }); return; }
      const result = await client.query(`INSERT INTO import_batches (import_id, restaurant_id, source_hash, snapshot_hash, plan)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING *`,
        [randomUUID(), req.params.restaurantId, sourceHash, state.hash, JSON.stringify(plan)]);
      if (!result.rows.length) { await client.query('ROLLBACK'); res.status(409).json({ error: 'Import changed concurrently; request preview again' }); return; }
      await client.query('COMMIT'); res.json(previewResponse(result.rows[0]));
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      const code = (error as { code?: string }).code;
      res.status(code === '40001' ? 409 : 503).json({ error: code === '40001' ? 'Catalog changed during preview; retry' : 'Import service unavailable' });
    } finally { client?.release(); }
  });
  router.get<{ restaurantId: string; importId: string }>('/:importId', async (req, res) => {
    if (!uuid(req.params.importId)) { res.status(400).json({ error: 'Invalid import ID' }); return; }
    try {
      const result = await database.query('SELECT *, expires_at <= NOW() AS expired FROM import_batches WHERE restaurant_id = $1 AND import_id = $2', [req.params.restaurantId, req.params.importId]);
      if (!result.rows.length) { res.status(404).json({ error: 'Import not found' }); return; }
      if (result.rows[0].status === 'preview') {
        const completed = await database.query("SELECT * FROM import_batches WHERE restaurant_id = $1 AND source_hash = $2 AND status = 'committed'", [req.params.restaurantId, result.rows[0].source_hash]);
        if (completed.rows.length) { res.json({ ...previewResponse(completed.rows[0]), requested_import_id: req.params.importId }); return; }
      }
      res.json({ ...previewResponse(result.rows[0]), can_commit: result.rows[0].status === 'preview' && !result.rows[0].expired });
    } catch { res.status(503).json({ error: 'Import service unavailable' }); }
  });
  router.post<{ restaurantId: string; importId: string }>('/:importId/commit', async (req, res) => {
    if (!uuid(req.params.importId) || !req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 || req.body.confirm !== true) {
      res.status(400).json({ error: 'A valid import ID and explicit {"confirm":true} are required' }); return;
    }
    let client: TransactionClient | undefined;
    try {
      if (!database.connect) throw new Error('Transaction connection required');
      client = await database.connect(); await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('hoh-import:' || $1, 0))", [req.params.restaurantId]);
      const result = await client.query('SELECT *, expires_at <= NOW() AS expired FROM import_batches WHERE restaurant_id = $1 AND import_id = $2 FOR UPDATE', [req.params.restaurantId, req.params.importId]);
      const batch = result.rows[0];
      if (!batch) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Import not found' }); return; }
      if (batch.status === 'committed') { await client.query('COMMIT'); res.json({ import_id: batch.import_id, status: 'committed', already_committed: true, summary: batch.summary }); return; }
      const completedSource = await client.query("SELECT import_id, summary FROM import_batches WHERE restaurant_id = $1 AND source_hash = $2 AND status = 'committed'", [req.params.restaurantId, batch.source_hash]);
      if (completedSource.rows.length) {
        await client.query('COMMIT'); res.json({ import_id: completedSource.rows[0].import_id, requested_import_id: batch.import_id, status: 'committed', already_committed: true, summary: completedSource.rows[0].summary }); return;
      }
      if (batch.expired) { await client.query('ROLLBACK'); res.status(409).json({ error: 'Preview expired; request a fresh preview' }); return; }
      const state = await snapshot(client, req.params.restaurantId, true);
      if (state.hash !== batch.snapshot_hash) { await client.query('ROLLBACK'); res.status(409).json({ error: 'Kitchen data changed since preview; request a fresh preview' }); return; }
      const plan = batch.plan as ImportPlan;
      const ids = new Map(state.catalog.map(item => [nameKey(item.name), String(item.ingredient_id)]));
      const ingredients = [], recipes = [];
      if (plan.ingredients.length) {
        const saved = await client.query(`INSERT INTO ingredients (restaurant_id, name, purchase_unit, purchase_quantity, purchase_price)
          SELECT $1, x.name, x.purchase_unit, x.purchase_quantity, x.purchase_price
          FROM jsonb_to_recordset($2::jsonb) AS x(name text, purchase_unit text, purchase_quantity numeric, purchase_price numeric)
          RETURNING ingredient_id, name`, [req.params.restaurantId, JSON.stringify(plan.ingredients)]);
        for (const item of saved.rows) { ids.set(nameKey(item.name), String(item.ingredient_id)); ingredients.push(item); }
      }
      for (const recipe of plan.recipes) {
        const saved = await client.query('INSERT INTO recipes (restaurant_id, name, instructions, yield_quantity, yield_unit) VALUES ($1,$2,$3,$4,$5) RETURNING recipe_id, name', [req.params.restaurantId, recipe.name, recipe.instructions, recipe.yield_quantity, recipe.yield_unit]);
        await client.query(`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, original_quantity, original_unit)
          SELECT $1, x.ingredient_id, x.quantity, x.unit, x.original_quantity, x.original_unit
          FROM jsonb_to_recordset($2::jsonb) AS x(ingredient_id bigint, quantity numeric, unit text, original_quantity numeric, original_unit text)`,
          [saved.rows[0].recipe_id, JSON.stringify(recipe.ingredients.map(line => ({ ...line, ingredient_id: ids.get(nameKey(line.ingredient_name)) })))]);
        recipes.push(saved.rows[0]);
      }
      const summary = { imported_ingredients: ingredients.length, imported_recipes: recipes.length, skipped_ingredients: plan.skipped_ingredients, ingredients, recipes, warnings: plan.warnings };
      await client.query("UPDATE import_batches SET status = 'committed', summary = $3::jsonb, committed_at = NOW() WHERE restaurant_id = $1 AND import_id = $2", [req.params.restaurantId, batch.import_id, JSON.stringify(summary)]);
      await client.query('COMMIT'); res.status(201).json({ import_id: batch.import_id, status: 'committed', already_committed: false, summary });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      const conflict = ['23505', '23503', '40001', '40P01'].includes((error as { code?: string }).code ?? '');
      res.status(conflict ? 409 : 503).json({ error: conflict ? 'Import conflicted with a kitchen change; nothing was saved. Request a fresh preview' : 'Import unavailable; transaction rolled back. Retry the same import ID' });
    } finally { client?.release(); }
  });
  return router;
}
