# F&O Hedging Decision Dashboard — Implementation Plan

**Status:** Implementation in progress — Milestones 1–3 merged; authenticated runtime under review  
**Repository:** `NipunCapEx/FOPlayer`  
**Planning date:** 2026-10-20

## 1. Objective

Build a decision-support dashboard for a monthly F&O short-strangle hedging strategy covering RELIANCE, JSWSTEEL, BHARTIARTL, and SBICARD. The dashboard monitors spot prices against entry-relative risk boundaries and sends alerts. It does not place trades, select trades automatically, or guarantee profitability.


## 1A. Implementation status (2026-10-20)

- **Merged:** TypeScript risk calculations and the Flutter dashboard shell for four symbols. Displayed market prices remain demo fixtures and must not be treated as live.
- **Merged:** validated Yahoo Finance prototype adapter, freshness checks, monitoring orchestration, market-hours polling, threshold escalation, daily-move and historical-volatility signals, Telegram/FCM transport contracts, and retryable alert outbox interfaces.
- **Merged in the API/client:** NestJS runtime, Firebase ID-token verification, owner-scoped Firestore strategy and alert endpoints, authenticated watchlist persistence, and a Flutter alert-history screen with loading, empty, retry, and delivery-status states.
- **Dashboard integration:** the authenticated Flutter client reads owner-scoped strategies and persisted backend snapshots from `/api/dashboard`, displays provider/source timestamps, applies a 10-minute client freshness gate, and renders explicit loading, retry, missing-data and stale-data states. Prototype mode remains visibly demo-only.
- **Still pending:** deploy and verify an always-on worker, configure production HTTPS/Firebase values, and complete real Firebase/FCM smoke tests. Do not represent prices as live unless a fresh validated backend snapshot is present.
- **Market-hours gate:** weekdays 09:15–15:30 Asia/Kolkata; this does not account for exchange holidays or special sessions and must be made configurable before production.
- **Notification retry scope:** successful channels/devices are not resent on retries within the same worker process. The persistent repository must store delivery state and risk-episode state so this guarantee survives restarts.

## 2. Finalized decisions

- **Client:** one Flutter codebase for Android and responsive Flutter Web.
- **Backend:** NestJS + TypeScript. Python is not required for the MVP.
- **Storage/authentication:** dedicated Firebase project with Firestore and Firebase Authentication. Do not reuse JCP production data, credentials, or database.
- **Android push:** Firebase Cloud Messaging (FCM).
- **Messaging:** Telegram Bot API.
- **Market data:** start with a replaceable free-data adapter and accept prototype limitations.
- **Polling:** every 5 minutes during configured monitoring periods, subject to provider limits and actual data freshness.
- **Worker hosting:** use an always-on-capable backend host for dependable monitoring. Free/sleeping hosts are for prototype evaluation, not guaranteed continuous operation.
- **Charts:** Flutter-compatible chart package after reviewing its licence.
- **Infrastructure restraint:** no Python, Redis, PostgreSQL/Prisma, or microservices unless a demonstrated need emerges.
- **Out of scope:** broker connectivity, order placement, automatic strike selection, and guaranteed-profit claims.

## 3. Architecture

```text
Flutter Android / Flutter Web
              |
           HTTPS API
              |
      NestJS modular monolith
      |        |          |
 Market data  Risk     Alert dispatcher
 adapter      engine       |       |
      |        |        Telegram   FCM
      +--------+----------+
               |
       Dedicated Firestore
```

Backend modules should include `market-data`, `strategy`, `risk-engine`, `alerts`, `monitoring`, `health`, and persistence/repository interfaces. Keep risk calculations as pure TypeScript functions wherever practical. The provider adapter should be replaceable without changing risk logic or UI contracts.

## 4. Core calculations

Let `E` be entry price and `P` be the latest validated spot price:

- Lower boundary = `E × 0.88`
- Upper boundary = `E × 1.12`
- Movement % = `((P − E) / E) × 100`
- Lower-boundary distance % = `((P − lower boundary) / P) × 100`
- Upper-boundary distance % = `((upper boundary − P) / P) × 100`

Movement from entry and distance to a boundary are distinct metrics. Alert thresholds are based on movement from entry, not boundary-distance percentages.

### Configurable per-strategy thresholds

Default levels are 8% caution, 10% critical, and 12% breach. Users may configure strictly increasing positive percentages below 100%; the backend validates and persists these settings, and both monitoring and the Flutter dashboard use the saved values. Existing strategies without settings retain the defaults.

### Initial rules

- Absolute movement reaches 8%: caution.
- Absolute movement reaches 10%: critical risk.
- Spot reaches or crosses either ±12% structural boundary: boundary breached.
- Historical one-standard-deviation expected move intersects a structural boundary: high-volatility warning.
- Daily movement exceeds ±2.5%: possible entry-optimization signal, not a recommendation or guarantee.
- Missing, invalid, or stale prices: show unavailable/stale state and do not issue a fresh-price actionable alert.

Volatility implementation must document its observation window, trading-day convention, historical sample sufficiency, and treatment of expiry day. Options-chain implied volatility is deferred until a suitable source is available and its use is permitted.

## 5. Data model

Initial Firestore collections:

- `users`: authenticated profile and roles.
- `strategies`: ticker, entry price/date, expiry, thresholds and active status.
- `marketSnapshots`: ticker, price, source, exchange timestamp, fetch timestamp and validation status.
- `riskStates`: latest calculated movement, distances, volatility status and evaluation timestamp.
- `alerts`: strategy reference, trigger, deduplication key, delivery attempts and channel status.
- `notificationPreferences`: enabled channels and user notification settings.

Prefer bounded snapshot retention and avoid unnecessary high-volume writes. Add indexes only when required by the implemented query patterns.

## 6. External dependencies, cost and licensing

| Dependency | Purpose | Policy |
|---|---|---|
| Firebase Authentication | Login | Restrict account creation; authorize sensitive actions server-side |
| Cloud Firestore | Application state and alert history | Stay within current free quota where possible; monitor usage and costs |
| Firebase Cloud Messaging | Android notifications (web push only if explicitly configured) | No-cost service; verify platform-specific setup |
| Telegram Bot API | Alerts | Free API subject to limits; protect bot token |
| Free unofficial market-data provider (e.g., Yahoo Finance ecosystem) | Prototype prices/history | Best-effort only; do not promise live, complete or supported access |
| NestJS scheduling package | Polling job | Open source; pin and review dependencies |
| Flutter chart library | Charts | Select after licence and maintenance review |
| GitHub Actions | CI | Avoid treating scheduled Actions as an always-on worker |
| Render or equivalent | Prototype hosting | Verify current free-tier sleep, limits and availability before use |

The objective is zero incremental cost for an experimental MVP, not a promise that a reliable production service will cost nothing. Verify current provider quotas and terms before deployment. Never bypass limits, scrape aggressively, or redistribute data without permission. Confirm applicable NSE market-data use and redistribution terms before public release. Do not embed Telegram bot tokens, Firebase service-account credentials, or privileged secrets in the mobile/web client.

Free data may be delayed, stale, incomplete or unavailable, and may not provide suitable intraday candles or option-chain implied volatility. Every displayed price must include source and timestamp/freshness status. Fail closed when data cannot be validated.

## 7. Delivery plan — three implementation PRs

### PR 1 — Foundation, data model and risk engine

- Create domain types and persistence/repository interfaces for strategies, snapshots, risk states, alerts, and notification preferences.
- Implement pure TypeScript boundary and movement calculations.
- Add market-data adapter interface, caching, source timestamps and validation.
- Configure Firebase Authentication and server-side authorization.
- Add deterministic unit tests.

**Acceptance criteria**

- Supports RELIANCE, JSWSTEEL, BHARTIARTL, SBICARD.
- Entry price, entry date, expiry and thresholds are configurable.
- Entry ₹1,000 yields lower ₹880 and upper ₹1,120 boundaries.
- Invalid, non-finite, non-positive prices and missing entry prices are rejected or marked unavailable.
- Provider can be replaced without changing risk-engine logic.
- Unauthenticated/unauthorized callers cannot access protected APIs.
- Backend lint, static checks and tests pass.

### PR 2 — Flutter Android and responsive web dashboard

- Four-asset overview cards and ticker detail screens.
- Display spot price, entry price, movement, boundaries, status and data timestamps.
- Interactive charts, strategy configuration, expiry configuration and alert history.
- Loading, error, empty and stale-data states.

**Acceptance criteria**

- Android and web builds share the Flutter codebase.
- Displayed values match backend calculations.
- UI never presents stale/unavailable data as live.
- Flutter formatting, analysis, unit/widget tests, web production build and Android release build pass.

### PR 3 — Monitoring, notifications and operational readiness

- Five-minute polling, configured market-hours window and stale-data checks.
- Threshold evaluation at ±8%, ±10% and ±12%.
- Telegram and FCM adapters, deduplication, safe retries and delivery history.
- Historical-volatility expected-move warning and ±2.5% daily-movement signal, with assumptions documented.
- Deployment configuration, runbook and smoke tests.

**Acceptance criteria**

- Worker runs when the app is closed, subject to host/provider availability.
- Repeated polling does not generate duplicate logical alerts for the same crossing.
- Telegram and FCM are tested independently.
- Failed deliveries are recorded and retried safely.
- Stale/invalid prices cannot produce fresh-price actionable alerts.
- CI passes; deployment smoke tests check API health, authentication, data freshness and both notification channels.

## 8. Required automated tests

| Case | Expected outcome |
|---|---|
| Entry ₹1,000 | Lower ₹880; upper ₹1,120 |
| Spot ₹1,080 | +8% movement; caution |
| Spot ₹1,100 | +10% movement; critical |
| Spot ₹1,120 | Upper boundary breached |
| Spot ₹880 | Lower boundary breached |
| Spot ₹1,050 | +5%; no threshold alert |
| Spot equals entry | 0% movement |
| Zero, negative, NaN or infinite price | Invalid input rejected |
| Missing entry price | Risk unavailable |
| Stale price snapshot | Stale status; not actionable as live |
| Repeated poll on same trigger | One logical alert (deduplicated) |
| Movement crosses +7.9% to +8.1% | One caution event |
| Insufficient volatility observations | Expected move unavailable, not fabricated |
| Notification send fails | Failure recorded; safe retry policy applied |

Include additional tests for lower-side threshold crossings, crossing recovery/re-arm policy, market close, weekends/holidays as supported by chosen market-calendar design, expiry day, and repeated/late/out-of-order snapshots.

## 9. CI/CD gates

- Backend formatting/lint and unit/API tests.
- Flutter formatting/static analysis, unit and widget tests.
- Flutter Web production build and Android release build.
- Firestore rules and authorization tests.
- Market-data adapter, price-validation and stale-data tests.
- Alert thresholds, deduplication and retry tests.
- Dependency and secret scanning.
- Post-merge default-branch checks and deployment smoke tests.

Do not merge with required checks failing. Do not reduce test strength or bypass checks merely to make CI green. Where supported, avoid expensive Android builds for documentation-only changes without weakening required release validation.

## 10. Security and operational requirements

- Firebase Authentication for Android and web.
- Server-side authorization for strategy mutations.
- Deny unauthorized direct Firestore writes through rules.
- Use a restricted server identity and keep service credentials server-side.
- Keep secrets in deployment environment configuration or an approved secret manager.
- Separate development and production configuration.
- Avoid logging tokens or secrets.
- Surface provider failures, last-success time, stale state and notification delivery failures.
- Configure budget/usage alerts where available.

## 11. Schedule and risks

Planning estimate: 5.5–8 working days for one developer already familiar with Flutter and NestJS, assuming market-data evaluation does not uncover major blockers. This is an estimate, not a delivery guarantee. The largest unknown is whether the free source provides suitable freshness, coverage, reliability and permitted usage.

## 12. Definition of done

- All four tickers work on Android and web.
- Risk calculations and threshold rules are automated-tested.
- Backend polls at the configured five-minute cadence within provider limits.
- Telegram and Android push notifications function.
- Stale data is visibly labelled and cannot produce a misleading fresh-price alert.
- Authorization and secret handling are tested.
- Required CI and post-deployment smoke checks pass.
- Data-source and licensing limitations are documented.
- Alerts remain decision-support signals, not investment advice or guarantees of profitability.

## 13. Tracking issue

Create a GitHub issue titled **“F&O Hedging Decision Dashboard — MVP implementation plan”** with this document's PR breakdown, acceptance criteria, dependencies/licensing, CI gates and definition of done. Link this document in the issue and update both as implementation changes.


## Tracking
Implementation tracking: [Issue #1 — F&O Hedging Decision Dashboard MVP](https://github.com/NipunCapEx/FOPlayer/issues/1)
