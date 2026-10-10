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
- [ ] Recipe editing
- [x] Batch cost, yield, and cost per portion
- [x] Simple recipe and costing screens
- [ ] Daily prep lists with completion status
- [ ] Opening and closing checklists
- [ ] Simple staff directory (names, roles, contact details), after core kitchen tools

Build one small finished increment at a time. Prefer a complete recipe-costing
workflow before starting several unrelated modules.

## Necessary quality and demo work

- [ ] Live PostgreSQL integration tests
- [ ] Small demo restaurant with fictional data
- [ ] Clear setup instructions and reproducible checks
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

**Recipe editing slice:** update an existing recipe and its ingredient quantities atomically, then reload its details and food cost estimate.

Restaurant profile editing remains useful but no longer blocks the kitchen workflow.

Restaurant deletion is not required for the first version; avoid cascading removal
of kitchen data. Keep existing working code and narrow future development instead
of removing useful foundations.

- [x] Dashboard first-run restaurant setup: create a kitchen and unlock Ingredients/Recipes without API commands or refreshing.
