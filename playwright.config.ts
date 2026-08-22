import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Load the same local env files Next.js loads (.env, then .env.local overriding it) so gitignored
// overrides like `PLAYWRIGHT_PORT` and `BETTER_AUTH_EXTRA_ORIGINS` reach both this config and the
// spec files (Better Auth's trusted-origin check lives in `e2e/_helpers/auth.ts`).
loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: true, quiet: true });

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
// Use localhost so auth (getAppBaseUrl()) and tests share the same origin; 127.0.0.1 would break cookies/redirects.
const HOST = process.env.PLAYWRIGHT_HOST ?? "localhost";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // Precompiles the dev server's public routes before the first spec. See the WHY in that file:
  // `next dev` compiles routes lazily, and an uncompiled route makes the first test that touches it
  // pay the compile out of its own timeout budget.
  globalSetup: "./e2e/_helpers/globalSetup.ts",
  // Fails the run if the suite deleted or modified any row that existed before it started. The dev
  // database holds the collector's real imported history, not fixtures. See `e2e/_helpers/dataGuard.ts`.
  globalTeardown: "./e2e/_helpers/globalTeardown.ts",
  // Timeouts below are sized for `next dev`, not for a production build. `webServer` runs
  // `npm run dev`, so a route's first request pays a Turbopack compile *plus* the first Neon
  // round-trip for every query the route's server components issue (the `(app)` layout alone
  // fans out to about eight). The previous 15s navigation budget was under that cost, which is
  // why a full pass lost 4-6 rotating specs that all passed on a warm re-run. These are
  // infrastructure budgets: no assertion is weakened, a genuinely broken route still fails.
  timeout: 90_000,
  expect: {
    // Client-side transitions also trigger a first compile, and the assertion that follows the
    // click (`toHaveURL`, `toBeVisible`) is charged here rather than to `navigationTimeout`.
    timeout: 15_000,
  },
  // One retry so a cold-compile miss self-heals instead of failing a full pass. It also makes
  // `trace: "on-first-retry"` below actually produce a trace, which `retries: 0` never could.
  // A retry never hides a deterministic product bug: that fails on the retry too.
  retries: 1,
  // Explicit and unlimited locally so a full pass always reaches the last spec. Two known
  // failures (`admin-shell`, `store-moderation`) come from the shared E2E account holding the
  // administrator role, not from the code under test; they must keep running and keep failing
  // loudly without cutting the run short. CI keeps a cap so a systemically broken branch stops
  // burning runner minutes. NOTE: 0 means unlimited in Playwright, and unlimited was already the
  // default — this is documentation of intent, not a behavior change. The real reason a local
  // pass never reached the end is wall-clock, not a failure count; see docs/development/testing.md.
  maxFailures: process.env.CI ? 10 : 0,
  reporter: process.env.CI ? [["line"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
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
