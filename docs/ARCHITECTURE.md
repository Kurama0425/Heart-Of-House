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

The API is written in TypeScript using Express. Endpoints will be versioned under `/api/v1`.

The first endpoint is:

- `GET /health` — confirms that the API is running.

### Database

Location: `database/schema.sql`

PostgreSQL is the initial database target. The first schema models:

- restaurants
- employees
- roles
- employee-role assignments
- ingredients
- recipes
- recipe ingredients
- shifts

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

Authentication and authorization will be added before sensitive employee or restaurant data is exposed in a deployed environment.
