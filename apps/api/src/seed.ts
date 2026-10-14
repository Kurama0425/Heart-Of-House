import "dotenv/config";
import { db } from "./db";
// Explicit opt-in, fictional data. Never replaces existing kitchen records.
async function seed() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7042026)");
    const existing = await client.query("SELECT restaurant_id FROM restaurants ORDER BY restaurant_id LIMIT 1");
    if (existing.rows.length) { console.log("A kitchen already exists; nothing changed."); await client.query("COMMIT"); return; }
    const result = await client.query("INSERT INTO restaurants (name, city) VALUES ('Demo Kitchen', 'Lynchburg') RETURNING restaurant_id");
    await client.query("INSERT INTO ingredients (restaurant_id, name, purchase_unit, purchase_quantity, purchase_price) VALUES ($1, 'Flour', 'lb', 25, 18.50), ($1, 'Butter', 'lb', 1, 4)", [result.rows[0].restaurant_id]);
    await client.query("COMMIT"); console.log("Created fictional Demo Kitchen with Flour and Butter.");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
seed().catch(error => { console.error("Seed failed:", error); process.exitCode = 1; }).finally(() => db.end());
