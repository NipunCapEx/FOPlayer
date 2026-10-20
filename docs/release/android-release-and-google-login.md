# FOPlayer Android release runbook

## Versioning

The app's semantic base version is maintained in `apps/flutter/pubspec.yaml`. The manually triggered release workflow appends the GitHub Actions run number to the display version and derives a unique Android version code from the run number and attempt. Do not reuse a Play Store version code.

## Required GitHub configuration

Configure these before running **Actions → Android Release → Run workflow**:

Repository variable:
- `ANDROID_APPLICATION_ID`: `com.nipun.finance.fno` (must match Firebase and Google Play Console).

Repository secrets:
- `FIREBASE_GOOGLE_SERVICES_JSON`: complete contents of the new project's Android `google-services.json`, registered for the same package name.
- `ANDROID_KEYSTORE_BASE64`: base64-encoded upload/release keystore. Keep this keystore and its passwords safe; losing it can complicate app updates.
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: service-account JSON with Google Play Console access. Required only when the workflow's `publish` input is enabled.

## Firebase Google login setup

1. Create a Firebase project and register the Android app using application ID `com.nipun.finance.fno`.
2. Enable **Authentication → Sign-in method → Google**.
3. Add the debug and release signing-certificate SHA-1 and SHA-256 fingerprints in Firebase project settings.
4. Download the updated `google-services.json` after OAuth is configured and store its contents in the repository secret above.
5. Configure the Web OAuth client ID needed by Google Sign-In. Never commit service-account credentials or release keystores.
6. Verify sign-in on a physical device before publishing to internal testing.

## Build and publish

1. Run **Actions → Android Release → Run workflow** with `publish=false` first.
2. Download the `foplayer-release-*` artifact and install the APK on a test phone.
3. Verify login, sign-out, app relaunch, and user-scoped data access.
4. After the app is registered in Play Console and internal testing is ready, rerun with `publish=true` to upload the AAB to the **internal** track.
5. Promote from internal testing only after device verification and release approval.

## Important

- Do not publish while Firebase/OAuth setup is incomplete.
- Use `com.nipun.finance.fno` and signing key for all updates to the same Play Store app.
- Market data and alert behavior must be verified separately; a successful app build is not proof that live market data is configured.
