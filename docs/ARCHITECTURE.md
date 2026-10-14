# Heart of House Architecture

## Design principles

1. **Restaurant-first:** features should solve an actual restaurant workflow.
2. **Simple before clever:** prefer understandable code and data models.
3. **One source of truth:** employees, recipes, ingredients, shifts, and operational data should connect through the same system.
4. **Modular growth:** each feature should be useful on its own but designed to fit the larger platform.
5. **Portfolio quality:** code should be documented, testable, and organized enough to discuss in an interview.

## Initial architecture

```
React web client
      |
      | HTTPS / JSON
      v
Express REST API
      |
      v
PostgreSQL
```

### Web application

Location: `apps/web`

The web application will become the main dashboard for managers and staff.

### API

Location: `apps/api`

The API is written in TypeScript using Express. Endpoints are versioned under `/api/v1`.

Current endpoints include:

- `GET /health` — checks API and database health.
- `POST /api/v1/restaurants` — creates a restaurant.
- `GET /api/v1/restaurants` — lists restaurants.
- `GET /api/v1/restaurants/:restaurantId` — retrieves one restaurant by its validated ID.

Restaurant request data is validated before SQL is built, and database values are passed through parameterized PostgreSQL queries.

### Database

Locations:

- `database/migrations/` — ordered SQL migrations used to build and evolve the database.
- `database/schema.sql` — original schema reference.

PostgreSQL is the initial database target. The current schema models:

- restaurants
- employees
- roles
- employee-role assignments
- ingredients
- recipes
- recipe ingredients
- shifts

Applied migrations are recorded in the `schema_migrations` table so each migration runs only once.

This gives later modules a shared foundation instead of inventing disconnected data structures feature by feature.

## Near-term API modules

```
/api/v1/restaurants
/api/v1/employees
/api/v1/roles
/api/v1/ingredients
/api/v1/recipes
/api/v1/shifts
```

Near-term development is intentionally focused on practical kitchen and restaurant-management workflows rather than attempting to build every enterprise restaurant feature at once.

Authentication and authorization will be added before sensitive employee or restaurant data is exposed in a deployed environment.

Ingredient routes are nested under `/api/v1/restaurants/:restaurantId/ingredients`.
The React catalog submits JSON to POST and loads saved records via GET. Values
use parameterized queries against the existing ingredients table; duplicate
names are enforced per restaurant by its existing unique constraint.

### Recipe workflow

The React Recipe Builder uses restaurant-scoped create/list/detail routes.
The API checks ingredient ownership and unit compatibility, normalizes quantities
to purchase units, and inserts the recipe and ingredient lines in a single
PostgreSQL data-modifying CTE. This avoids partial recipes without requiring
transaction state on the injected query interface. Migration 004 adds original
quantity/unit fields so saved recipes remain editable in kitchen units.
Recipe routes remain local-demo only until authentication/authorization.

## Current kitchen modules

All data APIs are scoped by restaurant ID (not yet authorized to a logged-in
user). Current routes include restaurant create/list/detail, ingredient
create/list, recipe create/list/detail/edit, dated prep lists and task completion,
and reusable opening/closing checklist templates/runs/task completion.

Recipe lines store both `quantity/unit` in the ingredient's purchase units
(for PostgreSQL NUMERIC costing) and `original_quantity/original_unit` as
entered by the cook. Missing ingredient purchase prices are SQL NULL;
intentional zero prices remain zero. The recipe detail query refuses to report
a partial batch cost if any ingredient cannot be priced.

Migration 004 enforces normalized ingredient names per restaurant through
a unique functional index. It never automatically merges pre-existing
duplicates. Migrations run transactionally and must be applied before
starting the updated API.

## Verification

Stubbed HTTP tests cover validation and route behavior. The opt-in PostgreSQL
integration test runs against a disposable database ending in `_test` and
checks real recipe SQL, food costs, prep persistence, and checklist persistence.
GitHub Actions provisions PostgreSQL, runs migrations, tests both apps,
and builds both apps on pushes and pull requests. Interactive browser
verification is still separate.

## Security boundary

The development API listens on loopback by default. CORS remains open and
there is no authentication/authorization yet, so restaurant IDs are not
an access-control boundary. Do not expose this app publicly or store sensitive
operational/employee data until access controls, backups, and recovery exist.
