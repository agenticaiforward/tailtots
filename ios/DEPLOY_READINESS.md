# TailTots iPhone App — Deploy Readiness

**Audited/updated:** 2026-09-27 · Canonical project: `~/workspace/tailtots-builds/ios/`
(Capacitor 8 wrapper · bundle `com.tailtots.family` · display name `TailTots` · v1.0 build 1 ·
iOS deployment target 15.0)
**Fresh Mac handoff ZIP:** `~/workspace/tailtots-builds/ios/tailtots-iphone-app.zip` (15 MB, rebuilt 2026-09-27 — contains the current web bundle)
**Prior full audit:** `~/workspace/tailtots-builds/ios/APPLE_AUDIT.md` (2026-09-23 — still the reference for review-risk findings)

---

## Verdict: STAGED, not yet submittable

Everything that can be done on Linux is done. Three **code-level** blockers remain in the
web app (no Mac needed — main-agent lane, can be fixed before the Mac is even opened),
and compilation/signing/upload inherently need a Mac + Apple Developer access.

| # | Blocker | Status (2026-09-27) |
|---|---------|---------------------|
| B1 | Camera usage description (crash on "Take Photo") | ✅ FIXED — `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` in `Info.plist` |
| B2 | No parental gate — child can flip the role toggle into full parent controls | ❌ OPEN — `app/components/TailTotsApp.tsx:616` (`isParentUnlocked` defaults `true`), `:1273` (role toggle sets it `true` unconditionally). Implement a real gate (passcode modal or grown-up check) before entering the parent role. |
| B3 | No privacy policy surfaced in the app | ⚠️ HALF — `app/privacy/page.tsx` + `PrivacyPolicyContent.tsx` exist in the Next.js web app (good as the App Store Connect Privacy Policy URL), but the **mobile entry** (`mobile/src/main.tsx` → `TailTotsApp`) renders no privacy link. Add a Privacy link (landing footer + Family Setup) pointing at `https://tailtots.com/privacy`. |
| L1 | Landing images hotlinked (Unsplash / assets.moargut.com / c.nau.ch) | ❌ OPEN — `app/components/TailTotsApp.tsx:2148-2151`. Download licensed copies, bundle under `public/`, reference locally. Breaks offline + licensing risk. |
| L2 | Demo shipped a real family's identity | ✅ FIXED — kids are now "Maya" (6) and "Leo" (9); pet names are the family's own public founder-story pets |
| L3 | `mailto:` link on public landing | ✅ FIXED — none found in current panels |

---

## What was verified / fixed on Linux (2026-09-27)

- **Bundle ID** `com.tailtots.family` in both Debug and Release (`project.pbxproj`), matches `capacitor.config.ts` `appId`. **Do not change it now** — changing later orphans Keychain/TestFlight history.
- **Display name** `TailTots` (`CFBundleDisplayName`).
- **Version** 1.0 (build 1) — correct for a first TestFlight.
- **Icons**: full `AppIcon.appiconset` populated from brand art (1024px wordmark on TailTots green). Branded, ship-ready. (Optional polish later: a simplified glyph reads better at 60px, but the wordmark is acceptable.)
- **Launch screen**: `LaunchScreen.storyboard` + branded 2732px splash (logo on green). No placeholder.
- **Web bundle refreshed**: `npm run mobile:web:build` re-ran from the current repo (includes the new pet-buddy species library + the 4 generated pet portraits), copied to `ios/www/`, `npx cap sync ios` completed clean (web assets copied into `ios/App/App/public/`, `Package.swift` regenerated).
- **Repo script fixed**: `ios:sync` was `npm run build && cap sync ios` (wrong — that builds the server bundle); now `npm run mobile:web:build && cap sync ios`, matching `android:sync`. (Uncommitted in `~/workspace/tailtots-supabase-work/package.json` — will ride along with the parent's next commit.)
- **No tracking**: bundle scan found zero analytics/tracking SDKs, zero `*.supabase.co` URLs (all data stays on-device in `localStorage` in this build), no third-party sign-in, no IAP, no UIWebView, no tappable external links (`tailtots.com` appears only in share-text strings and the printed certificate).
- **Encryption**: no `ITSAppUsesNonExemptEncryption` key — answer "standard encryption only / exempt" in App Store Connect.

---

## Remaining work (no Mac needed — main-agent lane)

1. **B2 parental gate** — implement before any submission (likely rejection under Guideline 1.3 otherwise).
2. **B3 in-app privacy link** — surface `PrivacyPolicyContent` (or link `https://tailtots.com/privacy`) in the mobile flow.
3. **L1 local images** — bundle the four landing photos locally.
4. Optional: hide the dead "Create account / Sign in" UI when auth is unconfigured (R3); align "Guided AI" copy with the local template reality (R4); remove Next.js boilerplate (`file.svg`, `globe.svg`, `window.svg`, `screenshot.jpeg`, `sw.js`) from `public/` so it stops shipping in `www/` (R5).

After any of these, re-run: `npm run mobile:web:build` → copy `dist/mobile` → `ios/www` → `npx cap sync ios` (or just `npm run ios:sync` from the repo once the script fix is committed).

---

## Path (a): build on your own Mac — step by step

**You need:** a Mac with macOS (Sonoma/Sequoia), ~30 GB free, internet.

1. **Install Xcode** from the Mac App Store (Xcode 16+). Open it once, accept the license, let it install additional components.
2. **Install Node.js 20+** from nodejs.org (LTS) and **CocoaPods**: `sudo gem install cocoapods`.
3. **Copy the project** to the Mac: transfer `tailtots-iphone-app.zip` (AirDrop, USB, or cloud drive), unzip it.
4. In Terminal: `cd tailtots-iphone-app` → `npm install` → `npx cap sync ios`.
5. `npx cap open ios` — this opens `ios/App/App.xcworkspace` in Xcode (**always the `.xcworkspace`, never the `.xcodeproj`**).
6. **Sign in**: Xcode → Settings → Accounts → add the Apple ID that has the Apple Developer Program membership. Then select the `App` target → Signing & Capabilities → check **Automatically manage signing** → choose your Team.
7. **First run**: pick an iPhone simulator (e.g. iPhone 16) → ⌘R. Verify: app launches, photos/faces render, camera prompt shows the TailTots purpose string, safe areas look right on notch/Dynamic Island.
8. **Archive**: with target set to **Any iOS Device (arm64)** → Product → Archive. When it finishes: Distribute App → **App Store Connect** → Upload → let it validate and upload.
9. In **App Store Connect** (appstoreconnect.apple.com): the build appears under TestFlight in ~10–30 min. Add it to a TestFlight group for internal testing first.
10. Fill the listing (see checklist below), then **Submit for Review**.

**Every later update:** change the web app in the repo → `npm run mobile:web:build` → refresh `www/` → `npx cap sync ios` → bump build number in Xcode → Archive → upload. (Marketing version 1.0 stays; **build number must increase** with every upload.)

---

## Path (b): cloud Mac build service (only if you approve later)

If you don't want to use your own Mac, a cloud Mac (e.g. MacStadium, AWS EC2 Mac, Codemagic, Bitrise, GitHub Actions macOS runners) can compile and upload. What it needs — none of this is set up yet:

- The project in a **private Git repo** the service can clone (currently it lives only as a local folder + ZIP).
- Your **Apple Developer credentials** entered into the service (App Store Connect API key is the safe way — never paste the Apple ID password).
- An **App Store Connect API key** (Issuer ID + Key ID + .p8) for headless upload.
- A paid plan on whichever service you pick — **no paid service will be started without your explicit approval**.
- Note: someone (you or an agent with the Mac) still has to do first-run QA on a simulator/device — cloud services can run simulators, but the parental-gate and photo flows deserve a real device pass.

**Recommendation:** Path (a) is faster and cheaper for v1.0 — the project is already staged for it.

---

## Apple Developer access — exact checklist for when it arrives

### 1. Membership & identifiers
- [ ] Enroll in the **Apple Developer Program** ($99/yr) if not already — TestFlight and App Store submission require the paid membership.
- [ ] In developer.apple.com → Identifiers: register an **explicit App ID** `com.tailtots.family` (Xcode automatic signing can create this for you on first archive — either way, confirm it exists and matches exactly).
- [ ] Signing: use **Automatic signing** in Xcode (it creates the Development + Distribution certificates and the App Store provisioning profile). Manual certs are only needed for CI (path b).

### 2. App Store Connect record
- [ ] Create the app: **TailTots**, Bundle ID `com.tailtots.family`, SKU anything (e.g. `tailtots-ios-001`), primary language English.
- [ ] **Privacy Policy URL** (required, esp. Kids category): `https://tailtots.com/privacy` — verify the page is live before submitting.
- [ ] **Support URL**: a live page (e.g. `https://tailtots.com/support` or the contact section) — must not 404.

### 3. Listing assets to prepare
- [ ] App icon 1024×1024 (have it: `ios/App/App/Assets.xcassets/AppIcon.appiconset/icon-1024.png`).
- [ ] Screenshots: **6.7"** (1290×2796) and **6.5"** (1242×2688 or 1284×2778) — at least the required sizes; capture from the simulator on the Mac (⌘S in Simulator saves to Desktop).
- [ ] Subtitle (≤30 chars), description, keywords (≤100 chars, comma-separated), category (**Education** primary suggested), price **Free**, no IAP.

### 4. Privacy nutrition labels — answers based on the app's ACTUAL data use
This build: **no network calls to any backend** (verified — zero `supabase.co` URLs in the bundle), **no analytics/tracking SDKs**. Family profiles, kids' names/ages/photos, pet photos, and launch-list emails are stored **on-device only** (`localStorage`) and never transmitted.

- [ ] Data collection: **"Data Not Collected"** is defensible for this build.
- [ ] If a reviewer asks about the launch-list email field: "stored on-device only, never transmitted."
- [ ] ⚠️ **Tripwire for future builds:** the moment a build ships with Supabase credentials baked in, parent emails and synced family data leave the device — labels must then declare **Contact Info** (emails), **User Content** (photos), **Identifiers**. Put this on the release checklist for every rebuild.
- [ ] Camera / photo-library permission strings are in `Info.plist`; these are on-device features, not "collection."

### 5. Kids-category / review answers
- [ ] Age rating questionnaire: answer honestly (no objectionable content, no user-generated content shared publicly, no chat with strangers).
- [ ] **Parental gate**: only submittable after B2 is fixed — describe the gate in Review Notes ("Parent areas are behind a passcode/grown-up gate; the parent passcode is set in Family Setup").
- [ ] No third-party advertising or analytics (verified clean — state it in Review Notes).
- [ ] No external links from kid-reachable surfaces (verified — `tailtots.com` appears only in copy-to-clipboard share text and the printed certificate; state this).
- [ ] Encryption questionnaire: **standard encryption only / exempt** (HTTPS-only app, no custom crypto).

### 6. Review notes (paste into App Store Connect)
> TailTots is a parent-guided kids' pet-care app. All family data (profiles, photos) stays on the device in this build — no account, no backend, no analytics, no ads. Parent-only areas (family setup, approvals) are behind a parental gate. Camera/photo-library access is used solely to add pet and profile photos to the family's private on-device space. Demo content uses fictional names (Maya, Leo).

---

## Decisions needed from the user (at home)

1. **Mac choice**: (a) build on your own Mac with the guide above ← recommended, or (b) approve a paid cloud-Mac service later.
2. **Apple Developer Program**: confirm the paid membership exists (or enroll — $99/yr) and hand over access via the secure flow (App Store Connect API key preferred for uploads).
3. **Final call on the 3 code blockers** (B2 gate design, B3 privacy surface, L1 image licensing) — the web-app work must land and be re-synced before the Mac archive.
4. **Listing copy**: subtitle, description, keywords, support URL — or delegate the copy to the agent.
5. **Screenshots**: captured on the Mac simulator during path (a), or delegate a shot list.
