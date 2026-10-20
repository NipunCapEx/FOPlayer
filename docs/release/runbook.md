# FOPlayer Release and Operations Runbook

## Release principles
- All code changes go through a PR from a dedicated branch; never commit directly to `master`.
- Required CI checks must pass on the exact PR head before merge.
- After merge, verify the default-branch CI run and record the commit and run URL in the QA checkpoint.
- Do not release a market-data or alerting change solely because the build passes; verify data freshness and risk behaviour.
- Do not claim real-time data unless the selected provider's timestamp and service terms substantiate that claim.

## Pre-merge checklist
1. Review business outcome and acceptance criteria.
2. Inspect the complete diff for accidental changes, secrets, debug artefacts and unreviewed dependencies.
3. Run formatting, type checks, tests/coverage and build locally where tooling is available.
4. Confirm tests cover normal, boundary, invalid, stale, dependency-failure and safe-retry behaviour as relevant.
5. Verify PR-head CI, review failed job logs and fix root causes.
6. Confirm architecture, QA inventory, issue and this runbook are consistent.

## Environment and secrets
- Keep development and production Firebase projects separate.
- Configure Firebase project/database identifiers and credentials using environment-specific settings.
- Store Telegram bot token, Firebase service-account credentials and deployment credentials only in approved secret stores.
- Never embed privileged credentials in Flutter web/mobile assets or commit them to source control.
- Apply least privilege and review Firebase rules before enabling production traffic.

## Release validation
When the relevant capabilities exist:
1. Check backend health/readiness and error logs.
2. Sign in and verify server-side authorization.
3. Verify source timestamp, fetch timestamp and freshness state for each supported ticker.
4. Test deterministic risk fixtures around ±8%, ±10% and ±12%; verify severity precedence.
5. Confirm stale/invalid prices do not create actionable fresh-price alerts.
6. Verify Telegram and Android push independently using a controlled test strategy.
7. Verify alert deduplication and recorded delivery failure/retry.
8. Verify Android and responsive web critical journeys.
9. Confirm provider limits, market-data terms and public redistribution permissions.
10. Record commit, CI run, smoke-test results, known limitations and release owner.

## Rollback
- Identify the last known-good deployment and commit before release.
- If risk calculations, freshness indicators, authorization or alert deduplication are wrong, disable alert delivery/monitoring first if safe to do so, then roll back to the last known-good version.
- Do not hide a faulty signal by suppressing tests or changing thresholds without an approved decision.
- Verify health and the affected critical journey after rollback; document impact and root cause.

## Current release state
The MVP is not yet release-ready. Do not deploy for real trading use until the backend, authentication, data quality controls, client, notification adapters, CI tests and operational checks are implemented and verified.
