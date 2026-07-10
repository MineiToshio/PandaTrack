import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Load the same local env files Next.js loads (.env, then .env.local overriding it) so gitignored
// overrides like `PLAYWRIGHT_PORT` and `BETTER_AUTH_EXTRA_ORIGINS` reach both this config and the
// spec files (Better Auth's trusted-origin check lives in `e2e/_helpers/auth.ts`).
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
// Use localhost so auth (getAppBaseUrl()) and tests share the same origin; 127.0.0.1 would break cookies/redirects.
const HOST = process.env.PLAYWRIGHT_HOST ?? "localhost";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  retries: 0,
  reporter: process.env.CI ? [["line"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
