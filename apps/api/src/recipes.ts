import { Router } from 'express';
import { Database } from './restaurants';
import { purchaseQuantity } from './recipeUnits';
const idValid = (id: unknown): id is string => typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
const quantityValid = (n: unknown): n is number => typeof n === 'number' && n > 0 && n < 1e8 && /^\d+(?:\.\d{1,4})?$/.test(String(n));
const label = (s: unknown, max: number): s is string => typeof s === 'string' && !!s.trim() && [...s.trim()].length <= max;
export function recipeRoutes(database: Database) {
  const router = Router({ mergeParams: true });
  router.use((req, res, next) => {
    if (!idValid(req.params.restaurantId)) { res.status(400).json({ error: 'Invalid restaurant ID' }); return; }
    next();
  });
  router.get<{ restaurantId: string; recipeId?: string }>('/:recipeId?', async (req, res) => {
    const { restaurantId, recipeId } = req.params;
    if (recipeId !== undefined && !idValid(recipeId)) { res.status(400).json({ error: 'Invalid recipe ID' }); return; }
    try {
      const restaurant = await database.query('SELECT restaurant_id FROM restaurants WHERE restaurant_id = $1', [restaurantId]);
      if (!restaurant.rows.length) { res.status(404).json({ error: 'Restaurant not found' }); return; }
      if (!recipeId) {
        const result = await database.query('SELECT * FROM recipes WHERE restaurant_id = $1 ORDER BY name, recipe_id', [restaurantId]);
        res.json({ recipes: result.rows }); return;
      }
      const result = await database.query('SELECT * FROM recipes WHERE restaurant_id = $1 AND recipe_id = $2', [restaurantId, recipeId]);
      if (!result.rows.length) { res.status(404).json({ error: 'Recipe not found' }); return; }
      const items = await database.query(`SELECT ri.*, i.name FROM recipe_ingredients ri JOIN ingredients i USING (ingredient_id)
        JOIN recipes r USING (recipe_id) WHERE r.restaurant_id = $1 AND r.recipe_id = $2 ORDER BY i.name`, [restaurantId, recipeId]);
      res.json({ recipe: { ...result.rows[0], ingredients: items.rows } });
    } catch { res.status(503).json({ error: 'Recipe service unavailable' }); }
  });
  router.post<{ restaurantId: string }>('/', async (req, res) => {
    const body = req.body;
    const allowed = ['name', 'instructions', 'yield_quantity', 'yield_unit', 'ingredients'];
    if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k => !allowed.includes(k)) ||
      !label(body.name, 150) || !label(body.instructions, 10000) || !quantityValid(body.yield_quantity) || !label(body.yield_unit, 50) ||
      !Array.isArray(body.ingredients) || !body.ingredients.length || body.ingredients.length > 50 ||
      body.ingredients.some((i: any) => !i || typeof i !== 'object' || Array.isArray(i) || Object.keys(i).some(k => !['ingredient_id','quantity','unit'].includes(k)) || !idValid(i.ingredient_id) || !quantityValid(i.quantity) || !label(i.unit, 50)) ||
      new Set(body.ingredients.map((i: any) => i.ingredient_id)).size !== body.ingredients.length) {
      res.status(400).json({ error: 'Provide a name, instructions, positive yield and 1–50 unique ingredients with positive quantities and units (up to 4 decimals)' }); return;
    }
    try {
      const ids = body.ingredients.map((i: any) => i.ingredient_id);
      const catalog = await database.query('SELECT * FROM ingredients WHERE restaurant_id = $1 AND ingredient_id = ANY($2::bigint[])', [req.params.restaurantId, ids]);
      const items = [];
      for (const item of body.ingredients) {
        const ingredient = catalog.rows.find(i => String(i.ingredient_id) === item.ingredient_id);
        if (!ingredient) { res.status(400).json({ error: 'Every ingredient must belong to this restaurant' }); return; }
        const converted = purchaseQuantity(item.quantity, item.unit, ingredient.purchase_unit);
        const rounded = converted === null ? 0 : Math.round(converted * 10000) / 10000;
        if (!quantityValid(rounded)) { res.status(400).json({ error: `Incompatible units or quantity outside storage precision for ${ingredient.name}; use its purchase unit (${ingredient.purchase_unit})` }); return; }
        items.push({ ingredient_id: item.ingredient_id, quantity: rounded, unit: ingredient.purchase_unit });
      }
      // One PostgreSQL statement: parent and children either all persist or all roll back.
      const result = await database.query(`WITH items AS (
        SELECT * FROM jsonb_to_recordset($6::jsonb) AS x(ingredient_id bigint, quantity numeric, unit text)
      ), valid AS (
        SELECT x.* FROM items x JOIN ingredients i USING (ingredient_id) WHERE i.restaurant_id = $1
      ), saved AS (
        INSERT INTO recipes (restaurant_id, name, instructions, yield_quantity, yield_unit)
        SELECT $1, $2, $3, $4, $5 WHERE (SELECT count(*) FROM valid) = (SELECT count(*) FROM items)
        RETURNING *
      ), lines AS (
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
        SELECT saved.recipe_id, valid.ingredient_id, valid.quantity, valid.unit FROM saved CROSS JOIN valid RETURNING recipe_id
      ) SELECT saved.*, (SELECT count(*) FROM lines) AS ingredient_count FROM saved`,
      [req.params.restaurantId, body.name.trim(), body.instructions.trim(), body.yield_quantity, body.yield_unit.trim(), JSON.stringify(items)]);
      if (!result.rows.length) { res.status(409).json({ error: 'Ingredient catalog changed; reload and try again' }); return; }
      res.status(201).json({ recipe: result.rows[0] });
    } catch (error) {
      const code = (error as { code?: string }).code;
      res.status(code === '23505' ? 409 : code === '23503' ? 404 : 503).json({ error: code === '23505' ? 'A recipe with that name already exists' : code === '23503' ? 'Restaurant or ingredient no longer exists' : 'Recipe service unavailable' });
    }
  });
  return router;
}
