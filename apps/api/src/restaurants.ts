import { Router } from "express";

export interface Database {
  query(sql: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

const limits: Record<string, number> = {
  name: 150, address_line1: 200, address_line2: 200, city: 100,
  state: 50, postal_code: 20, phone: 30, timezone: 80
};

export function restaurantRoutes(database: Database) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const result = await database.query(
        "SELECT * FROM restaurants ORDER BY restaurant_id LIMIT 100"
      );
      res.json({ restaurants: result.rows });
    } catch (error) {
      console.error("Restaurant list failed:", error);
      res.status(503).json({ error: "Restaurant service unavailable" });
    }
  });

  router.post("/", async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({ error: "Body must be a JSON object" });
      return;
    }
    const fields: Record<string, string | null> = {};
    for (const key of Object.keys(body)) {
      if (!Object.hasOwn(limits, key)) {
        res.status(400).json({ error: `Unknown field: ${key}` });
        return;
      }
      const value = body[key];
      if (value === null && key !== "name" && key !== "timezone") {
        fields[key] = null;
      } else if (typeof value === "string" && value.trim().length <= limits[key]) {
        fields[key] = value.trim();
      } else {
        res.status(400).json({ error: `Invalid field: ${key}` });
        return;
      }
    }
    if (!fields.name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    fields.timezone ??= "America/New_York";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: fields.timezone });
    } catch {
      res.status(400).json({ error: "Invalid timezone" });
      return;
    }
    try {
      const keys = Object.keys(fields);
      const placeholders = keys.map((_, index) => `$${index + 1}`);
      const result = await database.query(
        `INSERT INTO restaurants (${keys.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
        keys.map(key => fields[key])
      );
      const restaurant = result.rows[0];
      res.status(201).json({ restaurant });
    } catch (error) {
      console.error("Restaurant creation failed:", error);
      res.status(503).json({ error: "Restaurant service unavailable" });
    }
  });
  return router;
}
