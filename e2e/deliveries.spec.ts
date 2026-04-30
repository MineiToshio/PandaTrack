import { expect, test } from "@playwright/test";
import { shouldSkipAuthenticatedE2E, signInAndLandOnDashboard } from "./_helpers/auth";

test.describe("Delivery create flow", () => {
  test("standalone delivery create redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/en/deliveries/new");

    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test("authenticated user can open the standalone delivery create route", async ({ page }) => {
    test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
    test.skip(
      process.env.PLAYWRIGHT_PORT !== undefined && process.env.PLAYWRIGHT_PORT !== "3000",
      "Authenticated E2E uses Better Auth's local trusted origin on localhost:3000",
    );
    await signInAndLandOnDashboard(page);

    await page.goto("/en/deliveries/new");

    await expect(page).toHaveURL(/\/en\/deliveries\/new/);
    await expect(page.getByRole("heading", { name: /new delivery|no eligible products/i, level: 1 })).toBeVisible();
  });
});
