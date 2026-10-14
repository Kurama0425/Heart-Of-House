# Independent review backlog

Last updated: 2026-10-14. Only close findings after verified tests or code review.

| Status | Priority | Finding / next action |
| --- | --- | --- |
| FIXED (code) | Medium | Prep/Checklist stale date/restaurant data; clear old results while loading and suppress stale run rendering. |
| FIXED (code) | Medium | Rapid same-task toggles could race; disable checkbox and navigation while that task update is pending. |
| FIXED (code) | Medium | Original recipe input units lost; migration 004 stores original quantity/unit for new saves, backfills legacy purchase units. |
| FIXED (code) | Medium | Missing price looked free; nullable purchase prices now represent unknown; existing zero prices are unchanged. |
| FIXED (code) | Medium | Case/whitespace ingredient duplicates; normalized unique index plus trimmed/collapsed names. Existing conflicts must be reconciled before migration can apply. |
| OPEN | High | Confirm GitHub Actions tests/builds and PostgreSQL integration suite pass; inspect failures and fix before relying on migrations. |
| OPEN | Medium | Run migration 004 against a backup/throwaway copy of Sean's actual existing database and resolve any legacy normalized-name collisions without deleting references. |
| OPEN | Medium | No browser automation verifying create/edit/refresh/retry flows. |
| OPEN | Medium | No authentication or restaurant authorization. Keep app on localhost with fictional data only. |
| OPEN | Medium | Recipe updates do not protect against two editors overwriting each other; add optimistic concurrency before multi-user deployment. |
| DEFERRED | Low | Add a preview-first, transaction-safe bulk recipe importer once a representative source spreadsheet is available. |

The daily reviewer should mention carried-forward items only when they affect the next step, not re-announce them as new findings.
