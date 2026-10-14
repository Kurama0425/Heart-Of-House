# Heart of House

**Your restaurant. One program.**

Heart of House (HOH) is a practical kitchen tool for independently owned local restaurants, starting with one restaurant and leaving room for a few locations later.

## Project goals

Build a manageable, useful GitHub portfolio project that a local kitchen can try alongside its existing tools.

The first version focuses on:

- Recipes and standardized prep instructions
- Ingredient purchase prices, batch costs, and cost per portion
- Daily prep and opening/closing checklists
- A simple staff directory after the core kitchen workflows

Scheduling, payroll, messaging, advanced inventory, large reporting dashboards, and chain-management features are deferred. See [the roadmap](docs/ROADMAP.md) for the current scope.

## Technical direction

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **API style:** REST, versioned under `/api/v1`
- **Repository structure:** monorepo-style folders for web, API, database, and documentation

The priority is understandable, maintainable code and practical restaurant workflows.

## Current status

The repository currently contains:

- A responsive Heart of House kitchen dashboard shell
- Live frontend API/database health status
- An Express API with a database-aware health endpoint
- Restaurant creation, listing, and lookup with validation and automated HTTP tests
- PostgreSQL connection pooling
- Repeatable SQL database migrations
- Initial schema for restaurants, employees, roles, ingredients, recipes, and shifts
- Project roadmap and architecture notes

## Start here

Follow [the exact Windows/local setup guide](docs/LOCAL_SETUP.md) for database creation, passwords, migrations, optional demo seeding, both terminals, and troubleshooting.

## Run the API locally

Create `apps/api/.env` from `.env.example` and make sure `DATABASE_URL` points to a PostgreSQL database.

```bash
cd apps/api
npm install
npm run db:migrate
npm run dev
```

The API runs at:

```
http://localhost:3000
```

Its health endpoint is:

```
http://localhost:3000/health
```

## Run the web dashboard

Open another terminal:

```bash
cd apps/web
npm install
npm run dev
```

Vite will print the local dashboard URL, normally:

```
http://localhost:5173
```

By default the dashboard checks the API at `http://localhost:3000`. A different API URL can be supplied with the `VITE_API_URL` environment variable.

## Database migrations

Migration files live in `database/migrations` and run in filename order.

```bash
cd apps/api
npm run db:migrate
```

Heart of House records successfully applied migrations in the `schema_migrations` table, so running the command again skips migrations that have already been applied.

## Repository layout

```
heart-of-house/
├── apps/
│   ├── api/                    # Express/TypeScript backend
│   └── web/                    # React/Vite kitchen dashboard
├── database/
│   ├── migrations/             # Ordered PostgreSQL migrations
│   └── schema.sql              # Original schema reference
├── docs/
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
├── .gitignore
└── README.md
```

## Why this project exists

Heart of House starts with Sean's kitchen experience: keeping recipes, food costs, and prep tasks understandable and usable during a real restaurant shift. The goal is a focused local-kitchen tool with a manageable support burden.

This project is under active development.

## Restaurant API

- `POST /api/v1/restaurants` creates a restaurant (201).
- `GET /api/v1/restaurants` lists the first 100 restaurants ordered by ID (200).
- `GET /api/v1/restaurants/:restaurantId` retrieves a restaurant (200), or returns 404 if absent. IDs must be positive decimal PostgreSQL bigint values without leading zeros; invalid IDs return 400. IDs are represented as strings to preserve precision.

Example request body:

```json
{ "name": "Sean's Kitchen", "city": "Lynchburg", "timezone": "America/New_York" }
```

Responses wrap results in `restaurant` (create/lookup) or `restaurants` (list).
Name is required and trimmed. Optional fields are `address_line1`, `address_line2`,
`city`, `state`, `postal_code`, `phone`, and `timezone`. Timezone defaults to
`America/New_York`; an explicit timezone must be recognized by the Node runtime.
Invalid input returns 400; database failures return 503 without exposing connection details.
These endpoints are for local development until authentication/authorization is added.

```bash
cd apps/api
npm test
npm run build
```

Tests exercise real HTTP requests with an injected database stub, including bound SQL
parameters, validation, list ordering/limit, and database failures. They do not require
PostgreSQL; live database integration tests are still pending.

## Ingredient Catalog

The form previews **cost per purchase unit**, and each saved ingredient displays
the same calculation (purchase price divided by purchased quantity). For example,
25 lb for $18.50 shows $0.74 / lb. Display uses up to four decimal places so small
unit costs remain useful; this is an estimate, not recipe unit conversion.
Run the focused frontend calculation tests with `cd apps/web` then `npm test`
(Node 22.6+ is required for TypeScript test execution).

Open **Ingredients** in the dashboard. Select a restaurant, enter a name, purchase
unit (such as lb or each), purchased quantity, and total purchase price, then save.
The list reloads from PostgreSQL when the page is reopened. If none exist, use
**Set up your kitchen** on the dashboard to create your restaurant. Ingredients
and Recipes unlock immediately after creation, without a page refresh.
If setup cannot connect, it shows a retry button and instructions to start the
API and PostgreSQL; it never silently creates placeholder data. Optional `npm run db:seed` creates a fictional demo kitchen only in an empty database.
Run PostgreSQL, configure `apps/api/.env`, run `npm run db:migrate`, and start
both the API and web dev servers using the setup instructions above.

- `GET /api/v1/restaurants/:restaurantId/ingredients` lists that restaurant's ingredients.
- `POST /api/v1/restaurants/:restaurantId/ingredients` creates one.
- Body: `{ "name": "Flour", "purchase_unit": "lb", "purchase_quantity": 25, "purchase_price": 18.50 }`.
- Quantity must be positive with at most four decimal places and below 100,000,000.
- Price may be null/omitted when unknown; supplied price must be nonnegative with at most two decimal places and below 10,000,000,000.
- Names and units are trimmed, required, and limited to 150 and 50 characters.
- Returns 400 for invalid input, 404 for a missing restaurant, 409 for a duplicate
  name in that restaurant, and 503 for an unavailable database.

Uses the existing ingredients table; no destructive schema change is required.
Prices are treated as dollars in this first version. Authentication remains required
before hosting real restaurant data. Tests exercise HTTP with database stubs;
live PostgreSQL integration verification remains pending.

## Recipe Builder

Open **Recipes**, select the restaurant, and enter a recipe name, instructions,
batch yield and yield unit. Add ingredients from its catalog, set quantities/units,
and save. Select a saved recipe to load its details from PostgreSQL. Catalog changes refresh the recipe ingredient choices and selected recipe costs automatically.

- `POST /api/v1/restaurants/:restaurantId/recipes` creates a recipe and its lines atomically.
- `GET /api/v1/restaurants/:restaurantId/recipes` lists saved recipes.
- `GET /api/v1/restaurants/:restaurantId/recipes/:recipeId` loads details and ingredient lines.
- Body example:

```json
{ "name": "Dough", "instructions": "Mix and knead.", "yield_quantity": 8, "yield_unit": "portion", "ingredients": [{ "ingredient_id": "2", "quantity": 16, "unit": "oz" }] }
```

Use an ingredient ID from your selected restaurant. Names are limited to 150
characters, instructions to 10,000, units to 50. Yield and line quantities must
be positive, below 100,000,000, with at most four decimals. Require 1–50 unique
ingredients. Invalid input or foreign ingredients return 400, missing resources
404, duplicate names/catalog changes 409, unavailable database 503.

Conversions support g/kg/oz/lb and ml/l/tsp/tbsp/cup/pt/qt/gal (US customary
volume). Unknown units such as each or case must match the purchase unit.
No weight-to-volume conversions without density. Lines persist in purchase units,
rounded to four decimals for costing; amounts that round to zero or exceed storage limits
are rejected. Original entered quantities/units are retained after migration 004. No schema migration is
needed beyond the existing initial migration. Saved recipes can be edited from
their detail view.

Validation: 23 API tests plus 4 frontend cost tests and both builds pass.
Recipe HTTP tests use database stubs; live PostgreSQL and browser interactions
have not been verified in this environment. PostgreSQL binaries and a cached
Playwright browser are unavailable. Use fictional local demo data until
authentication and restaurant authorization are implemented.

## Recipe food costing

Select a saved recipe under **Recipes** to see each ingredient line cost, the
batch total, and cost per portion. The existing detail endpoint
`GET /api/v1/restaurants/:restaurantId/recipes/:recipeId` now includes `costing`.
PostgreSQL calculates `quantity * purchase_price / purchase_quantity` using
NUMERIC values and sums before display rounding. No migration is needed.
Costs use current catalog prices, not historical snapshots, and exclude labor,
waste, and overhead. Only portion/portions/serving/servings yields receive a
per-portion estimate; a batch yielding pounds or quarts still has a batch cost.
Incompatible legacy units or invalid purchase quantities make the batch estimate
unavailable rather than reporting a misleading partial total.

Verification: API HTTP tests use injected database stubs; frontend tests cover
currency display. Live PostgreSQL and interactive browser checks require a
running database/browser and are separate from these tests. Keep the app local
with fictional data until authentication and restaurant access controls exist.

## Recipe editing

Select a saved recipe and choose **Edit recipe** to load its name, instructions,
yield, and ingredient lines into the form. `PUT /api/v1/restaurants/:restaurantId/recipes/:recipeId`
validates the same fields and unit conversions as recipe creation, then updates the
recipe and replaces all lines in one PostgreSQL statement. The refreshed detail view
shows costs based on the edited quantities and current catalog prices. A recipe is
always scoped to its restaurant; missing recipes return 404, conflicts return 409,
and invalid input returns 400.

## Daily prep lists

Open **Prep**, choose a restaurant and date, then enter one prep task per line.
Creating the list saves all tasks together. Checkboxes update immediately and each
completion is persisted in PostgreSQL, so the line can refresh or reopen the date
without losing progress.

- `GET /api/v1/restaurants/:restaurantId/prep-lists?date=YYYY-MM-DD` loads one day.
- `POST /api/v1/restaurants/:restaurantId/prep-lists` creates its title and 1–50 tasks.
- `PATCH /api/v1/restaurants/:restaurantId/prep-lists/tasks/:taskId` sets `is_complete`.

Dates must be real calendar dates. Titles are limited to 150 characters and tasks
to 300 characters. Task updates are restaurant-scoped, preventing a task ID from
being changed through another restaurant's URL. Run `npm run db:migrate` in
`apps/api` after pulling to apply `002_prep_lists.sql` before using this screen.
API tests use injected database stubs; live PostgreSQL and browser checks remain
separate. Keep operational data local until authentication and access controls exist.

## Opening and closing checklists

Open **Checklists** to create a reusable opening or closing template from one task
per line. Choose a date, template, and shift label to start a fresh copy; checking
tasks off persists their completion and survives refreshes. A template can be reused
across shifts without changing earlier runs, because each run snapshots its task text.

- `GET/POST /api/v1/restaurants/:restaurantId/checklists/templates` lists or creates templates.
- `GET /api/v1/restaurants/:restaurantId/checklists/runs?date=YYYY-MM-DD` lists that day's runs.
- `POST /api/v1/restaurants/:restaurantId/checklists/runs` starts a run from a template.
- `PATCH /api/v1/restaurants/:restaurantId/checklists/runs/tasks/:taskId` updates completion.

Names are limited to 150 characters, shift labels to 80, and task text to 300.
Templates require an opening/closing type and 1–50 tasks. Duplicate template names
and duplicate template/date/shift runs return 409. Task updates are restaurant-scoped.
After pulling, run `npm run db:migrate` in `apps/api` to apply
`003_checklists.sql`. Tests use database stubs; live PostgreSQL and browser interaction
remain unverified. Authentication is still required before hosting real operational data.

## Integration and verification

The dashboard uses one remembered active kitchen for every tool. The kitchen name
can be edited with `PATCH /api/v1/restaurants/:restaurantId`. Ingredient purchases
can be edited using `PUT /api/v1/restaurants/:restaurantId/ingredients/:ingredientId`
with the same full body as creation. Purchase-unit changes return 409 while an
ingredient is used in any saved recipe, preventing silent quantity reinterpretation.
Price changes refresh current recipe costs. Kitchen changes discard unsaved forms.

`npm run test:integration` in apps/api requires `TEST_DATABASE_URL`; it creates an
isolated test schema and verifies actual PostgreSQL SQL. `npm run test:e2e` in
apps/web uses Playwright and requires a migrated, seeded local database. It creates
fictional browser-test records; use a disposable database for that test. CI provides
PostgreSQL, checks repeat migration/seed runs, runs unit/integration tests and both
builds, then verifies the browser workflows. Older per-feature test counts above
are historical; consult the current CI run and `docs/INTEGRATION_STATUS.md`.

Recipe import preparation from the concurrent sprint is integrated: migration 004 preserves original measurements, allows unknown prices and prevents normalized-name duplicates. See [RECIPE_IMPORT.md](docs/RECIPE_IMPORT.md). Run all migrations before using these fields.
