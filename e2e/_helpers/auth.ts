import { expect, type Page } from "@playwright/test";

const SIGN_IN_RETURN_TO_DASHBOARD = "/en/sign-in?returnTo=%2Fen%2Fdashboard";
const DASHBOARD_URL_REGEX = /\/en\/dashboard/;
const RETRY_ATTEMPTS = 3;

export function shouldSkipAuthenticatedE2E() {
  return !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD;
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
