# Heart of House

**Your restaurant. One program.**

Heart of House (HOH) is a restaurant operations platform designed to bring the day-to-day systems of a restaurant into one place instead of scattering them across scheduling apps, recipe binders, spreadsheets, inventory tools, and group chats.

## Project goals

Heart of House is being built as a real-world portfolio project with practical restaurant workflows at the center.

Planned modules include:

- Employee directory and role management
- Scheduling and shift management
- Recipes and standardized prep procedures
- Ingredient and inventory tracking
- Food-cost and recipe-cost calculations
- Menu item management
- Opening/closing and prep checklists
- Manager dashboard and operational notes
- Training/reference material
- Reporting and restaurant-level analytics

## Initial technical direction

- **Frontend:** React + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **API style:** REST, versioned under `/api/v1`
- **Repository structure:** monorepo-style folders for web, API, database, and documentation

The stack can evolve as the project grows. The priority is understandable, maintainable code rather than adding technology just to make the README look expensive.

## Current status

**Phase 1 — Foundation**

The repository currently contains:

- An Express API with a database-aware health endpoint
- Restaurant creation and listing with validation and automated HTTP tests
- PostgreSQL connection pooling
- Repeatable SQL database migrations
- Initial schema for restaurants, employees, roles, ingredients, recipes, and shifts
- Project roadmap and architecture notes
- Environment and Git ignore templates

## Run the API locally

Create `apps/api/.env` from `.env.example` and make sure `DATABASE_URL` points to a PostgreSQL database.

```bash
cd apps/api
npm install
npm run db:migrate
npm run dev
```

Then open:

```
http://localhost:3000/health
```

Expected response when the API and database are healthy:

```json
{
  "status": "ok",
  "service": "heart-of-house-api",
  "database": "connected"
}
```

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
│   └── api/                    # Express/TypeScript backend
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

Restaurant software often solves one narrow problem well and leaves the rest of the operation spread across several systems. Heart of House is an attempt to model the restaurant as one connected operating system, starting with the workflows that actually matter to cooks, managers, and staff.

This project is under active development.

## Restaurant API

- `POST /api/v1/restaurants` creates a restaurant (201).
- `GET /api/v1/restaurants` lists the first 100 restaurants ordered by ID (200).

Example request body:

```json
{ "name": "Sean's Kitchen", "city": "Lynchburg", "timezone": "America/New_York" }
```

Responses wrap results in `restaurant` (create) or `restaurants` (list).
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
