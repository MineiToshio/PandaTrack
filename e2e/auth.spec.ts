import { expect, test } from "@playwright/test";

test.describe("Auth critical flows", () => {
  test("dashboard access redirects unauthenticated users to sign-in and preserves returnTo", async ({ page }) => {
    await page.goto("/en/dashboard?from=e2e");

    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=%2Fen%2Fdashboard%3Ffrom%3De2e$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("sign-in shows inline validation and exposes password recovery entry", async ({ page }) => {
    await page.goto("/en/sign-in");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator('p[role="alert"]')).toContainText("Invalid email or password.");

    await page.getByRole("link", { name: "Forgot your password?" }).click();

    await expect(page).toHaveURL("/en/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  });

  test("forgot-password success feedback is shown after the auth endpoint succeeds", async ({ page }) => {
    await page.route("**/api/auth/request-password-reset", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto("/en/forgot-password");
    await page.getByLabel("Email").fill("collector@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByRole("status")).toContainText(
      "If this email exists in our system, check your inbox for the reset link.",
    );
  });

  test("sign-up maps an existing-account auth error to the localized message", async ({ page }) => {
    await page.route("**/api/auth/sign-up/email", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          code: "USER_ALREADY_EXISTS",
          message: "User already exists. Use another email.",
        }),
      });
    });

    await page.goto("/en/sign-up");
    await page.getByLabel("Email").fill("collector@example.com");
    await page.locator('input[name="password"]').fill("correct horse battery staple");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page.locator('p[role="alert"]')).toContainText("An account with this email already exists.");
  });
});
