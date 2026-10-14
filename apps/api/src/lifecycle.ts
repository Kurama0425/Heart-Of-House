import { Router, Request, Response } from 'express';
import { Database, TransactionClient } from './restaurants';
import { validId } from './validation';
/** Archives retain recipe references and history; never delete kitchen rows. */
export function attachLifecycle(router: Router, database: Database, kind: 'ingredient' | 'recipe') {
  const table = kind === 'ingredient' ? 'ingredients' : 'recipes';
  const idColumn = kind === 'ingredient' ? 'ingredient_id' : 'recipe_id';
  const save = async (req: Request, res: Response, active: boolean) => {
    const id = req.params[idColumn === 'ingredient_id' ? 'ingredientId' : 'recipeId'];
    if (!validId(id)) { res.status(400).json({ error: `Invalid ${kind} ID` }); return; }
    let client: TransactionClient | undefined;
    let committed = false;
    try {
      if (database.connect) {
        client = await database.connect(); await client.query("BEGIN");
        await client.query(`SELECT ${idColumn} FROM ${table} WHERE restaurant_id = $1 AND ${idColumn} = $2 FOR UPDATE`, [req.params.restaurantId, id]);
      }
      const connection = client ?? database;
      if (client && kind === 'recipe' && active) {
        await client.query(`SELECT i.ingredient_id FROM ingredients i JOIN recipe_ingredients ri USING (ingredient_id)
          JOIN recipes r USING (recipe_id) WHERE r.restaurant_id = $1 AND r.recipe_id = $2 ORDER BY i.ingredient_id FOR SHARE OF i`, [req.params.restaurantId, id]);
      }
      // Static table/column choices only; values are bound. Active recipes protect ingredients.
      const guard = kind === 'ingredient' && !active ? ` AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri JOIN recipes r USING (recipe_id) WHERE ri.ingredient_id = $2 AND r.is_active)` : kind === 'recipe' && active ? ` AND NOT EXISTS (SELECT 1 FROM recipe_ingredients ri JOIN ingredients i USING (ingredient_id) WHERE ri.recipe_id = $2 AND NOT i.is_active)` : '';
      const result = await connection.query(`UPDATE ${table} SET is_active = $3, updated_at = NOW() WHERE restaurant_id = $1 AND ${idColumn} = $2${guard} RETURNING *`, [req.params.restaurantId, id, active]);
      if (!result.rows.length) {
        const exists = await connection.query(`SELECT ${idColumn} FROM ${table} WHERE restaurant_id = $1 AND ${idColumn} = $2`, [req.params.restaurantId, id]);
        res.status(exists.rows.length ? 409 : 404).json({ error: exists.rows.length ? (kind === 'ingredient' ? 'Ingredient is used by an active recipe; archive that recipe first' : 'Restore archived ingredients before restoring this recipe') : `${kind} not found` }); return;
      }
      if (client) { await client.query("COMMIT"); committed = true; }
      res.json({ [kind]: result.rows[0] });
    } catch { res.status(503).json({ error: `${kind} service unavailable` }); }
    finally { if (client) { if (!committed) await client.query("ROLLBACK").catch(() => {}); client.release(); } }
  };
  const path = kind === 'ingredient' ? '/:ingredientId' : '/:recipeId';
  router.patch(path, (req, res) => {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 || typeof req.body.is_active !== 'boolean') {
      res.status(400).json({ error: 'Provide only boolean is_active' }); return;
    }
    return save(req, res, req.body.is_active);
  });
  router.delete(path, (req, res) => save(req, res, false));
}
