# FOPlayer Firebase Runtime

This milestone adds the NestJS API and Firebase Admin persistence layer. It does not configure a Firebase project or deploy the service automatically.

## Required server configuration

- `FIREBASE_PROJECT_ID`: the dedicated FOPlayer Firebase project ID.
- One server credential source:
  - Preferred on supported cloud hosts: workload identity / Application Default Credentials.
  - Local or compatible secret-manager deployment: `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account file outside the repository.
  - Alternative for secret managers: `FIREBASE_SERVICE_ACCOUNT_JSON` containing the service-account JSON. Never commit this value.
- `PORT`: optional HTTP port, defaults to `3000`.
- `FIREBASE_ALLOWED_UIDS`: optional comma-separated Firebase UID allowlist. When a global Telegram chat is configured, exactly one UID must be allowlisted to avoid sending multiple users' alerts into a shared personal chat.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`: optional server-side Telegram delivery configuration.

Do not put service-account JSON, Telegram bot tokens, FCM access tokens, or device tokens in Flutter source, Git, CI logs, or public build variables. Grant the service account only the Firebase/Firestore permissions required for this app.

## Authentication and data isolation

1. Create or enable the sign-in provider in Firebase Authentication for the dedicated project.
2. Users must sign in through Firebase Authentication and send the resulting ID token as `Authorization: Bearer <id-token>`.
3. The API verifies the token with Firebase Admin before serving `/api/*` routes.
4. Strategy reads and updates are filtered by the verified UID. Device-token registration verifies ownership of the selected strategy.
5. Deploy `firestore.rules`. It denies direct client reads/writes; the API accesses Firestore through the Admin SDK and enforces ownership itself.

## API contract

- `GET /health`: non-sensitive liveness/configuration flags.
- `GET /api/dashboard`: caller-owned strategies, latest snapshots and recent alerts.
- `GET /api/strategies`: caller-owned strategies.
- `POST /api/strategies`: JSON body `{"symbol":"RELIANCE","entryPrice":1000}`.
- `PATCH /api/strategies/:id`: JSON body containing `entryPrice`, `active`, or both.
- `GET /api/alerts`: caller-owned alert history.
- `POST /api/device-tokens`: JSON body `{"strategyId":"...","token":"..." }`; the strategy must belong to the caller.

Only the four supported symbols are accepted. Entry prices must be positive finite numbers. The API never executes trades.

## Firestore collections

- `strategies`: owner UID, symbol, entry price, active flag and timestamps.
- `strategySnapshots`: latest risk assessment and source/fetch/exchange timestamps per strategy.
- `riskEpisodeStates`: persisted episode number and highest severity for restart-safe risk deduplication.
- `alerts`: deterministic hashed document ID, owner UID, status, attempt/error metadata and alert payload.
- `deviceTokens`: owner UID, strategy ID, FCM token and active flag.
- `marketDataHealth`: latest unavailable-data reason per symbol.

The API uses deterministic alert document IDs and Firestore create semantics to reduce duplicate outbox records. Channel-level successful-delivery caching is currently process-local; a process restart can still resend a previously successful channel if another channel had failed. Persistent per-channel delivery receipts are a remaining hardening item.

## Runtime and operations

The monitor starts only when Firebase Admin is configured. It polls at five-minute intervals during weekdays 09:15–15:30 Asia/Kolkata. The gate does not include NSE holiday or special-session calendars. Use an always-on host or a separately managed scheduled worker; sleeping/free web instances are not suitable for reliable alert delivery.

The initial Yahoo Finance chart adapter is unofficial and may be delayed, rate-limited or unavailable. The API rejects stale snapshots; it does not promise exchange-grade real-time quotes. Verify applicable data-use terms before public deployment.

## Deployment smoke checklist

- [ ] Health endpoint responds without exposing configuration secrets.
- [ ] Unauthenticated `/api/strategies` request returns 401; Firebase unavailable returns 503 rather than bypassing authentication.
- [ ] User A cannot list, update, read alerts for, or register a device against User B's strategy.
- [ ] Invalid symbol and zero/negative/non-finite entry prices are rejected.
- [ ] Snapshot source and both timestamps are persisted and stale data is not assessed.
- [ ] A failed alert remains pending with failure metadata and is retried by the next poll.
- [ ] Telegram/FCM credentials are supplied only through server-side secret configuration.
- [ ] Verify a real FCM device registration and a test notification before enabling production alerts.
