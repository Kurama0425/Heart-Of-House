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

Open **Ingredients** in the dashboard. Select a restaurant, enter a name, purchase
unit (such as lb or each), purchased quantity, and total purchase price, then save.
The list reloads from PostgreSQL when the page is reopened. Create a restaurant
first if none exist (POST `/api/v1/restaurants` with `{ "name": "Demo Kitchen" }`).
Run PostgreSQL, configure `apps/api/.env`, run `npm run db:migrate`, and start
both the API and web dev servers using the setup instructions above.

- `GET /api/v1/restaurants/:restaurantId/ingredients` lists that restaurant's ingredients.
- `POST /api/v1/restaurants/:restaurantId/ingredients` creates one.
- Body: `{ "name": "Flour", "purchase_unit": "lb", "purchase_quantity": 25, "purchase_price": 18.50 }`.
- Quantity must be positive with at most four decimal places and below 100,000,000.
- Price must be nonnegative with at most two decimal places and below 10,000,000,000.
- Names and units are trimmed, required, and limited to 150 and 50 characters.
- Returns 400 for invalid input, 404 for a missing restaurant, 409 for a duplicate
  name in that restaurant, and 503 for an unavailable database.

Uses the existing ingredients table; no destructive schema change is required.
Prices are treated as dollars in this first version; unit conversion and recipe
cost calculations are separate next steps. Authentication remains required
before hosting real restaurant data. Tests exercise HTTP with database stubs;
live PostgreSQL integration verification remains pending.
