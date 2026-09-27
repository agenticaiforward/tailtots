# Alexa Skill — Deploy Readiness Report

**Skill:** TailTots for Parents (general-audience parent companion — the required
first live skill before the Kids-category application, Amazon case 21813022801)
**Date:** 2026-09-27
**Verdict: READY TO STAGE** — everything that can be done without Amazon/AWS
access is done and verified. Nothing has been submitted to Amazon; no AWS
resources were created.

## Canonical package locations (single source of truth)

| Artifact | Path |
|---|---|
| Lambda source | `apps/alexa/lambda/index.mjs` (byte-identical to the validated ZIP) |
| Deploy ZIP | `~/workspace/tailtots-alexa/tailtots-alexa-lambda.zip` (handler `index.handler`, Node 20.x) |
| Skill manifest | `apps/alexa/skill-package/skill.json` |
| Interaction models | `apps/alexa/skill-package/interactionModels/custom/{en-US,en-GB,en-CA,en-AU,en-IN}.json` |
| Skill icons | `apps/alexa/skill-package/assets/images/` (512 + 108 PNG, verified) |
| Package validator | `apps/alexa/validate-skill.mjs` |

> Ignore `~/workspace/tailtots-builds/alexa*` — those are older exploratory
> builds (kids-skill draft, TS prototype). They are NOT the submission package.

## Audit results

### ✅ Verified working
- **ZIP == source:** `tailtots-alexa-lambda.zip` is byte-identical to
  `apps/alexa/lambda/index.mjs` (previously unverified — now confirmed).
- **Handler tests:** all 10 request paths pass locally (Launch + 5 custom
  intents + Help/Stop/Cancel + unknown-intent fallback). Every response is a
  well-formed Alexa envelope with non-empty speech text.
- **Intent coverage:** the interaction model now covers every intent the
  Lambda implements (added `AMAZON.FallbackIntent`, which the handler's
  default branch answers with a graceful reprompt).
- **Example phrases verified** to match model sample utterances verbatim.
- **Privacy/terms URLs live:** `https://tailtots.com/privacy` (HTTP 200),
  `https://tailtots.com/terms` (HTTP 200), checked 2026-09-27.
- **Repo validator** `node apps/alexa/validate-skill.mjs` passes.
- **Not child-directed:** `isChildDirected: false`, category `LIFESTYLE`
  (general audience), no purchases, no ads, no personal info collected.
- **Demo data clearly labeled:** every speech response says "using demo data";
  the store listing and testing instructions disclose it; the demo family
  uses fictional kids (Maya/Leo — consistent with the app's demo portraits),
  so no real family data ships.

### 🔧 Fixed in this pass (no credentials needed)
1. `skill.json`: 3rd example phrase was not a model sample utterance → fixed
   to `"Alexa, ask Tail Tots Parent what are today's missions"` (exact sample).
2. `skill.json`: added `en-GB`, `en-CA`, `en-AU`, `en-IN` publishing +
   privacy locale blocks (manifest previously en-US-only despite the
   worldwide-distribution decision).
3. Interaction models: created the 4 missing English-locale models and added
   `AMAZON.FallbackIntent` to all five.
4. Old placeholder privacy domain (`pawpal-quest-kids.…chatgpt.site`) was
   already gone from `apps/alexa` — confirmed none remain.

### ⏳ Remaining — needs the user's Amazon/AWS access (nothing to do until then)
1. **Placeholder Lambda ARN** in `skill.json`
   (`arn:aws:lambda:us-east-1:000000000000:function:tailtots-alexa-parent-skill`)
   → replaced with the real function ARN after the Lambda is created.
2. **AWS Lambda creation + code upload** (us-east-1, Node.js 20.x,
   handler `index.handler`, upload the validated ZIP).
3. **Alexa developer console:** create the custom skill, paste `skill.json`,
   upload the 5 interaction models + 2 icons, point the endpoint at the ARN,
   build the model, run the simulator test scripts, submit for certification.

### 📌 Explicitly out of scope for this submission (future milestones)
- **Account linking / live Supabase family data:** v1 ships with labeled demo
  data by design (confirmed strategy). No account linking config is needed for
  certification of this skill; it is the planned v2 upgrade.
- **Kids-category skill:** submitted only after this parent skill is live
  (Amazon case 21813022801).
- **AI mission ideas:** belong to the older TS prototype, not the validated
  artifact — not part of this submission.

## Ordered checklist for the moment credentials arrive

**From the user (at home), we need:**
1. Sign-in to the **Amazon developer account** at developer.amazon.com/alexa
   (the account that will own/publish the skill).
2. **AWS console access** to the account where the Lambda will live
   (or the Lambda function ARN, if the user creates the function themselves).
3. Confirm AWS **region** (default: `us-east-1`) and **account ID**.

**Then, in order:**
1. AWS console → Lambda → Create function → **Node.js 20.x**,
   function name `tailtots-alexa-parent-skill`, region `us-east-1`.
   Upload code: `~/workspace/tailtots-alexa/tailtots-alexa-lambda.zip`
   (handler is `index.handler`). Copy the function's ARN.
2. In `apps/alexa/skill-package/skill.json`, replace
   `arn:aws:lambda:us-east-1:000000000000:function:tailtots-alexa-parent-skill`
   with the real ARN.
3. Alexa developer console → Create custom skill → name
   "TailTots for Parents" → default locale en-US → provision the hosted
   backend option OFF (we bring our own Lambda endpoint).
4. JSON editor → paste the full contents of the updated `skill.json`.
5. Interaction Model → JSON editor → paste each of the 5 locale models
   (`en-US`, `en-GB`, `en-CA`, `en-AU`, `en-IN`) into its locale, then
   **Build Model** for each.
6. Publishing → upload the two icons from
   `apps/alexa/skill-package/assets/images/`.
7. Endpoint → paste the Lambda ARN (default region endpoint).
8. Test tab → run the simulator scripts from `testingInstructions` in
   `skill.json` (launch, approvals, missions, bank, streaks, pet check,
   help/stop/unknown phrase).
9. Distribution → confirm worldwide, privacy URLs already
   `https://tailtots.com/privacy` and `https://tailtots.com/terms` →
   **Submit for certification**.

**Nothing else is needed from the user** — no API keys, no Supabase keys, no
purchases. The skill runs on bundled demo data until the account-linking
milestone.
