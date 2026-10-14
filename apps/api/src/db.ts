import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

export const db = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
  max: 10
});

db.on("error", () => console.error("An idle PostgreSQL connection failed; the pool will reconnect."));

export async function checkDatabaseConnection(): Promise<void> {
  await db.query("SELECT 1");
}
