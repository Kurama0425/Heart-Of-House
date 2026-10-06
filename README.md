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

- A minimal Express API with a health endpoint
- Initial PostgreSQL schema for restaurants, employees, roles, ingredients, recipes, and shifts
- Project roadmap and architecture notes
- Environment and Git ignore templates

## Run the API locally

```bash
cd apps/api
npm install
npm run dev
```

Then open:

```
http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "heart-of-house-api"
}
```

## Repository layout

```
heart-of-house/
├── apps/
│   └── api/              # Express/TypeScript backend
├── database/
│   └── schema.sql        # Initial PostgreSQL schema
├── docs/
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
├── .gitignore
└── README.md
```

## Why this project exists

Restaurant software often solves one narrow problem well and leaves the rest of the operation spread across several systems. Heart of House is an attempt to model the restaurant as one connected operating system, starting with the workflows that actually matter to cooks, managers, and staff.

This project is under active development.
