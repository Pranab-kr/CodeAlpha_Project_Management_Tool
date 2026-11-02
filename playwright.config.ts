import { defineConfig, devices } from "@playwright/test";

const PORT = 4100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// Test-only secret; never used outside the Playwright server process.
const E2E_JWT_SECRET = "e2e-only-secret-at-least-32-characters-long";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm start",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      PORT: String(PORT),
      SERVE_CLIENT: "true",
      COOKIE_SECURE: "false",
      TEST_DATABASE_URL:
        "postgres://teamboard:teamboard@localhost:5432/teamboard_test",
      JWT_SECRET: E2E_JWT_SECRET,
      APP_ORIGIN: BASE_URL,
      LOG_LEVEL: "warn",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
