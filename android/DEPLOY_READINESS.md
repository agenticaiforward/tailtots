# Android Deploy Readiness — TailTots (`com.tailtots.family`)

Date: 2026-09-27. Branch: `moonshot`. Canonical project: `~/workspace/tailtots-supabase-work/android/`
(the Capacitor shell inside the web repo; `npm run android:sync` / `android:build:release` target it).
`~/workspace/tailtots-builds/android/` is a legacy Sept-24 standalone snapshot — **not** canonical, do not build from it.

## Verdict: STAGED but not yet built — one environment permission blocks the Gradle build

Everything that can be staged without running Gradle is done. The release AAB itself
could **not** be produced in this session: the sandbox denies raw TCP for this assistant
(`other_tcp: Deny`), and the Gradle daemon protocol requires TCP loopback. The build is
not broken — the code/config is ready; the runner is blocked. See "Blocker" below.

## What's ready

- **App identity**: `applicationId com.tailtots.family`, app name "TailTots",
  `versionCode 1`, `versionName "1.0"` (`android/app/build.gradle`).
- **SDK levels**: minSdk 24, target/compileSdk 36 (Play-ready for new apps).
- **Toolchain installed (persistent)**: JDK 17.0.20.1 at `~/workspace/tools/jdk-17.0.20.1+1`,
  Android SDK at `~/Android/Sdk` (cmdline-tools, platform-tools, `platforms/android-36`,
  `build-tools/36.0.0`), Gradle 8.14.3 at `~/workspace/tools/gradle-8.14.3`,
  `android/local.properties` points at the SDK (gitignored).
- **Dependency cache warm**: `~/.gradle/caches` already holds AGP 8.13.0 + all androidx deps.
- **Web bundle syncs cleanly**: `npm run android:sync` succeeds — `vite.mobile.config.ts`
  builds `dist/mobile` and `cap sync` copies it into `android/app/src/main/assets/public/`
  (includes the new demo pet portraits under `demo-faces/`).
- **Release signing is pre-wired, no new keystore needed**: an upload keystore already exists
  at `~/workspace/secrets/tailtots-upload.keystore` (RSA 2048, alias `tailtots-upload`,
  25-year validity, created 2026-09-27; see `~/workspace/secrets/README.md`). AGP picks it up
  automatically via `android.injected.signing.*` in `~/.gradle/gradle.properties`.
  As a fallback, `android/app/build.gradle` now also honors an optional
  `android/keystore.properties` (gitignored) if ever present.
- **Secrets hygiene**: `*.jks`, `*.keystore`, `keystore.properties` are now explicitly
  gitignored in `android/.gitignore`. No keystore or password is committed.
- **Branding present**: launcher icons (`mipmap-*`), splash screens, `app_name` = "TailTots".
- **`android/gradlew`**: still carries its pre-existing mode-only change (executable bit),
  unstaged and preserved — never staged or committed by this work.

## Blocker: Gradle cannot run in this sandbox right now

Raw TCP (including 127.0.0.1 loopback) is denied for the assistant (`other_tcp: Deny`);
any Java TCP connection receives the policy notice instead of connecting. Gradle's
daemon/client protocol requires loopback TCP, so `./gradlew bundleRelease` fails with
"Could not receive a message from the daemon" (root cause confirmed, not a code issue).
**Fix (user action, 30 seconds)**: in Muse → Settings → Permissions → Direct network
protocols, switch `other_tcp` from **Deny** to **Ask** (or Allow). Then say the word and
the build runs. Alternative: run the commands below yourself in any terminal on this VM
(the restriction applies to the assistant sandbox, not to your own shell).

## Changes made by this audit (uncommitted, in working tree)

- `vite.mobile.config.ts` — Supabase vars now fall back to `process.env` when no `.env`
  exists, so release builds can inject them without committing secrets. (Build-verified.)
- `android/app/build.gradle` — optional `keystore.properties` signing fallback; does not
  interfere with the existing injected signing.
- `android/.gitignore` — keystore patterns uncommented + `keystore.properties` added.
- `android/local.properties` — created (gitignored), points at `~/Android/Sdk`.

## Ordered checklist — when Play Console access arrives

1. **Unblock the build** (see Blocker above) — or run step 2 yourself in a terminal.
2. **Provide Supabase values for the release bundle** (the web code bakes them at build time;
   the current `dist/mobile` has them empty). Either create `.env` in the repo root
   (gitignored — safe) or export them inline:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://opdfjjxfsravjwfcyzwn.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
3. **Build the signed release bundle**:
   ```
   cd ~/workspace/tailtots-supabase-work
   export JAVA_HOME=/home/hatch/workspace/tools/jdk-17.0.20.1+1
   npm run android:sync
   cd android && /home/hatch/workspace/tools/gradle-8.14.3/bin/gradle bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`.
4. **Verify the signature**:
   `~/Android/Sdk/build-tools/36.0.0/apksigner verify --print-certs android/app/build/outputs/bundle/release/app-release.aab`
   (must show the `tailtots-upload` cert; an unsigned bundle is rejected by Play).
5. **Play Console setup** (first time): create app → package `com.tailtots.family`;
   enroll in **Play App Signing** (upload key = the keystore above; back it up — loss means
   registering a new upload key); complete **store listing** (see assets below); fill the
   **content-rating questionnaire** (kids' app — expect "Designed for Families" requirements:
   no ads/personalized ads — the app has none); complete the **data safety** form
   (Supabase backend: account/auth data); set target audience incl. children honestly.
6. **Upload** the AAB to the **internal testing** track first; verify install on a real device;
   then promote to closed/open testing → production.
7. **Bump for the next release**: raise `versionCode` (integer, must increase every upload)
   and `versionName` in `android/app/build.gradle`.

## Store-listing assets still needed (not in repo)

- Feature graphic 1024×500, app icon 512×512 (launcher art exists in `res/` but Play wants
  the 512px listing icon), at least 2 phone screenshots (7" tablet + 10" tablet optional),
  short (≤80 chars) + full description, category, contact email, privacy-policy URL
  (https://tailtots.com/privacy).

## If the upload keystore ever needs replacing

Generate a new one (passwords chosen by you, never committed):
```
keytool -genkeypair -v -keystore ~/workspace/secrets/tailtots-upload.keystore \
  -alias tailtots-upload -keyalg RSA -keysize 2048 -validity 9125
```
then either update the `android.injected.signing.*` values in `~/.gradle/gradle.properties`
or create `android/keystore.properties` (gitignored):
```
storeFile=/home/hatch/workspace/secrets/tailtots-upload.keystore
storePassword=<password>
keyAlias=tailtots-upload
keyPassword=<password>
```
and request an **upload-key reset** in Play Console (Play App Signing → change upload key).

## Deliberately NOT done

- No keystore/password committed or regenerated; existing passwords not reproduced anywhere.
- Nothing uploaded to Play Console; no store listing created.
- `android/gradlew` mode change left untouched and uncommitted.
- No production deploy; web `dist/` output is gitignored build output only.
