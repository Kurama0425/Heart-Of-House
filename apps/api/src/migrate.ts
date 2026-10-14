import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

const migrationsDirectory = path.resolve(
  process.cwd(),
  "../../database/migrations"
);

async function ensureMigrationsTable(client: import("pg").PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client: import("pg").PoolClient): Promise<Set<string>> {
  const result = await client.query<{ migration_name: string }>(
    "SELECT migration_name FROM schema_migrations"
  );

  return new Set(result.rows.map((row) => row.migration_name));
}

async function runMigrations(): Promise<void> {
  // Hold one dedicated connection for the entire migration sequence.
  // Session-level advisory locks serialize separate deployment processes.
  const lockClient = await db.connect();
  try {
    await lockClient.query("SELECT pg_advisory_lock(72425, 1)");
    await ensureMigrationsTable(lockClient);

    const appliedMigrations = await getAppliedMigrations(lockClient);
    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const migrationName of migrationFiles) {
      if (appliedMigrations.has(migrationName)) {
        console.log(`Skipping ${migrationName} (already applied)`);
        continue;
      }

      const migrationPath = path.join(migrationsDirectory, migrationName);
      const sql = await readFile(migrationPath, "utf8");

      const client = lockClient;

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
          [migrationName]
        );
        await client.query("COMMIT");

        console.log(`Applied ${migrationName}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try {
      await lockClient.query("SELECT pg_advisory_unlock(72425, 1)");
    } finally {
      lockClient.release();
    }
  }
}

runMigrations()
  .then(() => {
    console.log("Database migrations are up to date.");
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
