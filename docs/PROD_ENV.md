# Production environment for `POST /api/ai/ideas`

**Route:** `POST /api/ai/ideas` (Cloudflare Worker, `worker/index.ts` → `handleAiIdeas`)
**Status:** implemented and locally verified (Stream A, 2026-10-06). NOT yet live — nothing deploys to `tailtots.com` without explicit user approval.

## Why the live site 503s today

The route checks its server-side env vars **first**, before auth or body
validation:

```ts
if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  return jsonResponse(
    { error: "Parent sign-in is not configured yet. Please try again later." },
    503,
  );
}
```

`tailtots.com` currently returns this exact **503** because the two Worker
env vars below were never set on the production Worker. Setting them fixes
the 503; the route then behaves as designed:

| Condition | Response |
|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` missing | `503` "Parent sign-in is not configured yet. Please try again later." |
| No/invalid `Authorization: Bearer <token>` | `401` "Parent sign-in required." |
| Workers AI binding missing | `503` "The AI helper is not configured yet." |
| Bad JSON / bad `lifeSkill` / bad `ageBand` | `400` with a specific message |
| Valid parent session + AI binding | `200` `{ "ideas": [...] }` |

## Exact vars to set (Worker server-side — NOT build vars)

> These are **Cloudflare Worker** environment variables, set in the
> Cloudflare dashboard under **Workers & Pages → tailtots → Settings →
> Variables and Secrets**. They are **not** the `NEXT_PUBLIC_*` build vars
> (those are baked into the client bundle at build time and are invisible to
> the Worker).

| Name | Kind | Value | Notes |
|---|---|---|---|
| `SUPABASE_URL` | Variable | `https://opdfjjxfsravjwfcyzwn.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | **Secret** | the project's **anon / publishable** key | Set as a secret (encrypted). **Never** the `service_role` key — the Worker only needs the anon key because it validates the parent's own access token, never bypasses RLS. |

Changes to variables/secrets apply to the live Worker without a code
redeploy.

## Workers AI binding (also required for 200s)

Without it the route returns `503` "The AI helper is not configured yet."
even for signed-in parents.

1. Dashboard: **Workers & Pages → tailtots → Settings → Bindings → Add binding → Workers AI**
2. Binding name must be exactly: `AI` (the code reads `env.AI`)
3. Model used: `@cf/meta/llama-3.1-8b-instruct-fp8` (see `IDEAS_MODEL_ID` in `lib/ai/ideas.ts`; verified on the Workers AI free tier — no paid plan needed)

## Request contract (for reference)

- Method: `POST`, path `/api/ai/ideas`
- Header: `Authorization: Bearer <parent's Supabase access token>` — the
  Worker validates it by calling `{SUPABASE_URL}/auth/v1/user` with the anon
  key; HTTP 200 = valid parent session.
- Body (JSON):
  ```json
  { "lifeSkill": "responsibility", "ageBand": "7-9" }
  ```
  - `lifeSkill` must be one of: `responsibility`, `empathy`, `teamwork`, `leadership`, `time`
  - `ageBand` must be one of: `4-6`, `7-9`, `10-12`
  - Extra fields are ignored (the endpoint is parent-side only; it never
    accepts kid names or other kid PII)
- Rate limit: 20 requests/hour per client IP → `429` when exceeded.

## Verification checklist (after the user approves the deploy)

1. `curl -X POST https://tailtots.com/api/ai/ideas -H 'content-type: application/json' -d '{"lifeSkill":"x","ageBand":"7-9"}'` with **no** auth header → expect `401` (proves the 503 is gone).
2. Same request with a real parent `Authorization: Bearer` token and a valid
   body → expect `200` with an `ideas` array (proves the AI binding works).
3. Invalid body, e.g. `{"lifeSkill":"curiosity","ageBand":"7-9"}` with a valid
   token → expect `400` mentioning `lifeSkill`.
