# Backend completion / frontend readiness sprint — October 14, 2026

## Baseline and scope

Started at main d7d96fe after PR #5 and subsequent migration-lock/recipe-validation
fixes. Audited routes, all migrations, existing branches/open PRs, tests and docs.
No open PRs at start. Retained all prior kitchen features and existing records.
Temporary PR #6 (`sprint/backend-ready`) verifies the combined work before publishing
under Sean's explicit instruction to push safe completed work to main.

## Implemented

- CSV catalog/recipe import with strict parsing, bounded inputs, name matching,
  unknown-price warnings, normalized quantities and preserved originals.
- Immutable preview plans, explicit confirmation, stale/expired plan rejection,
  restaurant isolation, durable receipts, duplicate/concurrent confirmation safety,
  import history and all-or-nothing bulk inserts. No overwrite or guessed mapping mode.
- Ingredient detail; ingredient/recipe archive/restore and archived-list browsing.
- Partial restaurant profiles; prep task description edits preserving completion;
  checklist template detail/edit preserving already-started run snapshots.
- Consistent string task IDs/date-only days, shared numeric validation, prototype-safe
  unit lookup and protection against changing ingredient units/activity during writes.
- Database acquisition/statement/idle timeouts, idle-error handling, graceful shutdown,
  configured browser-origin allowlist and separate import/ordinary JSON limits.
- Testable dedicated-connection migration runner retaining the advisory lock.
  Separate Node processes verify waiting, repeatability, legacy preservation and rollback.
- Actual legacy normalized duplicate tests verify migrations refuse unsafe index changes
  without deleting/merging records.
- API_CONTRACT.md, RECIPE_IMPORT.md, FRONTEND_HANDOFF.md and updated setup/architecture/roadmap/backlog.

## Verification so far

Local: 45 API tests passed, 1 opt-in database test skipped; 4 frontend tests and
both production builds passed. Native PostgreSQL/browser cannot run locally in
this execution environment, so runtime database/browser verification uses GitHub CI.

CI run 38630974121 passed initial import/core/migration and browser workflows.
CI run 38631927890 passed immutable preview/duplicate confirmation, stale/expiry,
rollback, blocked concurrent unit editor, template snapshot preservation and
independent-process migration tests, plus all existing tests/builds/browser checks.
Final history/archived-list/legacy-duplicate changes are awaiting their combined CI run.
Never treat this document's earlier passes as proof of an untested later revision.

## Deliberate limits / remaining work

- Frontend upload/preview UI and new archive/template controls remain to be built.
- Public hosting requires authentication/restaurant authorization, tested backups,
  recovery and deployment procedures. Loopback/Origin checks do not provide login security.
- CSV only: no XLSX/OCR/photo/PDF parsing, guessed fractions/density/package sizes,
  overwrite mode or very large streaming/resumable imports beyond documented batch limits.
- No historical price snapshots, import preview/receipt cleanup policy or schema checksum audit.
- Sean's actual local database has not been inspected or migrated here. Legacy name
  duplicates fail safely and require deliberate reconciliation, not a database reset.
- Broader frontend accessibility, failure/race coverage and portable unit aliases can follow.

## Readiness boundary

Once the final combined CI is green, the supported local kitchen workflows and CSV
backend are ready for frontend-focused work. This is a bounded local backend milestone,
not a claim that every future restaurant feature or hosted-production concern is done.
