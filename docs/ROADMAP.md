# Heart of House Roadmap

## Product focus

A practical kitchen tool for one independent local restaurant. Design it so a small
collection of locations could be supported later, without building chain-management
infrastructure now. The first goal is a useful portfolio demo that a local kitchen
could try alongside its existing tools.

## Completed foundation

- [x] Repository, architecture, and TypeScript/Express API
- [x] Database-aware health endpoint and PostgreSQL connection pool
- [x] Initial schema and repeatable migrations
- [x] Restaurant creation, listing, and lookup with validation
- [x] Automated HTTP tests with an injected database
- [x] React/Vite kitchen dashboard shell
- [x] Responsive navigation and live API/database status

The existing broader schema is retained as groundwork; it does not make every
table a current product commitment.

## First usable version — Recipes, costing, and prep

- [x] Minimal restaurant lookup and profile updates
  - [x] Lookup by ID with validation and automated HTTP tests
  - [x] Validated profile update API; kitchen name editor
- [x] Ingredient catalog: React form/list, restaurant-scoped create/list API, PostgreSQL persistence and input validation
- [x] Compatible recipe unit conversions (weight and US volume; normalized to purchase units)
- [x] Ingredient cost per purchase unit: live form preview and catalog column
- [x] Recipe creation, instructions, yield, ingredient quantities, saved list/detail
- [x] Recipe editing: load a saved recipe, replace its details/ingredients atomically, and refresh food costs
- [x] Batch cost, yield, and cost per portion
- [x] Simple recipe and costing screens
- [x] Daily prep lists: dated free-form tasks with persistent completion status
- [x] Opening and closing checklists: reusable templates and fresh dated shift runs with persistent completion
- [ ] Simple staff directory (names, roles, contact details), after core kitchen tools

Build one small finished increment at a time. Prefer a complete recipe-costing
workflow before starting several unrelated modules.

## Necessary quality and demo work

- [x] PostgreSQL workflow tests and CI (execution status in INTEGRATION_STATUS.md)
- [x] Opt-in fictional demo kitchen/ingredients seed; skips existing kitchens
- [x] Exact local setup, migrations, startup, troubleshooting and CI checks
- [x] Basic responsive interface
- [ ] Authentication and restaurant access controls before real operational/contact data is hosted
- [ ] Simple deployment, backup, and recovery instructions before a real pilot
- [ ] Screenshots and a short portfolio case study

## Deferred — Reconsider only after kitchen feedback

- Scheduling, availability, and labor management
- Payroll, payments, and messaging
- Advanced inventory, purchasing, and waste analytics
- Large reporting dashboards and integrations
- Enterprise administration and chain-wide management

## Next build target

**Frontend CSV upload/preview/confirm:** use the implemented bulk import backend and FRONTEND_HANDOFF.md. Then improve recipe browsing/editing, ingredient pricing, prep, and checklist routines.

Restaurant profile editing remains useful but no longer blocks the kitchen workflow.

Restaurant deletion is not required for the first version; avoid cascading removal
of kitchen data. Keep existing working code and narrow future development instead
of removing useful foundations.

- [x] Dashboard first-run restaurant setup: create a kitchen and unlock Ingredients/Recipes without API commands or refreshing.

- [x] Import preparation: original measurements, normalized ingredient-name uniqueness, optional unknown prices (migration 004). CSV preview/confirm backend is implemented; upload UI remains pending.

## Backend-ready checkpoint

- [x] Immutable ingredient/recipe CSV preview and explicit transactional confirmation
- [x] Durable idempotent receipts, source conflicts, stale/expired plans and import history
- [x] Ingredient/recipe lookup, archive/restore, and archived record browsing
- [x] Partial kitchen profiles, prep task wording edits, checklist template editing
- [x] Original measurements, unknown prices, normalized names and conversion guards
- [x] Real PostgreSQL concurrency/rollback/import/core tests and separate-process migration checks
- [x] Stable local API contract and chef-friendly frontend handoff
- [ ] Frontend import wizard, archive controls, template editor and pricing improvements

Completion verification for the sprint is tracked in BACKEND_SPRINT_STATUS.md;
unchecked hosting/security work remains a separate scope, not a claim of production readiness.
