# Heart of House Roadmap

## Phase 1 — Foundation

- [x] Establish project repository
- [x] Define initial architecture
- [x] Add TypeScript/Express API scaffold
- [x] Add API health endpoint
- [x] Draft core PostgreSQL schema
- [x] Add database connection layer
- [x] Add migrations
- [ ] Build first CRUD API for restaurants
  - [x] Create and list restaurants with input validation
  - [ ] Read, update, and delete individual restaurants
- [x] Add automated API tests (HTTP tests with an injected database; live PostgreSQL integration remains pending)

## Phase 2 — Employees and Roles

- [ ] Employee CRUD
- [ ] Role CRUD
- [ ] Assign multiple roles to employees
- [ ] Active/inactive employee status
- [ ] Basic employee detail page
- [ ] Permission model

## Phase 3 — Recipes and Food Cost

- [ ] Ingredient catalog
- [ ] Units of measure
- [ ] Recipe CRUD
- [ ] Recipe ingredient quantities
- [ ] Automatic recipe cost calculation
- [ ] Portion/yield calculation
- [ ] Menu-item linkage

## Phase 4 — Scheduling

- [ ] Shift creation
- [ ] Weekly schedule view
- [ ] Employee availability
- [ ] Role coverage
- [ ] Labor-hour totals
- [ ] Schedule publishing state

## Phase 5 — Inventory and Prep

- [ ] Inventory counts
- [ ] Par levels
- [ ] Prep lists
- [ ] Waste tracking
- [ ] Low-stock indicators
- [ ] Recipe-driven ingredient usage

## Phase 6 — Operations Dashboard

- [ ] Opening/closing checklists
- [ ] Manager notes
- [ ] Daily operational dashboard
- [ ] Alerts and incomplete-task indicators
- [ ] Basic reports

## Phase 7 — Portfolio Polish

- [ ] Authentication and authorization
- [ ] Responsive UI
- [ ] Unit/integration tests
- [ ] Seed/demo restaurant
- [ ] Screenshots/GIFs in README
- [ ] CI checks
- [ ] Deployment
- [ ] Architecture diagram
- [ ] Portfolio case study

## Next build target

**Complete Restaurant CRUD API**

Creation and listing are implemented and covered by automated HTTP tests. Next: individual restaurant lookup and updates, then a deletion policy that protects related employee/recipe data.
