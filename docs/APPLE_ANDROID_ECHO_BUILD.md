# TailTots Apple, Android, and Amazon Echo Build

TailTots now uses the web app as the shared product surface for mobile and a
small Alexa custom skill for Echo devices.

## Shared web build

```powershell
npm install
npm run build
```

## Apple App Store

The Apple app is a Capacitor iOS wrapper around the TailTots web build.

One-time setup on macOS:

```bash
npm install
npx cap add ios
npm run ios:sync
npm run ios:open
```

In Xcode:

1. Set the bundle identifier to `com.tailtots.family`.
2. Add the Apple developer team.
3. Configure app icons, splash screen, privacy labels, and child-safety
   disclosures.
4. Archive and upload to App Store Connect.

This Windows workspace can prepare the shared app source, but the signed iOS
archive must be produced on macOS with Xcode.

## Android / Google Play

```powershell
npm install
npx cap add android
npm run android:sync
npm run android:open
```

In Android Studio, build a signed release Android App Bundle for
`com.tailtots.family`.

## Amazon Appstore

The Amazon tablet app uses the same Android package. Build a signed `.aab` or
`.apk` from Android Studio and upload it to the Amazon Developer Console. See
`docs/AMAZON_APPSTORE_SUBMISSION.md` for the store listing checklist.

## Amazon Echo / Alexa

The Echo app lives in `apps/alexa`.

```powershell
npm run alexa:validate
```

The included custom skill supports:

- Launching TailTots
- Asking for today's care, earning, and contribution missions
- Starting a parent-guided real-world mission

Before production submission, replace the placeholder Lambda ARN in
`apps/alexa/skill-package/skill.json` with the deployed Lambda ARN and connect
real family data through a parent-authenticated backend.
