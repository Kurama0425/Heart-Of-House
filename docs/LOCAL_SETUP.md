# Local setup (Windows / PowerShell)

Requirements: Git, Node.js 22.18 or newer, PostgreSQL 16 or newer (pgAdmin is optional).
Run commands from your cloned Heart-Of-House folder unless a section says otherwise.

## 1. Create the database once

Open pgAdmin, connect to your local PostgreSQL server using the password chosen
at installation. Right-click Databases → Create → Database. Name it
`heart_of_house`, owner `postgres`, and save. Keep the PostgreSQL Windows service
running (Services → postgresql → Start if stopped).

## 2. Configure the API

```powershell
cd apps/api
Copy-Item .env.example .env
```

Edit `.env` in VS Code:

```dotenv
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/heart_of_house
```

Replace YOUR_PASSWORD with your PostgreSQL password. URL-encode special characters
in passwords (for example `@` becomes `%40`). Never commit `.env`.

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Seeding is optional: it adds **Demo Kitchen**, Flour and Butter only when there
are no restaurants. Rerunning it leaves existing data untouched. To use your own
restaurant instead, skip seeding and create it in **Your kitchen** on the dashboard.
No migrations delete existing data. `database/schema.sql` is a historical reference;
do not execute it after migrations.

Open http://localhost:3000/health. Expected: `status: ok`, `database: connected`.
Keep this terminal open.

## 3. Start the frontend in a second terminal

From the repository root:

```powershell
cd apps/web
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173 (or the address Vite prints). Select a kitchen once in
**Your kitchen**; Ingredients, Recipes, Prep and Checklists share that selection.
It is remembered in this browser. Kitchen changes reset unsaved tool forms.
If the API uses another URL, create `apps/web/.env.local` containing
`VITE_API_URL=http://localhost:3000`, adjusting the URL as needed, then restart Vite.

## 4. Updating an existing installation

Stop API and frontend with Ctrl+C in each terminal. From the repository root:

```powershell
git pull
cd apps/api
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run dev
```

Start the frontend in another terminal using section 3. Do not recreate or format
the database. Keep PostgreSQL running; closing VS Code stops neither a Windows
service nor terminals opened elsewhere.

## Troubleshooting

- Kitchen load failure / backend offline: open `/health`; check PostgreSQL service,
  `.env`, password, database name, and API terminal. Run migrations, then click
  **Retry / refresh kitchens**.
- Empty kitchens: use the setup form or run `npm.cmd run db:seed` in apps/api.
- Missing prep/checklist tables: stop the API, run `db:migrate`, restart it.
- Port already in use: stop the old server terminal; do not start duplicate copies.
- Ingredient unit edit rejected: a saved recipe uses this purchase unit. Price and
  quantity remain editable. Unit changes need an explicit recipe migration later.

## Tests and builds

In apps/api: `npm.cmd test` and `npm.cmd run build`.
In apps/web: `npm.cmd test` and `npm.cmd run build`.
For real PostgreSQL integration tests in apps/api:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:YOUR_PASSWORD@localhost:5432/heart_of_house'
npm.cmd run test:integration
```

Integration tests create a uniquely named schema, apply all migrations in it, and
remove only that test schema afterward. The database role needs CREATE SCHEMA.
The CI database is disposable. The test does not touch existing application tables.
Keep the application local until authentication and authorization are implemented.

Migration 004 adds import-ready measurement fields and normalized ingredient-name
uniqueness. If it reports a duplicate key, existing names normalize to the same
value (for example Flour/flour). No automatic merge/deletion happens. Keep the
database intact and reconcile names deliberately before retrying. Blank purchase
prices mean unknown; enter 0 only for a truly free ingredient.

## Backend-ready sprint updates

Run all migrations 001–006 before using CSV import. 005 adds preview plans/receipts;
006 prevents normalized recipe-name duplicates without merging them. A duplicate
error stops safely; use the read-only diagnostic queries in RECIPE_IMPORT.md and
reconcile records deliberately before retrying. Do not reset the database.

The importer endpoints and next frontend steps are in FRONTEND_HANDOFF.md and
API_CONTRACT.md. JSON import requests use CSV file text, not multipart uploads.
No import UI was added during the backend sprint.

Default browser origins: http://localhost:5173 and http://127.0.0.1:5173. If Vite
uses a different port, set WEB_ORIGINS in apps/api/.env to the exact browser URL,
then restart the API. Requests from other browser origins return 403.

Migration locking is built in. Integration tests launch two separate migration
processes, verify lock waiting, repeatability, legacy measurement backfill, and
rollback after a deliberately failed test migration. Test data lives in uniquely
named schemas; tests never reset the configured database. The additional opt-in
RUN_DB_INTEGRATION suite still requires a disposable database ending in _test.
