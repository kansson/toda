# Releases and updates

## Builds

- Builds are made with Gradle, locally or by `.github/workflows/release.yml`; the app uses no Expo
  cloud services and no over-the-air updates.
- Release builds are minified with R8, split into one APK per CPU architecture and signed with
  the owner's upload key: from `~/.gradle/gradle.properties` locally (`TODA_UPLOAD_STORE_FILE`,
  `TODA_UPLOAD_STORE_PASSWORD`, `TODA_UPLOAD_KEY_ALIAS`, `TODA_UPLOAD_KEY_PASSWORD`) or from the
  `release` environment's secrets in GitHub (`TODA_UPLOAD_KEYSTORE`, the keystore in base64, and
  the same three passwords and alias). A production release refuses the debug key.
- The workflow sets the version (`TODA_VERSION_NAME`, `TODA_VERSION_CODE`, the build time in
  minutes since 2026), so every release installs over the ones before.

Create the key once and keep it backed up; without it the installed app cannot be updated:

```sh
keytool -genkeypair -v -storetype PKCS12 -keystore ~/.android/toda-upload.jks \
  -alias toda -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Toda"
base64 -i ~/.android/toda-upload.jks | pbcopy   # the TODA_UPLOAD_KEYSTORE secret
```

## Channels

- A pushed `v` tag makes a stable release; `main` becomes a nightly pre-release once a day when
  the app may have changed (not for documentation, tests, tooling or the backend alone), or at
  once when the workflow is run by hand. The newest ten nightlies are kept.
- Each release holds `toda-<version>-<abi>.apk` files and `update.json`. The production app
  (`app.toda.android`) checks once a day, offers a newer build on its channel (Settings →
  Updates), verifies the download against GitHub's SHA-256 and hands it to Android's installer.

## Backend

Releases carry no server: the app asks for one on first launch, so the backend is not part of a
release. Whoever runs a server deploys `apps/backend` to it by hand with `vp run backend:deploy`,
using the Convex CLI's login; no workflow holds a deploy key. CI runs the backend's tests with the
rest.

## Repository secrets

The release workflow needs the `release` environment (limited to `main` and `v*` tags) and its
secrets; without them the job says what is missing and stops.

| Secret                       | What it is                                         |
| ---------------------------- | -------------------------------------------------- |
| `TODA_UPLOAD_KEYSTORE`       | The upload keystore above, in base64               |
| `TODA_UPLOAD_STORE_PASSWORD` | The keystore's password                            |
| `TODA_UPLOAD_KEY_ALIAS`      | The key's alias (`toda` in the command above)      |
| `TODA_UPLOAD_KEY_PASSWORD`   | The key's password (the store's, for a PKCS12 key) |

```sh
base64 -i ~/.android/toda-upload.jks | gh secret set TODA_UPLOAD_KEYSTORE --env release
gh secret set TODA_UPLOAD_STORE_PASSWORD --env release
gh secret set TODA_UPLOAD_KEY_ALIAS --env release --body toda
gh secret set TODA_UPLOAD_KEY_PASSWORD --env release
```

The repository must be public: the app reads its releases from GitHub's API without a token.
