# FOPlayer QA Coverage Inventory

Updated: 2026-10-20

Status labels: **Implemented & verified**, **Implemented, verification pending**, **Planned**, **Blocked**. Never mark a capability verified without a test/run result tied to a commit.

| Capability / business risk | Required coverage | Current status | Evidence / next step |
|---|---|---|---|
| Entry-relative ±12% boundaries | Unit tests for upper/lower, exact boundary and adjacent values | In progress in PR 1 | Risk engine tests |
| ±8% caution and ±10% critical severity | Unit tests both directions, threshold precedence | In progress in PR 1 | Risk engine tests |
| Invalid/missing prices and entries | Unit tests reject non-positive/non-finite values | In progress in PR 1 | Risk engine tests |
| Stale/out-of-order snapshots | Unit + adapter integration tests; no actionable fresh alert | Planned | Add freshness policy and tests |
| Four supported symbols | Domain validation tests | Planned | Add strategy model and API |
| Authentication and server-side authorization | API integration tests for unauthenticated/unauthorized requests | Planned | Firebase Auth integration |
| Firestore rules and persistence | Emulator tests; cross-user access denied | Planned | Dedicated Firebase project/config |
| Provider adapter reliability | Contract tests, timeout/error/retry handling | Planned | Add replaceable adapter |
| Five-minute monitoring | Scheduler tests with fake clock; no duplicate runs | Planned | PR 3 |
| Alert deduplication/re-arm | Repeated poll, crossing, recovery and re-cross tests | Planned | PR 3 |
| Telegram notification | Adapter contract tests and failure/retry tests | Planned | PR 3 |
| Android FCM | Adapter contract and delivery status tests | Planned | PR 3 |
| Flutter dashboard states | Widget tests for loading, success, empty, stale and error | Planned | PR 2 |
| Critical user journey | E2E configure strategy -> snapshot -> risk -> alert | Planned | Add when UI/API are connected |
| Android/Web builds | Flutter analyze/test/web build; Android release build | Planned | CI expansion with Flutter app |
| Release smoke / rollback | Health/auth/freshness/alert smoke and rollback procedure | Planned | Release runbook |

## Business-value test principles
- Assert the outcome a user relies on, not private implementation details.
- Test threshold equality and values immediately around the threshold.
- Cover upside and downside symmetrically unless the business rule explicitly differs.
- Use deterministic fake prices, timestamps, clocks and notification providers.
- Test failure, recovery, duplicate delivery and authorization denial.
- Do not use live market data as a required CI dependency.
- Distinguish tests that exist from tests that have actually passed on the current PR head.
