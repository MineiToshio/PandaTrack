import { test, expect, type Page } from "@playwright/test";

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

export async function signInAndLandOnDashboard(page: Page) {
  await page.context().clearCookies();
  await page.goto(SIGN_IN_RETURN_TO_DASHBOARD);
  await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.E2E_USER_PASSWORD!);
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
      if (page.url().match(DASHBOARD_URL_REGEX)) return;
      throw new Error("E2E sign-in submit click failed before reaching dashboard");
    }

    const dashboardReached = await dashboardReachedPromise;
    if (dashboardReached || page.url().match(DASHBOARD_URL_REGEX)) {
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
