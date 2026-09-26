# Contributing to TailTots

## Setup

```bash
npm install
npm run dev        # local dev server
```

Copy `.env.example` to `.env.local` and add Supabase keys if you want the
cloud backend; without them the app runs in local device mode.

## Required checks

Every change must pass all four before review:

```bash
npm run lint        # ESLint (no-explicit-any is an error; no raw console.*)
npm run typecheck   # tsc --noEmit, strict
npm run test        # vitest run
npm run build       # Next.js production build
```

CI (`.github/workflows/ci.yml`) runs the same four plus the Alexa skill
validator (`npm run alexa:validate`).

## Code conventions

1. **Respect the layers** (see `ARCHITECTURE.md`). UI calls services/data;
   data calls validation + domain; domain imports nothing outside
   `lib/types`, `lib/domain`, and `lib/validation`. If a helper needs I/O or
   React, it does not belong in `lib/domain/`.
2. **No `any`.** `@typescript-eslint/no-explicit-any` is an error. Use
   `unknown` + Zod narrowing at boundaries.
3. **No `console.*` in app/lib/db/worker code** — use
   `createLogger("scope")` from `lib/logging/logger.ts`. Logger
   implementation files and one-off CLI scripts are exempt.
4. **Validate at trust boundaries.** Anything from `localStorage`, a form,
   the network, or an Alexa event is parsed with a Zod schema before use.
   New persisted shapes get a schema in `lib/validation/`.
5. **Errors are typed.** Throw `AppError` with the right `ErrorCode`; never
   surface raw SDK errors to parents or kids. Use `toUserMessage()` at the
   UI edge.
6. **Tests pin domain logic.** New business rules in `lib/domain/` come with
   Vitest cases under `lib/domain/__tests__/`. New validation schemas get
   cases under `lib/validation/__tests__/`.
7. **Alexa Lambda is standalone.** `apps/alexa/lambda/` cannot import
   `@/lib`. If you change `lib/validation/alexa.ts`, mirror the change in
   `apps/alexa/lambda/validate.mjs` and extend
   `apps/alexa/__tests__/handler.test.mjs`.

## Kid-safety rules for contributors

- Never add stranger messaging, open chat, public rankings, or location
  sharing without a full safety review.
- Never present a pet as a prize or guarantee adoption outcomes.
- The parent passcode (`defaultParentPasscode`) is a demo gate, not a
  security boundary — do not build real authorization on it. See
  `SECURITY.md`.
- Do not log children's names, family details, or secrets. The logger
  redacts values at `error` level and above; keep it that way.

## Pull requests

- Keep changes uncommitted until reviewed (repo convention during the
  current refactor pass); CI is the gate, review is the merge decision.
- Describe the behavior change, the layer touched, and the safety impact
  in one paragraph.
