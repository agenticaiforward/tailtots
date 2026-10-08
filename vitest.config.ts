import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Dedicated unit-test config for `lib/` pure helpers.
 *
 * The main `vite.config.ts` cannot be used: the Cloudflare Vite plugin
 * rejects vitest's `resolve.external` for the "rsc" environment, so plain
 * `npx vitest run` dies in a startup error. Run unit tests explicitly with:
 *
 *   npx vitest run --config vitest.config.ts
 *
 * This config is only for tests — it does not affect `vinext dev/build`.
 */
const repoRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": repoRoot,
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
