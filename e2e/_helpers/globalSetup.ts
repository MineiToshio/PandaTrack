import { request, type FullConfig } from "@playwright/test";

import { captureDataBaseline } from "./dataGuard";

/**
 * Public routes hit once before the suite starts. Only unauthenticated GETs: `src/proxy.ts`
 * redirects every private prefix (`/dashboard`, `/orders`, `/stores`, `/admin`, ...) to sign-in
 * *before* the route renders, so requesting them without a session compiles the middleware and the
 * sign-in page, never the private route module. Warming what we cannot reach is not possible from
 * here without signing in, and a global sign-in would duplicate `_helpers/auth.ts` and depend on
 * credentials that may not be configured — the raised navigation timeouts in `playwright.config.ts`
 * cover the private routes instead.
 *
 * `/sign-in` is the highest-value entry: every authenticated spec starts by driving that form, so
 * its first compile would otherwise be charged to whichever spec happens to run first.
 */
const WARMUP_PATHS = [
  "/en",
  "/es",
  "/en/sign-in",
  "/es/sign-in",
  "/en/sign-up",
  "/en/forgot-password",
  "/en/terms",
  "/en/privacy",
] as const;

/** A cold `next dev` first compile plus the first Neon round-trip can take far longer than a test. */
const WARMUP_REQUEST_TIMEOUT_MS = 90_000;

const DEFAULT_BASE_URL = "http://localhost:3000";

/**
 * Precompiles the Next.js dev server's public routes before the first spec runs.
 *
 * WHY: `webServer.command` runs `next dev`, which compiles each route lazily on its first request.
 * That first compile lands *inside* whichever test touches the route first and is charged against
 * that test's navigation timeout, so a full pass used to lose a rotating handful of specs that all
 * passed on a warm re-run. Paying the compile here moves the cost out of the assertions.
 *
 * Ordering is guaranteed: Playwright runs plugin setup (the `webServer` plugin) before
 * `globalSetup`, so the server is already listening when this executes.
 *
 * This must tolerate an already-running server. `webServer.reuseExistingServer` is true outside CI,
 * so the dev server is often already warm (the owner keeps one running); the requests then just
 * return fast and this is a no-op. It also never owns the server lifecycle and never fails the run:
 * a warmup is an optimization, and turning a slow or unhappy warmup into a suite-wide abort would
 * be strictly worse than letting the specs report the real problem themselves.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  // Before anything else, and unlike the warmup below, this one DOES fail the run when it fails:
  // without a baseline the suite has no way to prove afterwards that it left the collector's real
  // data intact. See `scripts/e2e-db-baseline.ts`.
  await captureDataBaseline();

  const baseURL = config.projects[0]?.use?.baseURL ?? DEFAULT_BASE_URL;
  const context = await request.newContext({ baseURL });

  try {
    // Sequential on purpose: parallel requests make the dev server compile several routes at once
    // and each one gets a fraction of the CPU, which is slower overall than one at a time.
    for (const path of WARMUP_PATHS) {
      try {
        await context.get(path, { timeout: WARMUP_REQUEST_TIMEOUT_MS, failOnStatusCode: false });
      } catch (error) {
        // Logged, not thrown: an unreachable route is the spec's problem to report, not ours.
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[e2e warmup] skipped ${path}: ${reason}`);
      }
    }
  } finally {
    await context.dispose();
  }
}
