# TailTots Amazon Appstore Submission

This is the cheapest Amazon path for the neighborhood beta: package the live
TailTots PWA inside a Capacitor Android app and submit that Android package to
Amazon Appstore for Fire tablets and supported Android devices.

## Current app package

- App name: TailTots
- Android package id: `com.tailtots.family`
- Hosted app URL: `https://pawpal-quest-kids.navin-nala-0658.chatgpt.site`
- Privacy URL: `https://pawpal-quest-kids.navin-nala-0658.chatgpt.site/privacy`
- Terms URL: `https://pawpal-quest-kids.navin-nala-0658.chatgpt.site/terms`

## One-time laptop setup

Install these before building a signed Amazon upload:

1. Install Android Studio.
2. Install a JDK through Android Studio or Eclipse Temurin.
3. Open Android Studio once and install the Android SDK platform tools.
4. Confirm these commands work in PowerShell:

```powershell
java -version
where.exe keytool
where.exe adb
```

## Generate/update the Android project

```powershell
npm install
npm run amazon:sync
```

## Build for Amazon

Amazon accepts Android App Bundle (`.aab`) or APK uploads for Fire OS app
submissions. Prefer AAB for release unless Amazon testing shows a Fire-device
specific issue.

```powershell
npm run amazon:build:release
```

The release bundle will be created under:

```text
android/app/build/outputs/bundle/release/
```

## Signing

Create a release keystore once and keep it private. Do not commit it.

```powershell
keytool -genkeypair -v -keystore tailtots-release.keystore -alias tailtots -keyalg RSA -keysize 2048 -validity 10000
```

Add signing config in Android Studio or `android/gradle.properties` using local
machine secrets only.

## Amazon Developer Console checklist

1. Create or sign in to an Amazon Developer account.
2. Add a new Android app.
3. Upload the signed `.aab` or `.apk`.
4. Set app title to `TailTots`.
5. Suggested category: Education or Lifestyle.
6. Add privacy URL and support contact.
7. Complete content rating and child-directed disclosures honestly.
8. Upload screenshots from phone and Fire tablet layouts.
9. Test install on at least one Android phone and one Fire tablet before
   submitting.

## Store listing draft

Short description:

TailTots helps kids care, connect, earn, contribute, and create through
parent-guided real-world missions.

Long description:

TailTots is a parent-guided real-world development platform built for kids,
families, and trusted communities. Kids complete age-appropriate missions,
earn points, unlock badges, manage Kid Bank goals, contribute to community
needs, and learn values like responsibility, empathy, follow-through,
fairness, and helpfulness.

Parents control child profiles, approve work, guide connections, assign or hide
jobs, balance tasks across multiple children, and manage rewards from one
simple dashboard.

TailTots works well on phones, tablets, and kitchen counter displays so families
can use it where pet care actually happens.
