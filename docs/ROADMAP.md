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

- [ ] Minimal restaurant lookup and profile updates
  - [x] Lookup by ID with validation and automated HTTP tests
  - [ ] Profile updates
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

- [x] Opt-in live PostgreSQL integration test for recipe/costing, prep, and checklists (CI verification pending)
- [ ] Small demo restaurant with fictional data
- [x] Local setup instructions and reproducible CI test/build workflow
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

**Verify stabilization in CI and trial a small fictional recipe import**, then **Restaurant profile editing:** let a kitchen correct its contact details and timezone without database commands.

Restaurant profile editing remains useful but no longer blocks the kitchen workflow.

Restaurant deletion is not required for the first version; avoid cascading removal
of kitchen data. Keep existing working code and narrow future development instead
of removing useful foundations.

- [x] Dashboard first-run restaurant setup: create a kitchen and unlock Ingredients/Recipes without API commands or refreshing.

## October stabilization sprint

- [x] Clear stale prep/checklist data during restaurant/date loads.
- [x] Disable same-task checkbox writes until the prior update completes.
- [x] Add migration 004 to preserve new recipe input units and support unknown prices.
- [x] Add case/whitespace-insensitive ingredient uniqueness (migration may require
  manual reconciliation if legacy duplicates already exist).
- [x] Add PostgreSQL integration test and GitHub Actions workflow (run status must be checked).
- [x] Document a preview-first bulk recipe import format.
- [ ] Implement reviewed CSV import preview and transaction-safe import after a real kitchen sample.
- [ ] Verify interactive browser workflows on Sean's actual local setup.
