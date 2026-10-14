# Integration pass — October 14, 2026

## Repository audit

Reviewed application/API modules, schema and all three migrations, existing tests,
roadmap, architecture, recent feature commits and remote branches. No open PRs at
start. The only older feature branch was `fix/restaurant-setup`; its work was
already merged via PR #4. Integration starts from main `84d78d6` and retains all
completed ingredient/recipe/costing/prep/checklist functionality.

## Implemented

- One active kitchen selection, remembered in browser storage; safe fallback when
  the stored kitchen no longer exists. Empty database shows setup rather than four
  disconnected selectors. Connection failures have a retry path.
- Opt-in transaction/advisory-lock-protected demo seed. Existing kitchens are left
  untouched; demo records are fictional.
- Validated restaurant profile PATCH API and kitchen-name editor.
- Ingredient purchase editor and scoped PUT API. Referenced purchase units cannot
  change implicitly; price/quantity edits update current recipe estimates.
- Recipe choices and selected detail costs refresh after catalog writes. Recipe
  saves select/reload the saved record without the old setTimeout workaround.
- Shared request helper, unique navigation targets, dead Staff link removed,
  unsupported blanket development-success panel removed.
- Clear stale prep/checklist records while loading dates. Serialize mutations with
  a synchronous pending guard, disable task/date controls during saves, roll back
  optimistic task changes on errors. Kitchen switches remount tool state.
- GitHub Actions PostgreSQL, migration/seed repetition, tests, builds and Playwright
  browser workflow coverage. Exact local startup and troubleshooting guide.

## Verification

Locally: 36 API tests and 4 frontend calculation tests passed; both builds passed.
CI run 38618686952 passed migration/seed repetition, real PostgreSQL workflows,
unit tests and builds. The first browser run failed on an accessible ingredient
selector; an explicit label was added. Final CI run 38619253553 passed all checks
for implementation commit 94904cddc06e4c71d1d37f9a74fee7a9cb234dcf, including the
real browser kitchen/ingredient/recipe/prep/checklist save, edit and reload workflow. Native database/browser
checks could not be executed locally: user switching is unavailable for the
PostgreSQL service and browser downloads were truncated. CI has a disposable
PostgreSQL service and browser installer; report its actual outcome separately.

## Unfinished

- Authentication/authorization and safe hosted deployment.
- Actual bulk recipe upload/import; original measurements are now preserved.
- Broader migration compatibility verification on a copy of Sean’s actual database.
- Restaurant contact/timezone editor UI (the API accepts validated fields).
- Migration runner concurrency protection (run only one migration process).
- Broader browser race/error-path tests, accessibility audit and portfolio screenshots.

## Work-task handoff

Builder/reviewer schedules were paused during this pass. An already-running task
added main commits 9fb2bbc and 745fce8; these are integrated in PR #5. The PR retains
the shared selection and serialized save guards, which cover the same stale/pending
issues. The seed never overwrites existing records. Resume it with PR #5 as the integration
source of truth; do not rebuild these features or change main in overlapping areas
while the PR is open. The daily builder and review prompts now reference PR #5 and avoid overlapping
main writes. The one-time sprint prompt could not be updated because its scheduled
time was already past; its already-running changes were checked and integrated.
The independent reviewer should review this PR and maintain
these unresolved issues in the review backlog.

## Combined sprint follow-up

Main commit f9731bd landed during final verification. Integrated its import-readiness
migration, original measurement persistence, normalized ingredient uniqueness, nullable
prices, loopback API binding, additional real-database suite and import documentation.
Retained the shared kitchen selection, ingredient editor and browser checks. Local
combined checks: 37 API tests passed, one opt-in database test skipped; both builds
passed. New combined CI verification is pending. Migration 004 intentionally fails
if legacy normalized-name duplicates exist, rather than merging data destructively.
