import "dotenv/config";
import { db } from "./db";
import { runMigrations } from "./migrationRunner";
runMigrations(db).then(() => console.log("Database migrations are up to date."))
  .catch(error => { console.error("Migration failed:", error); process.exitCode = 1; })
  .finally(() => db.end());
