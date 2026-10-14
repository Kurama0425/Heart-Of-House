# Heart of House

**Your restaurant. One program.** A practical kitchen tool for one independent
local restaurant: ingredients, recipes, food costing, prep and shift checklists.
Scheduling, payroll, messaging, advanced inventory and chain administration are deferred.

## Get running

Use the [exact Windows/local setup guide](docs/LOCAL_SETUP.md) to create your
PostgreSQL database, configure the password, apply migrations and start both apps.
Requirements: Node.js 22.18+, PostgreSQL 16+, Git.

API terminal, from the repository root:

```bash
cd apps/api
npm ci
# Copy .env.example to .env and set DATABASE_URL to your local database.
npm run db:migrate
npm run db:seed
npm run dev
```

The seed is optional. It creates fictional Demo Kitchen with Flour and Butter only
when no kitchen exists. It runs transactionally and never overwrites your records.
Alternatively, create your own kitchen in the dashboard setup form.

Frontend terminal, from the repository root:

```bash
cd apps/web
npm ci
npm run dev
```

Open the Vite URL, normally http://localhost:5173. API health:
http://localhost:3000/health should report `database: connected`. PostgreSQL is a
separate service and must also be running. On Windows, use `npm.cmd` if PowerShell
blocks npm's script launcher. Stop the API/frontend with Ctrl+C in their terminals.

## Backend-ready frontend handoff

Start with [FRONTEND_HANDOFF.md](docs/FRONTEND_HANDOFF.md): practical request/response
examples, the CSV preview/confirm flow and the next five frontend screens.
[API_CONTRACT.md](docs/API_CONTRACT.md) documents every supported endpoint.

## Kitchen workflows

- **Your kitchen:** create, rename and select the kitchen. All tools share the
  selection; the browser remembers it. Switching kitchens resets unsaved forms.
- **Ingredients:** create and edit purchase quantity/price; see cost per purchase
  unit. Blank price means unknown, while 0 means truly free. Referenced purchase
  units cannot change silently; existing recipe measurements remain protected.
- **Recipes:** create, edit, retrieve instructions/yield/ingredient lines; see line,
  batch and portion costs. Compatible weight/US volume units convert for costing,
  while original measurements remain available for display/editing. Catalog writes
  refresh recipe choices and current costs without reloading the page.
- **Prep:** one dated list with persistent completion and task-text editing API.
- **Checklists:** reusable opening/closing templates copied into dated shift runs.
  Completion persists; pending saves disable controls to avoid overlapping writes.
  Template retrieval/editing preserves the snapshots of previous shift runs.

Costs use current prices, exclude labor/waste/overhead and remain unavailable if
any ingredient is unpriced. Portion costs require portion/serving yield units.
Case/whitespace-normalized ingredient names are unique within each kitchen.

## Migrations and updates

After pulling updates, stop the API, run `npm ci` and `npm run db:migrate` in
apps/api, then restart it and the frontend. Migrations 001–006 are tracked and run
transactionally in order. Do not rerun `database/schema.sql`; it is a historical
reference. Migration runners use a PostgreSQL advisory lock to serialize concurrent processes; each migration remains transactional.

Migration 004 preserves original recipe measurements and allows unknown prices.
It backfills legacy measurements from stored purchase-unit amounts; previously
lost original inputs cannot be recovered. Legacy normalized-name duplicates make
migration 004 fail safely rather than merging/deleting referenced ingredients.
See the [import preparation guide](docs/RECIPE_IMPORT.md) before importing real recipes.

## Bulk import backend

CSV ingredient/recipe imports now support immutable preview plans, structured
problems, explicit confirmation, transactional saves, stale/expired plan rejection,
idempotent receipts and import history. No existing purchase or recipe is overwritten.
The upload/preview React UI is the next frontend feature; see the handoff above.

## API

All data routes begin with `/api/v1/restaurants`:

| Route | Methods | Purpose |
|---|---|---|
| `/` | GET, POST | List/create kitchens |
| `/:restaurantId` | GET, PATCH | Retrieve/update profile (update requires name) |
| `/:restaurantId/ingredients` | GET, POST | List/create purchases |
| `/:restaurantId/ingredients/:ingredientId` | GET, PUT, PATCH, DELETE | Retrieve/edit/archive/restore purchase |
| `/:restaurantId/recipes` | GET, POST | List/create recipes |
| `/:restaurantId/recipes/:recipeId` | GET, PUT, PATCH, DELETE | Retrieve/edit/archive/restore recipe |
| `/:restaurantId/prep-lists` | GET, POST | Load/create dated prep |
| `/:restaurantId/prep-lists/tasks/:taskId` | PATCH | Set completion |
| `/:restaurantId/checklists/templates` | GET, POST | Reusable routines |
| `/:restaurantId/checklists/templates/:templateId` | GET, PUT | Retrieve/edit a routine |
| `/:restaurantId/checklists/runs` | GET, POST | Dated shifts |
| `/:restaurantId/checklists/runs/tasks/:taskId` | PATCH | Set completion |

IDs are validated PostgreSQL bigint strings. Writes validate lengths, quantities,
prices, dates and ingredient ownership, and use bound SQL parameters. Recipe and
shift creation are atomic. Invalid input returns 400, missing resources 404,
conflicts 409, and unavailable services 503.

Import routes, response shapes and validation limits are documented in [API_CONTRACT.md](docs/API_CONTRACT.md).

## Verification

In apps/api: `npm test`, `npm run build`. In apps/web: `npm test`, `npm run build`.
The standalone API integration suite uses `TEST_DATABASE_URL` and a unique schema:
`npm run test:integration`. The other opt-in suite uses `RUN_DB_INTEGRATION=1` and
requires `DATABASE_URL` to name a disposable database ending in `_test`.

In apps/web, install Chromium with `npx playwright install chromium`, then run
`npm run test:e2e` against a migrated/seeded disposable database. Browser tests
create fictional records. CI provides PostgreSQL and verifies migration/seed
repetition, both real SQL suites, unit tests, builds and Chromium workflows.
See [the integration status](docs/INTEGRATION_STATUS.md) for actual results and limits.

## Remaining scope

The bulk-import React screen, hosted authentication/authorization,
backup/recovery, broader browser failure/race tests, and contact/timezone editor
fields remain follow-up work. Keep the application local until hosting safeguards
are implemented. Restaurant-scoped SQL is not user authorization.

See [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md), and
[review backlog](docs/REVIEW_BACKLOG.md).
