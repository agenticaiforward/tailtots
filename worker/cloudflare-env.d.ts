/**
 * Cloudflare Workers environment bindings for TailTots.
 *
 * `@cloudflare/workers-types` ships an empty `Cloudflare.Env` interface that
 * projects extend by redeclaration; TypeScript merges the declarations.
 * Keep this file in sync with the bindings in `wrangler.toml` /
 * `.openai/hosting.json` (currently: the D1 database bound as `DB`,
 * plus the Workers AI binding as `AI`).
 */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    AI: Ai;
  }
}
