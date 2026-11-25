# Android release checklist

## Before tagging a release

- Run `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, `pnpm smoke`, and the QA tour.
- Verify the Play listing, privacy policy, content rating, and Data safety answers match the build configuration.
- Confirm `docs/store/` contains the feature graphic, icon, phone screenshots, and tablet screenshots.
- Test the signed AAB on a physical low-end Android device and confirm local saves survive an app restart.

## GitHub Actions signing secrets

`.github/workflows/android-apk.yml` reads these repository/environment secrets for signed release output:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded upload/release keystore.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: alias of the signing key inside the keystore.
- `ANDROID_KEY_PASSWORD`: password for that alias.

The workflow decodes the keystore into the ephemeral runner directory and does not commit it. A missing `ANDROID_KEYSTORE_BASE64` intentionally skips the signed APK/AAB steps while still producing the debug APK.

## Bump `ANDROID_VERSION_CODE`

The workflow currently passes `ANDROID_VERSION_CODE: ${{ github.run_number }}` to Gradle for signed builds. This is monotonically increasing per workflow run and satisfies Play's version-code requirement.

For a manually controlled release number, update the `ANDROID_VERSION_CODE` value in `.github/workflows/android-apk.yml` (or replace it with a repository variable), then verify the resulting `versionCode` in the generated AAB. Never reuse a version code already uploaded to Play. Keep the human-facing `versionName` change in the Android/Gradle version configuration alongside the release notes.

## Final submission

- Upload the signed `.aab` to the Play Console internal-testing track first.
- Check the pre-launch report, device catalog, content rating, Data safety form, and privacy-policy URL.
- Promote only after the internal test confirms signing, orientation, audio, saves, and crash opt-in behavior.
