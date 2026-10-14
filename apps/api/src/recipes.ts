import { attachLifecycle } from "./lifecycle";
import { Router, Request, Response } from 'express';
import { Database, TransactionClient } from './restaurants';
import { purchaseQuantity } from './recipeUnits';
import { validId as idValid, validQuantity as quantityValid, validLabel as label, normalizeName } from './validation';
export function recipeRoutes(database: Database) {
  const router = Router({ mergeParams: true });
  router.use((req, res, next) => {
    if (!idValid(req.params.restaurantId)) { res.status(400).json({ error: 'Invalid restaurant ID' }); return; }
    next();
  });
  attachLifecycle(router, database, 'recipe');
  router.get<{ restaurantId: string; recipeId?: string }>('/:recipeId?', async (req, res) => {
    const { restaurantId, recipeId } = req.params;
    if (recipeId !== undefined && !idValid(recipeId)) { res.status(400).json({ error: 'Invalid recipe ID' }); return; }
    try {
      const restaurant = await database.query('SELECT restaurant_id FROM restaurants WHERE restaurant_id = $1', [restaurantId]);
      if (!restaurant.rows.length) { res.status(404).json({ error: 'Restaurant not found' }); return; }
      if (!recipeId) {
        const result = await database.query('SELECT * FROM recipes WHERE restaurant_id = $1 AND is_active ORDER BY name, recipe_id', [restaurantId]);
        res.json({ recipes: result.rows }); return;
      }
      const result = await database.query('SELECT * FROM recipes WHERE restaurant_id = $1 AND recipe_id = $2', [restaurantId, recipeId]);
      if (!result.rows.length) { res.status(404).json({ error: 'Recipe not found' }); return; }
      // NUMERIC arithmetic stays in PostgreSQL; round only for display in React.
      // An incompatible legacy line makes the whole estimate unavailable.
      const items = await database.query(`WITH costs AS (
        SELECT ri.*, i.name, i.purchase_price, i.purchase_quantity,
          CASE WHEN lower(trim(ri.unit)) = lower(trim(i.purchase_unit)) AND i.purchase_quantity > 0
            AND i.restaurant_id = r.restaurant_id
            THEN ri.quantity * i.purchase_price / i.purchase_quantity END AS line_cost,
          r.yield_quantity, r.yield_unit
        FROM recipe_ingredients ri JOIN ingredients i USING (ingredient_id)
        JOIN recipes r USING (recipe_id) WHERE r.restaurant_id = $1 AND r.recipe_id = $2
      ), totals AS (
        SELECT *, CASE WHEN count(line_cost) OVER () = count(*) OVER ()
          THEN sum(line_cost) OVER () END AS batch_cost FROM costs
      ) SELECT *, CASE WHEN lower(trim(yield_unit)) IN ('portion', 'portions', 'serving', 'servings')
        AND yield_quantity > 0 THEN batch_cost / yield_quantity END AS portion_cost
        FROM totals ORDER BY name`, [restaurantId, recipeId]);
      const first = items.rows[0];
      res.json({ recipe: { ...result.rows[0], ingredients: items.rows,
        costing: { batch_cost: first?.batch_cost ?? null, portion_cost: first?.portion_cost ?? null } } });
    } catch { res.status(503).json({ error: 'Recipe service unavailable' }); }
  });
  async function saveRecipe(req: Request, res: Response, recipeId?: string) {
    const body = req.body;
    const allowed = ['name', 'instructions', 'yield_quantity', 'yield_unit', 'ingredients'];
    if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k => !allowed.includes(k)) ||
      !label(body.name, 150) || !label(body.instructions, 10000) || !quantityValid(body.yield_quantity) || !label(body.yield_unit, 50) ||
      !Array.isArray(body.ingredients) || !body.ingredients.length || body.ingredients.length > 50 ||
      body.ingredients.some((i: any) => !i || typeof i !== 'object' || Array.isArray(i) || Object.keys(i).some(k => !['ingredient_id','quantity','unit'].includes(k)) || !idValid(i.ingredient_id) || !quantityValid(i.quantity) || !label(i.unit, 50)) ||
      new Set(body.ingredients.map((i: any) => i.ingredient_id)).size !== body.ingredients.length) {
      res.status(400).json({ error: 'Provide a name, instructions, positive yield and 1–50 unique ingredients with positive quantities and units (up to 4 decimals)' }); return;
    }
    let client: TransactionClient | undefined;
    let committed = false;
    try {
      if (database.connect) { client = await database.connect(); await client.query("BEGIN"); }
      const connection = client ?? database;
      const ids = body.ingredients.map((i: any) => i.ingredient_id);
      const catalog = await connection.query('SELECT * FROM ingredients WHERE restaurant_id = $1 AND ingredient_id = ANY($2::bigint[]) ORDER BY ingredient_id FOR SHARE', [req.params.restaurantId, ids]);
      const items = [];
      for (const item of body.ingredients) {
        const ingredient = catalog.rows.find(i => String(i.ingredient_id) === item.ingredient_id);
        if (!ingredient) { res.status(400).json({ error: 'Every ingredient must belong to this restaurant' }); return; }
        const converted = purchaseQuantity(item.quantity, item.unit, ingredient.purchase_unit);
        const rounded = converted === null ? 0 : Math.round(converted * 10000) / 10000;
        if (!quantityValid(rounded)) { res.status(400).json({ error: `Incompatible units or quantity outside storage precision for ${ingredient.name}; use its purchase unit (${ingredient.purchase_unit})` }); return; }
        items.push({ ingredient_id: item.ingredient_id, quantity: rounded, unit: ingredient.purchase_unit,
          original_quantity: item.quantity, original_unit: item.unit.trim() });
      }
      // One PostgreSQL statement: the recipe and every line either all persist or all roll back.
      const sql = recipeId ? `WITH target AS (
        SELECT recipe_id FROM recipes WHERE restaurant_id = $1 AND recipe_id = $7
      ), items AS (
        SELECT * FROM jsonb_to_recordset($6::jsonb) AS x(ingredient_id bigint, quantity numeric, unit text, original_quantity numeric, original_unit text)
      ), valid AS (
        SELECT x.* FROM items x JOIN ingredients i USING (ingredient_id) WHERE i.restaurant_id = $1 AND i.is_active AND i.purchase_unit = x.unit
      ), updated AS (
        UPDATE recipes SET name = $2, instructions = $3, yield_quantity = $4,
          yield_unit = $5, updated_at = NOW()
        WHERE recipe_id IN (SELECT recipe_id FROM target)
          AND (SELECT count(*) FROM valid) = (SELECT count(*) FROM items)
        RETURNING *
      ), removed AS (
        DELETE FROM recipe_ingredients ri WHERE ri.recipe_id IN (SELECT recipe_id FROM updated)
          AND NOT EXISTS (SELECT 1 FROM valid WHERE valid.ingredient_id = ri.ingredient_id)
      ), lines AS (
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, original_quantity, original_unit)
        SELECT updated.recipe_id, valid.ingredient_id, valid.quantity, valid.unit, valid.original_quantity, valid.original_unit
        FROM updated CROSS JOIN valid
        ON CONFLICT (recipe_id, ingredient_id) DO UPDATE
          SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit,
              original_quantity = EXCLUDED.original_quantity, original_unit = EXCLUDED.original_unit
        RETURNING recipe_id
      ) SELECT updated.*, (SELECT count(*) FROM lines) AS ingredient_count FROM updated`
      : `WITH items AS (
        SELECT * FROM jsonb_to_recordset($6::jsonb) AS x(ingredient_id bigint, quantity numeric, unit text, original_quantity numeric, original_unit text)
      ), valid AS (
        SELECT x.* FROM items x JOIN ingredients i USING (ingredient_id) WHERE i.restaurant_id = $1 AND i.is_active AND i.purchase_unit = x.unit
      ), saved AS (
        INSERT INTO recipes (restaurant_id, name, instructions, yield_quantity, yield_unit)
        SELECT $1, $2, $3, $4, $5 WHERE (SELECT count(*) FROM valid) = (SELECT count(*) FROM items)
        RETURNING *
      ), lines AS (
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, original_quantity, original_unit)
        SELECT saved.recipe_id, valid.ingredient_id, valid.quantity, valid.unit, valid.original_quantity, valid.original_unit FROM saved CROSS JOIN valid RETURNING recipe_id
      ) SELECT saved.*, (SELECT count(*) FROM lines) AS ingredient_count FROM saved`;
      const values = [req.params.restaurantId, normalizeName(body.name), body.instructions.trim(), body.yield_quantity, body.yield_unit.trim(), JSON.stringify(items)];
      if (recipeId) values.push(recipeId);
      const result = await connection.query(sql, values);
      if (!result.rows.length) {
        if (recipeId) {
          const exists = await connection.query('SELECT recipe_id FROM recipes WHERE restaurant_id = $1 AND recipe_id = $2', [req.params.restaurantId, recipeId]);
          if (!exists.rows.length) { res.status(404).json({ error: 'Recipe not found' }); return; }
        }
        res.status(409).json({ error: 'Ingredient catalog changed; reload and try again' }); return;
      }
      if (client) { await client.query("COMMIT"); committed = true; }
      res.status(recipeId ? 200 : 201).json({ recipe: result.rows[0] });
    } catch (error) {
      const code = (error as { code?: string }).code;
      res.status(code === '23505' ? 409 : code === '23503' ? 404 : 503).json({ error: code === '23505' ? 'A recipe with that name already exists' : code === '23503' ? 'Restaurant or ingredient no longer exists' : 'Recipe service unavailable' });
    } finally {
      if (client) { if (!committed) await client.query("ROLLBACK").catch(() => {}); client.release(); }
    }
  }
  router.post<{ restaurantId: string }>('/', (req, res) => saveRecipe(req, res));
  router.put<{ restaurantId: string; recipeId: string }>('/:recipeId', (req, res) => {
    if (!idValid(req.params.recipeId)) { res.status(400).json({ error: 'Invalid recipe ID' }); return; }
    return saveRecipe(req, res, req.params.recipeId);
  });
  return router;
}
