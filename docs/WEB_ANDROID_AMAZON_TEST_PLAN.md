# TailTots Web, Android, and Amazon Fire Test Plan

Use this before any public beta or app-store upload.

## 1. Shared Release Candidate

```powershell
npm install
npm run test:first-three
```

This verifies:

- Web app production build
- ESLint
- Capacitor Android sync
- Fresh web assets copied into the native Android project
- Required Web/PWA, Android, and Amazon Fire packaging files

## 2. Web / PWA

Run:

```powershell
npm run build
npm run start
```

Test in Chrome, Edge, and iPhone/Android mobile browser if available.

Required checks:

- Parent passcode lock and unlock
- Kid profile switching
- Mission completion and parent approval
- Pet passport viewing and editing
- Kid Bank goal flow
- Neighborhood jobs hidden from kids until parent-visible
- Privacy and terms pages
- Refresh/reopen persistence
- Install as PWA from browser

## 3. Android App

Run:

```powershell
npm run android:build:debug
```

The debug APK should appear under:

```text
android/app/build/outputs/apk/debug/
```

If Gradle reports that Java is missing, install Android Studio or Eclipse
Temurin JDK, then set `JAVA_HOME` before rerunning the command.

Then test with Android Studio on:

- Pixel phone emulator
- Tablet emulator
- One real Android phone

Required checks:

- App launches with TailTots label
- App resumes after backgrounding
- No mixed-content warnings
- Photo upload/crop works
- Touch targets are easy for kids
- Layout works in portrait and landscape
- Data does not appear in Android device backup

## 4. Amazon Fire Tablet

Use the same Android package:

```powershell
npm run amazon:build:debug
```

Install the debug APK on a Fire tablet in developer mode.

Required checks:

- App launches without Google Play Services
- Fire tablet WebView renders the app
- Landscape/kitchen-counter use works
- Parent gates still block neighborhood and approvals
- Privacy and terms links are accessible
- Offline/reopen behavior is acceptable

## Store Gate

Only build a signed release after all three surfaces pass:

```powershell
npm run amazon:build:release
```

Use the generated Android App Bundle for Google Play or Amazon Appstore after
signing, store screenshots, content rating, and child-directed disclosures are
complete.
