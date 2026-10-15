# Deploying the REAL "TailTots for Parents" Alexa skill

The code is complete and tested in this repo. Everything below needs the
founder's AWS + Amazon developer accounts — do not attempt with shared or
pasted credentials; use the secure sign-in flow.

## 0. Prerequisites (all founder-side)

- An AWS account (for the Lambda) and an Amazon developer account
  (developer.amazon.com) under the founder's identity.
- The preview worker's OAuth routes must be live first:
  `GET https://tailtots.com/oauth/alexa/authorize`,
  `POST https://tailtots.com/oauth/alexa/token`,
  `GET https://tailtots.com/api/alexa/family-summary`.
- Set three Worker secrets (Cloudflare dashboard → Worker → Settings →
  Variables, or `wrangler secret put`):
  - `ALEXA_CLIENT_ID` = `tailtots-alexa-parent-skill` (must match skill.json)
  - `ALEXA_CLIENT_SECRET` = a long random string (also used in ASK console)
  - `ALEXA_TOKEN_SECRET` = a different long random string
- Paste `supabase/migrations/20261015_alexa_family_summary.sql` in the
  Supabase SQL editor (same as the earlier delete-policies migration).

## 1. Create the Lambda (us-east-1 — required for Alexa)

1. AWS Console → Lambda → Create function → Author from scratch:
   - Name: `tailtots-alexa-parent-skill`
   - Runtime: Node.js 20.x
   - Architecture: x86_64
   - Region: **us-east-1** (N. Virginia) — Alexa requires it.
2. Zip and upload this repo's `apps/alexa/lambda/` (index.mjs, validate.mjs).
3. Configuration → Environment variables:
   - `TAILTOTS_API_URL=https://tailtots.com` — the exact variable name is `TAILTOTS_API_URL`,
     copy it verbatim (it must match line 22 of apps/alexa/lambda/index.mjs).

4. Copy the Lambda's ARN, e.g.
   `arn:aws:lambda:us-east-1:123456789012:function:tailtots-alexa-parent-skill`.

## 2. Swap the placeholder ARN in skill.json

Replace `arn:aws:lambda:us-east-1:000000000000:function:tailtots-alexa-parent-skill`
in `apps/alexa/skill-package/skill.json` with the real ARN from step 1.
(Deliberately left as the placeholder in this commit — the ARN only exists
after the founder creates the Lambda.)

## 3. Create the skill with ASK CLI

```bash
npm install -g ask-cli
ask configure   # sign in with the founder's Amazon developer account
cd apps/alexa
ask deploy      # creates the skill from skill-package/ + interaction model
```

Then in the Alexa developer console, verify Account Linking:
- Authorization URI: `https://tailtots.com/oauth/alexa/authorize`
- Access Token URI: `https://tailtots.com/oauth/alexa/token`
- Client ID: `tailtots-alexa-parent-skill`
- Client secret: the same `ALEXA_CLIENT_SECRET` set on the Worker
- Auth code grant, client credentials in the request body (HTTP Basic also supported)
- Scope: none required

## 4. Test before certification

1. Alexa app (dev stage) → enable the skill → **Link account** → sign in with
   a real TailTots parent account (magic link).
2. "Alexa, open Tail Tots Parent" → "what needs my approval" — confirm it
   reads the linked family's real data, not sample data.
3. Disable account linking in the app and confirm every family-data intent
   asks to link instead of answering.
4. Confirm the pet check still answers without linking.

## 5. Certification checklist

- [ ] Privacy policy URL serves the Alexa/voice section (see
      PRIVACY_SECTION_DRAFT.md — must be reviewed and published first).
- [ ] Testing instructions describe account linking (already in skill.json).
- [ ] `usesPersonalInfo: true`, `isChildDirected: false`,
      `containsAds: false`, `allowsPurchases: false` (already in skill.json).
- [ ] No ad or analytics SDKs in the Lambda; no child-directed content.
- [ ] Skill category: Lifestyle (parent tool), NOT a Kids skill. The Kids
      version comes later, after this general-audience skill is live
      (Amazon eligibility rule, case 21813022801).

## 6. Production notes

- Authorization codes are stored in the Worker's in-memory map (5-minute
  TTL, single-use). That is fine for dev/certification; for production
  traffic across many Worker isolates, swap `defaultCodeStore` in
  `lib/alexa/oauth.ts` for a Workers KV- or D1-backed `CodeStore`
  implementation, or codes redeemed on a different isolate will 400.
- Access tokens are stateless HMAC-signed envelopes (30-day TTL). Revocation
  = the parent unlinks in the Alexa app; the Worker can additionally reject
  tokens by rotating `ALEXA_TOKEN_SECRET`.
