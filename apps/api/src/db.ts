import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

export const db = new Pool({
  connectionString: databaseUrl
});

export async function checkDatabaseConnection(): Promise<void> {
  await db.query("SELECT 1");
}
