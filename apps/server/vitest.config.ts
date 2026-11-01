import { defineConfig } from "vitest/config";

// Must be set before `tests/global-setup.ts` and `src/config/env.ts` are imported
// so the suite always targets TEST_DATABASE_URL.
process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
  },
});
