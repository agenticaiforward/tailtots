import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["lib/__tests__/**/*.test.ts", "app/components/tailtots/__tests__/**/*.test.ts"],
  },
});
