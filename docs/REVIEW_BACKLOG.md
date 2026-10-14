# Review backlog

| Status | Finding | Follow-up |
|---|---|---|
| FIXED | Independent restaurant selectors and empty-kitchen blocker | Shared persistent selection, setup form and opt-in seed in PR #5 |
| FIXED | Stale prep/checklist date records and overlapping task writes | October 14 main fix integrated; PR #5 uses serialized mutations and clears stale records |
| FIXED | Only mocked SQL coverage | PostgreSQL workflow suite passed in CI run 38618686952 |
| OPEN | Browser workflow needs final passing run | PR #5 adds coverage; accessible ingredient label corrected after initial failure |
| DEFERRED | No authentication or restaurant authorization | Required before hosted operational data |
| OPEN | Recipe input measurements lost after normalization | Preserve originals before bulk import |
| OPEN | Case-sensitive ingredient duplicates and unknown-price semantics | Normalize safely; no destructive deduplication |
| OPEN | Concurrent migration processes can race | Run one migration process until locking is added |
