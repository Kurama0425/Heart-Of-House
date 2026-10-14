import { attachLifecycle } from "./lifecycle";
import { validId, normalizeName, validQuantity, validPrice } from "./validation";
import { Router } from "express";
import { Database } from "./restaurants";

export function ingredientRoutes(database: Database) {
  const router = Router({ mergeParams: true });
  router.use((req, res, next) => {
    const id = req.params.restaurantId;
    if (typeof id !== "string" || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) {
      res.status(400).json({ error: "Invalid restaurant ID" });
      return;
    }
    next();
  });
  attachLifecycle(router, database, "ingredient");
  router.get<{ restaurantId: string; ingredientId: string }>("/:ingredientId", async (req, res) => {
    if (!validId(req.params.ingredientId)) { res.status(400).json({ error: "Invalid ingredient ID" }); return; }
    try {
      const result = await database.query("SELECT * FROM ingredients WHERE restaurant_id = $1 AND ingredient_id = $2", [req.params.restaurantId, req.params.ingredientId]);
      if (!result.rows.length) { res.status(404).json({ error: "Ingredient not found" }); return; }
      res.json({ ingredient: result.rows[0] });
    } catch { res.status(503).json({ error: "Ingredient service unavailable" }); }
  });
  router.get<{ restaurantId: string }>("/", async (req, res) => {
    try {
      const restaurant = await database.query("SELECT restaurant_id FROM restaurants WHERE restaurant_id = $1", [req.params.restaurantId]);
      if (!restaurant.rows.length) { res.status(404).json({ error: "Restaurant not found" }); return; }
      const result = await database.query("SELECT * FROM ingredients WHERE restaurant_id = $1 AND is_active ORDER BY name, ingredient_id", [req.params.restaurantId]);
      res.json({ ingredients: result.rows });
    } catch (error) {
      console.error("Ingredient list failed:", error);
      res.status(503).json({ error: "Ingredient service unavailable" });
    }
  });
  const save = (editing: boolean) => async (req: any, res: any) => {
    if (editing && (!/^[1-9]\d{0,18}$/.test(req.params.ingredientId) || BigInt(req.params.ingredientId) > 9223372036854775807n)) { res.status(400).json({ error: "Invalid ingredient ID" }); return; }
    const body = req.body;
    const allowed = ["name", "purchase_unit", "purchase_quantity", "purchase_price"];
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) {
      res.status(400).json({ error: "Provide only name, purchase_unit, purchase_quantity, and purchase_price" }); return;
    }
    const { name, purchase_unit, purchase_quantity, purchase_price } = body;
    const normalizedName = typeof name === "string" ? normalizeName(name) : "";
    const price = purchase_price == null ? null : purchase_price;
    if (!normalizedName || [...normalizedName].length > 150 ||
        typeof purchase_unit !== "string" || !purchase_unit.trim() || [...purchase_unit.trim()].length > 50 ||
        !validQuantity(purchase_quantity) || (price !== null && !validPrice(price))) {
      res.status(400).json({ error: "Name and purchase unit are required; quantity must be positive (up to 4 decimals), price nonnegative (up to 2 decimals), within database limits" }); return;
    }
    try {
      const result = await database.query(
        editing ? "UPDATE ingredients SET name = $2, purchase_unit = $3, purchase_quantity = $4, purchase_price = $5, updated_at = NOW() WHERE restaurant_id = $1 AND ingredient_id = $6 AND (purchase_unit = $3 OR NOT EXISTS (SELECT 1 FROM recipe_ingredients WHERE ingredient_id = $6)) RETURNING *" : "INSERT INTO ingredients (restaurant_id, name, purchase_unit, purchase_quantity, purchase_price) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        editing ? [req.params.restaurantId, normalizedName, purchase_unit.trim(), purchase_quantity, price, req.params.ingredientId] : [req.params.restaurantId, normalizedName, purchase_unit.trim(), purchase_quantity, price]
      );
      if (!result.rows.length) {
        const exists = await database.query("SELECT ingredient_id FROM ingredients WHERE restaurant_id = $1 AND ingredient_id = $2", [req.params.restaurantId, req.params.ingredientId]);
        res.status(exists.rows.length ? 409 : 404).json({ error: exists.rows.length ? "Purchase unit cannot change while used in a recipe; update price or quantity instead" : "Ingredient not found" }); return;
      }
      res.status(editing ? 200 : 201).json({ ingredient: result.rows[0] });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23503") { res.status(404).json({ error: "Restaurant not found" }); return; }
      if (code === "23505") { res.status(409).json({ error: "An ingredient with that name already exists" }); return; }
      console.error("Ingredient creation failed:", error);
      res.status(503).json({ error: "Ingredient service unavailable" });
    }
  };
  router.post("/", save(false));
  router.put("/:ingredientId", save(true));
  return router;
}
