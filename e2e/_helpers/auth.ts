import { test, expect, type Page } from "@playwright/test";
import { getUserRole } from "./dbQuery";

const SIGN_IN_RETURN_TO_DASHBOARD = "/en/sign-in?returnTo=%2Fen%2Fdashboard";
const DASHBOARD_URL_REGEX = /\/en\/dashboard/;
const RETRY_ATTEMPTS = 3;

// Better Auth's default local origin (see `trustedOrigins` in src/lib/auth/auth.ts). Playwright
// runs on this port when `PLAYWRIGHT_PORT` is unset, so it is always trusted without extra config.
const BETTER_AUTH_DEFAULT_TRUSTED_PORT = "3000";

export function shouldSkipAuthenticatedE2E() {
  return !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD;
}

/**
 * Authenticated specs sign in through Better Auth, which rejects requests from origins outside
 * `trustedOrigins`. Playwright's configured port is trusted when it matches Better Auth's default
 * local origin (3000) or when the dev-only `BETTER_AUTH_EXTRA_ORIGINS` env var (loaded from
 * `.env.local`, consumed by src/lib/auth/auth.ts) lists `http://localhost:<port>` explicitly.
 */
export function isAuthenticatedPortTrusted() {
  const port = process.env.PLAYWRIGHT_PORT ?? BETTER_AUTH_DEFAULT_TRUSTED_PORT;
  if (port === BETTER_AUTH_DEFAULT_TRUSTED_PORT) {
    return true;
  }

  const extraOrigins = (process.env.BETTER_AUTH_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return extraOrigins.includes(`http://localhost:${port}`);
}

/** Skips the current test unless the E2E user is configured and the Playwright port is trusted by Better Auth. */
export function skipUnlessAuthenticatedEnv() {
  test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
  test.skip(
    !isAuthenticatedPortTrusted(),
    "Authenticated E2E requires PLAYWRIGHT_PORT to be Better Auth's default (3000) or listed in BETTER_AUTH_EXTRA_ORIGINS",
  );
}

/**
 * The dashboard URL appears as soon as the redirect commits, while the navigation is still in
 * flight. Returning at that point lets a caller's own `page.goto` interrupt it, so the sign-in
 * is only complete once the dashboard has finished loading.
 */
async function settleOnDashboard(page: Page) {
  // `waitForURL` resolves the moment the client-side route change lands, which is BEFORE the
  // dashboard document has rendered, and `waitForLoadState("load")` can then resolve against the
  // load event the previous document already fired. The helper therefore returned while a
  // navigation to the dashboard was still in flight, and the `page.goto(...)` a caller issues on
  // the very next line raced it: "Navigation to /en/orders/new is interrupted by another
  // navigation to /en/dashboard". It reproduced on `main` with no product change involved.
  //
  // Waiting for the private shell's own `<main>` proves a fresh document actually rendered, so the
  // navigation is finished rather than merely addressed.
  await page.waitForLoadState("load");
  await expect(page.locator("main#main-content")).toBeVisible({ timeout: 15_000 });
}

/**
 * Skips the current test unless `E2E_USER_EMAIL` really is a NON-admin account.
 *
 * The two specs that assert what an ordinary collector cannot reach sign in as that account. It was
 * an ordinary collector until it was granted the `admin` role (2026-08-22, the production cutover),
 * and from that moment both tests failed on assertions that were entirely correct about a fixture
 * that no longer matched them. A test that cannot pass is a test everyone learns to scroll past, so
 * this states the requirement instead: the skip reason names the cause and the fix.
 *
 * Restoring the coverage is a configuration change, not a code one: point `E2E_USER_EMAIL` at an
 * account without the role (`E2E_ADMIN_EMAIL` already covers the admin side of these same flows).
 */
export async function skipUnlessConfiguredUserIsNonAdmin() {
  const email = process.env.E2E_USER_EMAIL;
  if (!email) return;
  const role = await getUserRole(email);
  test.skip(
    role === "admin",
    `E2E_USER_EMAIL (${email}) carries the admin role, so it cannot exercise the non-admin gate. ` +
      "Point it at an account without the role to restore this test.",
  );
}

/** True when the dedicated admin E2E account is not configured. Admin moderation specs skip then. */
export function shouldSkipAdminE2E() {
  return !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD;
}

/** Skips the current test unless the admin E2E account is configured and the port is trusted. */
export function skipUnlessAdminEnv() {
  test.skip(shouldSkipAdminE2E(), "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set");
  test.skip(
    !isAuthenticatedPortTrusted(),
    "Authenticated E2E requires PLAYWRIGHT_PORT to be Better Auth's default (3000) or listed in BETTER_AUTH_EXTRA_ORIGINS",
  );
}

async function signInWithCredentialsAndLandOnDashboard(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(SIGN_IN_RETURN_TO_DASHBOARD);
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill(password);
  const submitButton = page.locator('form button[type="submit"]');

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });

    const dashboardReachedPromise = page
      .waitForURL(DASHBOARD_URL_REGEX, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    try {
      await submitButton.click();
    } catch {
      // If the form unmounts because navigation succeeded, click can throw while still being a success.
      if (page.url().match(DASHBOARD_URL_REGEX)) {
        await settleOnDashboard(page);
        return;
      }
      throw new Error("E2E sign-in submit click failed before reaching dashboard");
    }

    const dashboardReached = await dashboardReachedPromise;
    if (dashboardReached || page.url().match(DASHBOARD_URL_REGEX)) {
      await settleOnDashboard(page);
      return;
    }

    const alert = page.locator('p[role="alert"]');
    if (await alert.isVisible()) {
      const alertMessage = (await alert.textContent()) ?? "Unknown sign-in error";
      throw new Error(`E2E sign-in failed: ${alertMessage}`);
    }
  }

  await expect(page).toHaveURL(DASHBOARD_URL_REGEX, { timeout: 10_000 });
}

export async function signInAndLandOnDashboard(page: Page) {
  await signInWithCredentialsAndLandOnDashboard(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
}

/** Signs in as the dedicated administrator account (durable admin role) and lands on the dashboard. */
export async function signInAsAdmin(page: Page) {
  await signInWithCredentialsAndLandOnDashboard(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);
}
