# Review backlog

| Status | Finding | Follow-up |
|---|---|---|
| FIXED | Independent restaurant selectors and empty-kitchen blocker | Shared persistent selection, setup form and opt-in seed in PR #5 |
| FIXED | Stale prep/checklist date records and overlapping task writes | October 14 main fix integrated; PR #5 uses serialized mutations and clears stale records |
| FIXED | Only mocked SQL coverage | PostgreSQL workflow suite passed in CI run 38618686952 |
| FIXED | Browser workflow needs final passing run | CI run 38619253553 passed create/edit/save/reload; broader race/error scenarios still need coverage |
| DEFERRED | No authentication or restaurant authorization | Required before hosted operational data |
| OPEN | Recipe input measurements lost after normalization | Preserve originals before bulk import |
| OPEN | Case-sensitive ingredient duplicates and unknown-price semantics | Normalize safely; no destructive deduplication |
| OPEN | Concurrent migration processes can race | Run one migration process until locking is added |
