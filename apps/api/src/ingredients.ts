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
  router.get<{ restaurantId: string }>("/", async (req, res) => {
    try {
      const restaurant = await database.query("SELECT restaurant_id FROM restaurants WHERE restaurant_id = $1", [req.params.restaurantId]);
      if (!restaurant.rows.length) { res.status(404).json({ error: "Restaurant not found" }); return; }
      const result = await database.query("SELECT * FROM ingredients WHERE restaurant_id = $1 ORDER BY name, ingredient_id", [req.params.restaurantId]);
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
    // Match PostgreSQL NUMERIC precision; reject values that would silently round.
    const decimal = (value: unknown, places: number, max: number, positive: boolean) =>
      typeof value === "number" && Number.isFinite(value) && value < max &&
      (positive ? value > 0 : value >= 0) && /^\d+(?:\.\d+)?$/.test(String(value)) &&
      (String(value).split(".")[1]?.length ?? 0) <= places;
    if (typeof name !== "string" || !name.trim() || [...name.trim()].length > 150 ||
        typeof purchase_unit !== "string" || !purchase_unit.trim() || [...purchase_unit.trim()].length > 50 ||
        !decimal(purchase_quantity, 4, 100000000, true) || !decimal(purchase_price, 2, 10000000000, false)) {
      res.status(400).json({ error: "Name and purchase unit are required; quantity must be positive (up to 4 decimals), price nonnegative (up to 2 decimals), within database limits" }); return;
    }
    try {
      const result = await database.query(
        editing ? "UPDATE ingredients SET name = $2, purchase_unit = $3, purchase_quantity = $4, purchase_price = $5, updated_at = NOW() WHERE restaurant_id = $1 AND ingredient_id = $6 AND (purchase_unit = $3 OR NOT EXISTS (SELECT 1 FROM recipe_ingredients WHERE ingredient_id = $6)) RETURNING *" : "INSERT INTO ingredients (restaurant_id, name, purchase_unit, purchase_quantity, purchase_price) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        editing ? [req.params.restaurantId, name.trim(), purchase_unit.trim(), purchase_quantity, purchase_price, req.params.ingredientId] : [req.params.restaurantId, name.trim(), purchase_unit.trim(), purchase_quantity, purchase_price]
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
