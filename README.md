# FOPlayer — F&O Hedging Decision Dashboard

A decision-support dashboard for monitoring entry-relative risk boundaries for four Indian equities: RELIANCE, JSWSTEEL, BHARTIARTL, and SBICARD.

The product provides price monitoring, risk calculations, and Telegram/Android notifications. It does **not** execute trades or guarantee profitability.

## Planned technology

- Flutter for Android and responsive web
- NestJS + TypeScript backend
- Dedicated Firebase project: Authentication, Firestore, and Firebase Cloud Messaging
- Replaceable market-data adapter; begin with free data for a prototype
- Five-minute polling, subject to data-source limits and freshness
- Telegram Bot API and FCM notifications

Python, Redis, PostgreSQL/Prisma, and microservices are not required for the MVP absent a demonstrated need.

## Implementation status

The merged Flutter dashboard currently displays clearly labelled demo fixtures. Monitoring and notification core logic is being added with deterministic tests; Firebase/Firestore persistence, authenticated API wiring and deployment are not yet complete. Do not use demo prices for trading decisions or treat this repository state as a production alerting service.

## Specification

See [F&O Hedging Dashboard implementation plan](docs/architecture/fno-hedging-dashboard.md) for architecture, risk formulas, dependencies and licensing constraints, implementation PRs, acceptance criteria, CI gates, and release checklist.

## Important limitations

Free market-data sources can be unofficial, delayed, rate-limited, incomplete, or unavailable. Prices must show their source and timestamps; stale or missing prices must never be represented as current. Validate applicable data-use and redistribution terms before any public deployment. Alerts are decision support, not investment advice or a guarantee of trade profitability.
