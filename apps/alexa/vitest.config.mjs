import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Dedicated unit-test config for the Alexa skill's handler tests.
 *
 * The skill lambda is a standalone .mjs module (it ships to AWS Lambda and
 * must not pull in the Worker/app module graph), so these tests run outside
 * the main vitest config. Run them with:
 *
 *   npm run test:alexa
 */
export default defineConfig({
  root: repoRoot,
  test: {
    include: ["apps/alexa/__tests__/**/*.test.mjs"],
    environment: "node",
  },
});
