# TailTots Website Promise → Implementation Gap Map

**Branch:** `moonshot` · **Audit date:** 2026-10-06 · **Method:** 4 parallel code audits (landing copy, parent app, kid app, backend)

## Legend
- ✅ Working — real, tested, persisted
- 🟡 Partial/Mock — renders but content or path is fake/fallback
- 🔴 Gap — promised but not implemented
- 🧪 Untested — implemented in code but never verified end-to-end

## Core loop (hero promise: "checklist → approve → level up")
| # | Promise (site copy) | Status | Notes |
|---|---|---|---|
| 1 | One daily kid checklist (~1 min/day) | ✅ | MissionsPanel, persisted `tailtots-family-state-v1` |
| 2 | Parent approves in ~30 sec, approve-all, send-back with reason | ✅ | ApprovalsPanel |
| 3 | Streaks, badges, certificates feed from approvals | ✅ | 12-day streak UI, badge awards, Pet Readiness / Certified Pet Hero auto-award + printable certificate |
| 4 | "No strangers, no chats, no doomscroll" closed system | ✅ | No social features exist at all; architecture enforces it |
| 5 | "This is the real kid screen — not a mockup" | ✅ | Mission-mode card is the live demo |

## Kid Bank
| # | Promise | Status | Notes |
|---|---|---|---|
| 6 | Dollars = real allowance, coins = fun; balances "ready to save or give" | ✅ | Derived from approved transactions |
| 7 | Points→dollar rate parent-set, kids see converted value | ✅ | `pointsPerDollar` default 20, parent-only setting |
| 8 | Kid save/spend/give requests → parent approval → goal progress | ✅ | `requestBankMove` → pending → `approveTransaction` |
| 9 | Parent confirms real-world donation on fully-funded giving goal | ✅ | `confirmDonation` stamps `donationConfirmedAt` |
| 10 | "Share with family — grandparents chip in (see goal, never kid details)" | ✅ | Real shareable family view: parent generates `#giving/<uuid>` link from a goal (parent reviews the exact family-facing text first); family sees goal name, cause, saved-of-target progress bar, parent note + "chipping in goes through the parent" — no kid details, no app navigation. Per-goal active-link list with copy/revoke; revoked links show "no longer active". Store: `lib/giving-share-store.ts` (localStorage, Supabase skeleton for Stream B parity); view: `app/components/GivingShareView.tsx`. Tests: `scripts/verify-stream-e.ts` — all passing (2026-10-06). |

## Pets & readiness tracks
| # | Promise | Status | Notes |
|---|---|---|---|
| 11 | Pet care missions on your real pet (feeding, training, vet prep) | ✅ | Mission templates + pet passports |
| 12 | Pet Readiness Certificate track (kids who want a pet): 12 missions / 7-day streak / 3 skill areas | ✅ | `getCertificateProgress`, auto-award + celebration |
| 13 | Kids who can't have pets: donation goals for real shelters, cheer rescue dogs, full skill builder | 🟡 | Donation goals ✅; "cheer rescue dogs" = no dedicated feature (covered by giving goals); skill builder ✅ |
| 14 | Pet Passports | ✅ | Parent-editable; kid "studied it" logging for no-pet families |

## AI features
| # | Promise | Status | Notes |
|---|---|---|---|
| 15 | Kid-safe AI Buddy: predefined questions, no open chat, one safe Q&A | ✅ | As designed (safety promise = predefined Q&A) |
| 16 | "✨ AI-generated for today" daily buddy boost | ✅ | Now genuinely AI-generated via POST /api/ai/daily-boost when parent signed in (cached per day, category-gated); honest "Today's buddy boost" label on local fallback. Stream C. |
| 17 | Kid AI Buddy fetch sends `lifeSkill: "curiosity"` — invalid, always 400 | ✅ | Fixed → "responsibility" (Stream A; re-applied after merge collision). |
| 18 | Life Skill Chore Planner generates ideas with Workers AI, parent reviews before mission | 🟡 | Attempts `POST /api/ai/ideas`, always falls back to templates (no route in dev build; 503 in prod = missing env vars). **→ Stream A** |
| 19 | "Ask your kid with AI" — AI writes a conversation prompt | ✅ | Real via POST /api/ai/conversation-prompt when signed in (labeled "✨ AI-generated prompt"); honest "Demo prompt · generated locally" fallback. Stream C. |

## Growth, character, social
| # | Promise | Status | Notes |
|---|---|---|---|
| 20 | Growth Log: per-child skill meters (responsibility, empathy, teamwork, leadership, time mgmt) | ✅ | Derived + persisted |
| 21 | Memory moments (parent-saved; kid actions auto-log) | ✅ | `memory_moments` table + UI |
| 22 | Safe social practice: "training wheels", 6 scenarios, instant coaching, Safe Social Star badge | ✅ | Functional client-side, persisted `socialPracticeDone` |
| 23 | Character curriculum "taught through missions, not lectures" | ✅ | Real 48-mission curriculum: 4 traits × 3 levels, one-tap assignment, progression → badges + Growth Log skill meters, no-pet alternatives. Stream D. |

## Neighborhood, playdates, jobs
| # | Promise | Status | Notes |
|---|---|---|---|
| 24 | Parent posts jobs → visibility gate → kid accepts → parent finalizes → proof to parent → Kid Bank payout | ✅ | Full 4-step pipeline, client-side |
| 25 | Playdates: availability grid, real invite link, other parent picks a slot, host sees confirmation live | ✅ | Supabase-backed for signed-in parents (cross-device), localStorage fallback for demo. `kidAvailability` now persisted. Stream B. |
| 26 | "Nearby families" from ZIP | 🟡 | Deterministic ZIP-hash **demo data**, labeled demo in code. Acceptable as demo; no change unless product wants real directory (privacy-sensitive — keep demo) |
| 27 | Parent thank-you to posting parent | ✅ | `markPosterThanked` + clipboard note |

## Safety & pacing
| # | Promise | Status | Notes |
|---|---|---|---|
| 28 | 10 check-ins/day anti-addiction pacing, exhaustion screen | ✅ | `tailtots-daily-checks-v1` |
| 29 | Parent passcode gate (default 4321), stripped from localStorage | ✅ | Session-only unless saved to parent account |
| 30 | Points-per-dollar + daily-check settings parent-controlled | ✅ | Family Setup |

## Accounts & cloud
| # | Promise | Status | Notes |
|---|---|---|---|
| 31 | Parent magic-link sign-in | 🧪 | Wired via Supabase Auth (`sendParentMagicLink`), **never tested end-to-end** |
| 32 | Cloud sync: relational push/pull under RLS (9 tables) | 🧪 | `family-cloud.ts` implemented, untested against live Supabase |
| 33 | Family snapshot save/load to parent account | 🧪 | `family_account_snapshots`, untested E2E |
| 34 | Launch-list signup / feedback forms | ✅ | Supabase insert with localStorage fallback |

## Dead/unrendered copy (not visible — no action)
- `journeySteps` / `platformPillars` / 5-step journey strings (lines 2315–2337): defined, never rendered. Leave as-is.

## Implementation streams
- **Stream A — Worker/AI backend:** fix `curiosity` bug; verify `/api/ai/ideas` locally (wrangler dev, validation + 401 paths); document exact prod env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, Workers AI binding) for user to set at deploy approval time.
- **Stream B — Playdates cloud:** wire `playdate-store` to `playdate_invites` table for signed-in parents; keep localStorage fallback; persist `kidAvailability`.
- **Stream C — Real AI features:** "Ask your kid with AI" via AI when signed in; daily buddy boost genuinely AI-generated (parent-side, cached per day), local fallback; keep kid safety framing (predefined questions, no open chat).
- **Stream D — Character curriculum:** real curriculum data (4 traits × 3 levels → mission packs), one-tap parent assignment, progression tracked in existing mission/approval/badge/skill-meter system.
- **Stream E — Giving-goal family share:** shareable family view link (goal progress, no kid details), styled like playdate claim links.
- **Stream F — Verification:** full new-customer journey E2E against local/staging build.

## Hard constraints
- NOTHING deploys to `tailtots.com` prod without explicit user approval.
- Alexa/iOS/Android/Echo deployments are OUT OF SCOPE (website first); keep APIs voice-friendly.
- Kids' side stays on-device demo (backend = parent-side only).
- Commit on `moonshot` with clear messages. Test everything built.
