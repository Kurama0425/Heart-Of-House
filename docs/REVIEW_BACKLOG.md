# Review backlog
| Status | Finding | Follow-up |
|---|---|---|
| FIXED | Independent restaurant selectors and empty-kitchen blocker | Shared persistent selection, setup form and opt-in seed in PR #5 |
| FIXED | Stale prep/checklist date records and overlapping task writes | October 14 main fix integrated; PR #5 uses serialized mutations and clears stale records |
| FIXED | Only mocked SQL coverage | PostgreSQL workflow suite passed in CI run 38618686952 |
| FIXED | Browser workflow needs final passing run | CI run 38619253553 passed create/edit/save/reload |
| FIXED | Recipe detail could mix an old yield with newly edited ingredient costs | PR #7 uses one repeatable-read snapshot; PostgreSQL regression and full CI passed in run 38644973634 |
| DEFERRED | Broader browser failure/race-path coverage | Current stale-data and mutation guards were reviewed; add focused failed-request/date-switch tests while expanding the frontend |
| DEFERRED | No authentication or restaurant authorization | Required before hosted operational data |
| FIXED | Recipe input measurements lost after normalization | Integrated f9731bd original measurement fields; verified in CI run 38620326532 |
| FIXED | Case-sensitive ingredient duplicates and unknown-price semantics | Integrated nullable prices and normalized uniqueness; legacy duplicates stop migration for manual reconciliation |
| FIXED | Concurrent migration processes can race | Dedicated locked connection; separate CLI process, rollback and legacy-data tests verified in sprint CI |
| FIXED | Bulk import was only a document | Preview/confirm API with immutable plans, transactional writes, idempotent receipts and scoped history |
| FIXED | Recipe/purchase unit decisions could race | Ingredient share/update locks and current-unit SQL checks; real blocked-editor regression test |
| FIXED | Payload-limit test used obsolete threshold | Test now exceeds the actual 256 KiB ordinary JSON limit; import limit has its own test |
| FIXED | Template routines could not be edited | Transactional template PUT; past runs remain unchanged |
| OPEN | Frontend exposes only older create/edit controls | Add import, archive and template editing screens using FRONTEND_HANDOFF.md |
| OPEN | Preview/receipt retention has no cleanup policy | Keep local; decide retention before hosted operation |
| DEFERRED | Legacy migrations contain indexes redundant with UNIQUE indexes | Harmless for local use; remove later with a small reviewed migration after checking query plans |

## November 27 stabilization checkpoint

- FIXED in PR #12 (awaiting merge): malformed HTTP-200 JSON responses previously entered success paths; request helper now rejects them. Five frontend tests and full Kitchen checks passed at 7eb4827: https://github.com/Kurama0425/Heart-Of-House/actions/runs/45887885172.
- Verified current open heads: PR #9 5cd6db3, PR #10 1c260e9, PR #11 6f0812b all have passing Kitchen checks. Historical failed browser runs were superseded; no test skips introduced.
- PR #8 is merged. CSV import UI, archive controls and template editing remain unfinished; backend endpoints exist. Keep hosted operational data blocked pending authentication/authorization.
