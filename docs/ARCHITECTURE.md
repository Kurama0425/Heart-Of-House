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

Planned location: `apps/web`

The web application will become the main dashboard for managers and staff.

### API

Location: `apps/api`

The API is written in TypeScript using Express. Endpoints are versioned under `/api/v1`.

Current endpoints include:

- `GET /health` — checks API and database health.
- `POST /api/v1/restaurants` — creates a restaurant.
- `GET /api/v1/restaurants` — lists restaurants.

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
