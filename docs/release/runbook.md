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
- Configure `FOPLAYER_MARKET_HOLIDAYS` on the backend as a comma-separated list of ISO dates (`YYYY-MM-DD`) from the current official exchange holiday calendar. If any configured date is malformed, monitoring fails closed until the value is corrected.
- Configure `FOPLAYER_MARKET_SPECIAL_SESSIONS` as a JSON object keyed by ISO date, with each value containing `open` and `close` in 24-hour `HH:MM` IST time (for example, `{"2026-10-24":{"open":"18:00","close":"19:00"}}`). This supports official special sessions such as Muhurat trading. Invalid JSON, dates, or times fail closed; keep this list current from official exchange notices.
- Never embed privileged credentials in Flutter web/mobile assets or commit them to source control.
- Apply least privilege and review Firebase rules before enabling production traffic.

## Android Google Sign-In SHA fingerprint diagnostics

The manual **Android Release** workflow prints the configured upload certificate's SHA-1/SHA-256 fingerprints and the signed APK's SHA-1/SHA-256 fingerprints in the **Report signing certificate fingerprints for Google Sign-In diagnostics** step. It fails if the APK signer does not match the configured upload certificate. The logs contain public certificate fingerprints only; never print or upload the keystore, private key, passwords, or base64 keystore secret.

For Firebase Google Sign-In, use the fingerprints for the certificate that actually signs the installed app:

1. Run **Actions → Android Release** to inspect the upload-certificate fingerprints. These are useful for locally installed APKs signed with the configured upload key.
2. If the app is distributed through Google Play with Play App Signing enabled, open **Play Console → Test and release / Setup → App integrity** and copy the **App signing key certificate** SHA-1 and SHA-256 fingerprints. Do not assume these match the upload key.
3. In the Firebase project used by FnO Player, open **Project settings → Your apps → Android app** and add the required SHA-1 and SHA-256 fingerprints. Include the upload certificate only when that signing certificate is used for the install path being tested; include the Play app-signing certificate for Play Store installs.
4. Download the updated `google-services.json` after Firebase has updated its OAuth configuration, then replace the GitHub Actions secret `FIREBASE_GOOGLE_SERVICES_JSON` with the full JSON content. Do not commit it to the repository.
5. Rebuild and test Google Sign-In from both the direct APK path and the Play-distributed path. If the issue persists, verify the Firebase project, Android package ID, enabled Google provider, and OAuth web client before changing unrelated code.

The CI cannot derive the Play app-signing certificate fingerprint from the upload keystore. That fingerprint must come from Play Console (or a trusted copy of its certificate). Do not register a fingerprint from another app unless you have verified that the same certificate signs FnO Player.

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
