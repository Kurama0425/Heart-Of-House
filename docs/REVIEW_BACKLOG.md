# Review backlog

| Status | Finding | Follow-up |
|---|---|---|
| FIXED | Independent restaurant selectors and empty-kitchen blocker | Shared persistent selection, setup form and opt-in seed in PR #5 |
| FIXED | Stale prep/checklist date records and overlapping task writes | October 14 main fix integrated; PR #5 uses serialized mutations and clears stale records |
| FIXED | Only mocked SQL coverage | PostgreSQL workflow suite passed in CI run 38618686952 |
| FIXED | Browser workflow needs final passing run | CI run 38619253553 passed create/edit/save/reload; broader race/error scenarios still need coverage |
| DEFERRED | No authentication or restaurant authorization | Required before hosted operational data |
| FIXED | Recipe input measurements lost after normalization | Integrated f9731bd original measurement fields; verified in CI run 38620326532 |
| FIXED | Case-sensitive ingredient duplicates and unknown-price semantics | Integrated nullable prices and normalized uniqueness; legacy duplicates stop migration for manual reconciliation |
| FIXED (pending CI) | Concurrent migration processes can race | Advisory lock now covers migration bookkeeping and execution on one PostgreSQL connection; verify with two concurrent migration runners against a disposable database |
