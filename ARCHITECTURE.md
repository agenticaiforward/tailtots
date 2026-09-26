# TailTots Architecture

TailTots is a family PWA (Next.js 16 / React 19 / TypeScript). The codebase is
organized as concentric layers with dependencies flowing inward. A module may
only import from layers at or below its own — never sideways into a sibling,
and never upward.

```
app/                      Next.js routes + thin shell components
  components/tailtots/    Feature panels (presentation only)
lib/
  domain/                 Pure business logic: no I/O, no React, no browser APIs
  validation/             Zod schemas at every trust boundary
  data/                   Data access: Supabase client, auth, repositories
  services/               App services that orchestrate domain + data + persistence
  errors/                 Typed AppError with user-safe messages
  logging/                Structured JSON logger (replaces console.*)
  types/                  Shared entity types (Child, Pet, Mission, ...)
db/                       Drizzle schema + D1 access (Cloudflare)
supabase/                 PostgreSQL schema, RLS policies, RPCs
worker/                   Cloudflare Worker entry
apps/alexa/               Standalone Alexa skill (dependency-free Lambda)
mobile/                   Capacitor wrapper
```

## Layer rules

- **Domain (`lib/domain/`) is pure.** Age rules, mission fairness, Kid Bank
  math, badge titles, readiness milestones, legacy-state migration, and seed
  data live here. No `fetch`, no `localStorage`, no Supabase, no React. This
  is what the unit tests pin down.
- **Validation (`lib/validation/`) guards every trust boundary.** Saved
  family snapshots, parent-facing form input, cloud writes, and the Alexa
  request envelope are all parsed with Zod *before* they touch the domain.
  Corrupt local data is dropped; hostile shapes never reach the UI state.
- **Data (`lib/data/`) owns all I/O.** One Supabase client singleton
  (`supabase-client.ts`) reads only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Auth, family snapshots, and engagement
  writes (launch list, feedback with a validated local fallback queue) each
  get a narrow module with typed errors — never raw SDK errors to the UI.
- **Services (`lib/services/`) orchestrate.** `family-state.ts` loads,
  migrates, and persists the family snapshot (localStorage today, cloud when
  a parent signs in), stripping secrets and using an image-free quota
  fallback so a full disk never loses data.
- **UI (`app/components/`) is thin.** Panels render and dispatch; they call
  domain helpers for display logic and services/data for persistence. They
  never touch Supabase or `localStorage` directly.
- **Presentation data is separated.** `app/components/tailtots/avatar-looks.ts`
  holds child/pet visual constants; the domain layer has no colors or emoji.

## Error handling

- All fallible operations throw `AppError` (see `lib/errors/app-error.ts`)
  with a stable `ErrorCode` (`VALIDATION`, `CONFIG`, `AUTH`, `NETWORK`,
  `STORAGE`, `UNKNOWN`).
- `toUserMessage()` converts any error to a kid-safe, parent-safe string.
  Technical detail stays in structured logs via `lib/logging/logger.ts`.

## Platforms

- **Web/PWA:** `app/` on Next.js, deployed to Cloudflare Pages.
- **Cloud:** Supabase (auth + Postgres + RLS) is the system of record for
  signed-in parents; `supabase/schema.sql` is the authoritative schema.
- **Edge:** `worker/` serves the app behind Cloudflare; `db/` targets D1.
- **Voice:** `apps/alexa/` is a standalone deployable — it cannot import
  `@/lib`, so `apps/alexa/lambda/validate.mjs` is a dependency-free mirror
  of `lib/validation/alexa.ts`. Keep the two in sync.
- **Mobile:** `mobile/` wraps the web app with Capacitor.

## Kid-safety invariants (enforced by design)

- No stranger messaging, no open kid chat, no public rankings.
- Child profile switching has no passcodes; the parent passcode is a
  **demo convenience gate**, not a security boundary — see `SECURITY.md`.
- Server-side authorization (Supabase RLS, RPC ownership checks) is the
  real enforcement. UI role state is convenience only.
- Pet Ready Family framing: readiness is proof of care over 8–12 weeks, a
  pet is never a prize, adoption is never guaranteed, the parent decides.
