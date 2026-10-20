# AI Repository Profile — FOPlayer

## Identity
- Product: FOPlayer — F&O Hedging Decision Dashboard
- Repository: NipunCapEx/FOPlayer
- Default branch: `master`
- MVP client: Flutter Android and responsive web
- Backend: NestJS + TypeScript modular monolith
- Auth/data: dedicated Firebase project, Firebase Authentication and Firestore
- Notifications: Telegram Bot API and Android FCM
- Market data: replaceable free-data adapter for prototype use; freshness and licensing limitations must be explicit

## Source of truth
1. `.github/copilot-instructions.md`: mandatory engineering, test and release rules.
2. `docs/architecture/fno-hedging-dashboard.md`: approved architecture, formulas, constraints and acceptance baseline.
3. GitHub issues: scoped business outcomes, priorities, acceptance criteria and dependencies.
4. Code, tests and CI: verified implementation truth.
5. `docs/qa/coverage-inventory.md` and `docs/release/runbook.md`: quality status and release evidence.

Do not copy JCP-specific tenant/business rules into FOPlayer. Reuse JCP's engineering process, not unrelated product architecture.

## Business invariants
- Supported symbols: RELIANCE, JSWSTEEL, BHARTIARTL, SBICARD.
- For entry E: lower boundary = E × 0.88; upper boundary = E × 1.12.
- Movement percent = ((P − E) / E) × 100.
- Absolute movement >= 8% is caution; >= 10% is critical; spot at/beyond either ±12% boundary is breached (highest severity wins).
- Movement from entry is not the same as distance to a boundary.
- Invalid or stale data is unavailable/non-actionable, never silently treated as low risk.
- Initial data polling target is five minutes, subject to provider limits, market hours and observed freshness.
- Alerts are decision support; the app must not place trades or promise profitability.

## Developer operating contract
1. Read Copilot instructions, architecture and issue.
2. Inspect code, test patterns, workflows, current branch and last QA checkpoint.
3. Translate acceptance criteria into observable business-value tests.
4. Implement the smallest coherent capability behind stable interfaces.
5. Test both sides of boundaries, exact transitions, invalid/stale/out-of-order data, failures and safe retry/deduplication.
6. Run format, typecheck, tests/coverage and build where available.
7. Open a PR with evidence; monitor exact-head CI and diagnose real logs.
8. Merge only after required checks pass and repository rules allow it.
9. Verify post-merge CI and deployment smoke tests where applicable.
10. Update issue, architecture/QA/release docs and checkpoint with evidence; proceed to next priority.

## Product-owner / issue contract
- Define outcome, user impact, priority, acceptance criteria, dependencies, non-goals, data-source assumptions and test expectations.
- Search for an existing issue before creating another.
- Keep the plan to three meaningful MVP delivery PRs unless a risk or dependency justifies a split: (1) foundation/risk engine, (2) Flutter dashboard, (3) monitoring/notifications/operations.
- Keep business policy explicit; do not silently change threshold semantics.

## QA contract
- Unit tests cover deterministic risk calculations and validation.
- API/integration tests cover auth, authorization, persistence, data adapter contracts and idempotency.
- Widget tests cover user-visible states and stale-data communication.
- E2E tests cover critical workflows as layers become available.
- Use fake market data and notification adapters in CI; never make live market-data calls a required test dependency.
- Track unimplemented layers as planned, not passed.

## Release / operations
- CI on PR and push to master; manual dispatch for release-only Android validation.
- Fail required checks rather than silently skipping an expected suite once its code exists.
- Use environment secrets; never commit credentials.
- Smoke-test health, auth, freshness, strategy/risk calculations and notification delivery after deployment.
- Document rollback, known provider limitations and last verified commit/run.

## Handoffs
Product owner -> Developer: business outcome, priority, acceptance criteria, dependencies, non-goals and data assumptions.
Developer -> QA/release: implementation summary, tests/coverage, exact CI run, security review, docs changed, known gaps and release/rollback notes.

## Current checkpoint
- Planning docs exist on master.
- PR 1 is the active workstream: repository governance plus deterministic TypeScript risk engine and tests.
- Do not claim production market data, Firebase wiring, Flutter UI or notification delivery exists until implemented and verified.
