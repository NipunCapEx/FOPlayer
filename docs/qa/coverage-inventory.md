# FOPlayer QA Coverage Inventory

Updated: 2026-10-20 (Milestone 3 monitoring core)

Status labels: **Implemented & verified**, **Implemented, verification pending**, **Planned**, **Blocked**. Never mark a capability verified without a test/run result tied to a commit.

| Capability / business risk | Required coverage | Current status | Evidence / next step |
|---|---|---|---|
| Entry-relative ±12% boundaries | Unit tests for upper/lower, exact boundary and adjacent values | Implemented & verified | PR 1 CI passed on `e8eb806093ec1c7757c8e1c5dc805e2616962d09` |
| ±8% caution and ±10% critical severity | Unit tests both directions, threshold precedence | Implemented & verified | PR 1 CI passed on `e8eb806093ec1c7757c8e1c5dc805e2616962d09` |
| Invalid/missing prices and entries | Unit tests reject non-positive/non-finite values | Implemented & verified | PR 1 CI passed on `e8eb806093ec1c7757c8e1c5dc805e2616962d09` |
| Stale/out-of-order snapshots | Reject stale fetch and exchange timestamps, future timestamps, invalid prices; no fresh assessment/alert | Implemented, verification pending | `market-data.test.ts`, `monitoring.test.ts` |
| Strategy expiry configuration | Validate ISO calendar dates, persist expiry dates, and allow authenticated edits from the Flutter watchlist | Implemented, CI verification pending | API service/store tests and Flutter widget coverage; production Firebase smoke still required |
| Firebase ID-token authentication and optional UID allowlist | Guard tests for missing, malformed, expired and disallowed tokens | Implemented, verification pending | `firebase-auth.guard.test.ts` |
| Duplicate active strategy prevention | Store rejects duplicate active owner/symbol entries under concurrent create requests and reactivates inactive history in place | Implemented, CI verification pending | `firestore-store.test.ts`; deterministic owner+symbol document IDs and atomic Firestore create conflict handling |
| Owner-scoped Firestore strategy, snapshot, risk-state and outbox persistence | Fake-store contract tests for ownership, dedupe, retry state and device tokens; direct client access denied by rules | Implemented, verification pending | `firestore-store.test.ts`, `firestore.rules`; Firebase emulator smoke still required |
| Free provider adapter reliability | Yahoo chart adapter contract, ticker mapping, daily-history cache and HTTP error handling | Implemented, verification pending | `market-data.test.ts`; unofficial provider caveats documented |
| Five-minute market-hours polling | Configurable 5-minute worker, overlap guard, weekday 09:15–15:30 IST gate | Implemented, verification pending | `isIndianEquityMarketOpen` tests; holiday calendar not included |
| Alert deduplication/re-arm | Stable idempotency keys, severity escalation, recovery episodes persisted via repository contract, retry pending outbox | Implemented, verification pending | `monitoring.test.ts`; production repository adapter still required |
| Telegram notification | Bot API transport, HTTP/API error handling and outbox retry contract | Implemented, verification pending | `notifications.test.ts`; secrets supplied by server configuration |
| Android FCM | FCM HTTP v1 sender, token-provider contract, per-device retry behavior | Implemented, verification pending | `notifications.test.ts`; credential/token provider and device-token persistence required |
| Flutter dashboard cards, demo warning and stale state | Widget tests for four tickers, thresholds, stale data and entry validation | Implemented, verification pending | PR 2: await exact-head Flutter CI |
| Critical user journey | Configure strategy -> provider snapshot -> risk -> outbox -> notification | Planned | API/runtime and persistence integration still required |
| Responsive Flutter Web build and Android release build | Flutter analyze/test/web build; Android release build | Implemented in CI, verification pending | Dashboard follow-up PR fixes missing web platform scaffolding; Android release is manual |
| Release smoke / rollback | Health/auth/freshness/alert smoke and rollback procedure | Planned | Release runbook |

## Business-value test principles
- Assert the outcome a user relies on, not private implementation details.
- Test threshold equality and values immediately around the threshold.
- Cover upside and downside symmetrically unless the business rule explicitly differs.
- Use deterministic fake prices, timestamps, clocks and notification providers.
- Test failure, recovery, duplicate delivery and authorization denial.
- Do not use live market data as a required CI dependency.
- Distinguish tests that exist from tests that have actually passed on the current PR head.
