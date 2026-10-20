# Deploy FOPlayer API to Render

This deploys the existing NestJS API from `apps/api`. Render runs the API and its monitoring runner in the same Node process. It does not deploy the Flutter app.

## 1. Create the Render service

1. Push/merge the deployment configuration to the repository's default branch.
2. In Render, choose **New → Blueprint** and select the `NipunCapEx/FOPlayer` repository.
3. Render reads the root `render.yaml` and proposes a service named `foplayer-api`.
4. Review the service before applying it. The Blueprint uses Render's **Free** plan to make the first integration test low-cost. Free instances can sleep; they are not suitable for continuous market monitoring. Upgrade to an always-on paid instance before relying on background polling or timely notifications.
5. Apply the Blueprint and wait for the first deploy to finish.

Equivalent manual settings, if you prefer **New → Web Service**:
- Root directory: `apps/api`
- Runtime: Node
- Build command: `npm install --no-audit --no-fund && npm run build`
- Start command: `npm run start:prod`
- Health check path: `/health`

## 2. Configure Firebase credentials securely

In Render → `foplayer-api` → **Environment**, set:

- `FIREBASE_PROJECT_ID`: the project ID of the Firebase project used by this app.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete JSON contents of a dedicated Firebase Admin service-account key for that same project. Paste it as a secret environment value; do not commit it to GitHub, put it in Flutter, or share it in screenshots.
- `FIREBASE_ALLOWED_UIDS`: the Firebase Auth UID(s) authorized for Telegram notifications, comma-separated. Leave empty if not enabling Telegram.

The service account needs the minimum required server-side access to Firebase Authentication token verification and the Firestore database. Keep Firestore client rules restrictive. Do not use a personal Google account key or put private keys in a `GOOGLE_APPLICATION_CREDENTIALS` file committed to the repository.

Optional Telegram alerts:
- `TELEGRAM_BOT_TOKEN`: bot token from BotFather.
- `TELEGRAM_CHAT_ID`: destination chat ID.
- `FIREBASE_ALLOWED_UIDS` must contain exactly one UID for the current Telegram transport configuration to activate.

Save the environment values and trigger a redeploy. If Firebase is not configured, the process may still start, but authenticated API requests and Firestore operations will not work.

## 3. Verify the deployment

Use the exact `onrender.com` URL shown in the Render dashboard:

1. Open `https://YOUR-SERVICE.onrender.com/health`. Expect JSON with `status: "ok"` and `firebaseConfigured: true`.
2. In a terminal, call the protected endpoint without a token:
   ```sh
   curl -i https://YOUR-SERVICE.onrender.com/api/dashboard
   ```
   It should reject the unauthenticated request. A successful health check alone does not verify Firebase or Firestore permissions.
3. Sign in to the Flutter app with a user from the same Firebase project and call the dashboard. Verify the saved watchlist is scoped to that user's UID.
4. Verify the dashboard displays market prices only when a validated backend snapshot exists and is fresh. No snapshot or a stale snapshot must remain marked unavailable/stale.
5. Check Render logs for Firebase credential, Firestore index/permission, or market-data errors. Do not paste service-account JSON or bearer tokens into logs or support messages.

## 4. Connect Flutter to the API

Build Flutter with the HTTPS base URL of the deployed service, without a trailing path:

```sh
flutter build web --release --dart-define=FOPLAYER_API_BASE_URL=https://YOUR-SERVICE.onrender.com
```

For Android, use the same `--dart-define` when building the APK/AAB. The app requires HTTPS and Firebase Authentication must use the same Firebase project as the backend.

## 5. Market-data and production caveats

- The current market-data adapter is a Yahoo Finance prototype. Confirm its availability, data delay, and terms before relying on it or redistributing data.
- The monitoring runner starts only when Firebase Admin is configured. It uses Indian equity market hours and configured holidays/special sessions.
- Render Free instances can sleep and are not a reliable always-on worker. Upgrade the service to an always-on plan before depending on background monitoring, FCM, or Telegram delivery.
- First test with a non-sensitive Firebase account and verify authentication, Firestore reads/writes, stale-data behavior, and notification delivery end to end. The app does not place trades.
