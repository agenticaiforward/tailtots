# TailTots Wildfire Audit — 2026-09-27

Full pass over every user prompt this session, judged against the wildfire bar:
funny, warm, inviting, premium, enterprise-grade, "the next big thing",
Joon-competitive, real photos as the foundation with illustrated graphics on top.

## 1. Face-crop functionality (production build review)
**Prompt:** "Look at the production build… make sure this functionality is good."
**Verdict:** ✅ PASS. Head-focused crop opens, drag/zoom works, Save persists,
face replaces illustrated head and stays attached through animation. Verified on
mobile 390×844 with synthetic media.

## 2. No stamps on faces
**Prompt:** "I don't want another stamp you are showing on the pictures."
**Verdict:** ✅ PASS. Paw badges removed from `KidCharacter` and
`AnimatedFamilyCharacter`. Branding kept in logo/UI and pet-medallion
sparkle/ribbon only — never over a face.

## 3. Age-appropriate demo pictures
**Prompt:** "Use the age appropriate pictures for kids and adults in the demo."
**Verdict:** ✅ PASS. Maya (6), Leo (9), and an adult parent portrait wired into
the starter family; all synthetic, all verified loading.

## 4. Pet-face graphics library
**Prompt:** "Even for the animals… the animal's face should be there and animal
related graphic added… make a library."
**Verdict:** ✅ PASS. `app/components/pet-buddy.tsx` — reusable `PetBuddyFace`
with species kits: dog (floppy ears + wagging tail), cat (ears + tail + whiskers),
guinea pig (round ears + feet), rabbit (long ears + fluffy tail), hamster
(ears + blush), tortoise (shell rim + feet), fish (fins + bubbles), bird
(crest + wings), generic pet. Real face is always the hero; accessories sit
around/behind it and animate with it. Wired into `PetCharacter`,
`AnimatedPetBuddy`, parade, passports, and kid ACTIVE PETS grid.

## 5. Wildfire thesis preservation
**Prompt:** "Go through all my prompts once again… wildfire."
**Verdict:** ✅ PRESERVED. Breadth check (2026-09-27): shelter 40 refs, donation/
thermometer 28, social practice 19, neighborhood jobs 34, launch list 6.
No narrowing. Hooks stay sharp; scope stays wide.

## 6. Deploy readiness (all three apps)
**Prompt:** "Make sure you are ready with all apps… you can deploy."
- **Alexa:** ✅ READY TO STAGE. ZIP byte-identical to source, 10/10 handler
  paths pass, 5 locale models, validator green. Needs: Amazon/AWS access,
  Lambda creation, ARN swap, console submission.
- **Android:** ✅ STAGED. Package `com.tailtots.family`, signing pre-wired,
  sync clean. Blocked only by sandbox TCP permission for Gradle (user flips
  `other_tcp` to Ask in Muse Settings, or runs the 3 build commands).
- **iPhone:** ✅ STAGED, all code blockers fixed (parental gate, privacy links,
  local images). Needs: Mac + Xcode + Apple Developer membership, then
  Archive → TestFlight. Handoff ZIP refreshed with current bundle.

## 7. Minute functional testing + flow clarity + bug fixes
**Prompt:** "Test each and every minute thing… flow good for any new parent or
kid… make improvements… fix all the bugs."
**Verdict:** 🔄 IN PROGRESS. Dedicated E2E agents on parent flow and kid flow.
Fixes already landed from this review:
- Parental gate: passcode modal on child→parent toggle and Contact-us path
  (demo passcode 4321, changeable in Family Setup).
- Privacy + Terms links in landing footer and Family Setup.
- Four hotlinked landing images now bundled locally (`public/landing/`).
- Unreferenced Next.js boilerplate removed from `public/`.

## Open items (need the user at home)
1. Publisher access: Amazon developer/AWS, Apple Developer, Play Console —
   via secure flows, never in chat.
2. iPhone: choose Mac path (own Mac recommended) or approve cloud-Mac later.
3. Android: flip the `other_tcp` permission (or run the Gradle build locally).
4. Cloudflare: fresh staging token via the "Edit Cloudflare Workers" template
   (previous token rejected) to unblock the staging deploy.
5. Magic-link sign-in test on https://tailtots.com (standing).
6. GitHub token revocation still unconfirmed (standing).
