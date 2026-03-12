import { expect, test } from "@playwright/test";

test.describe("Auth critical flows", () => {
  test("dashboard access redirects unauthenticated users to sign-in and preserves returnTo", async ({ page }) => {
    await page.goto("/en/dashboard?from=e2e");

    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=%2Fen%2Fdashboard%3Ffrom%3De2e$/);
    await expect(page.locator("form")).toBeVisible();
  });

  test("sign-in shows inline validation and exposes password recovery entry", async ({ page }) => {
    await page.goto("/en/sign-in");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator('p[role="alert"]')).toBeVisible();

    await page.locator('a[href="/en/forgot-password"]').click();

    await expect(page).toHaveURL("/en/forgot-password");
    await expect(page.locator("#forgot-password-email")).toBeVisible();
  });

  test("forgot-password success stays neutral and repeated local retries are throttled", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/auth/request-password-reset", async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto("/en/forgot-password");
    await page.getByLabel("Email").fill("collector@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("status")).not.toContainText("wait");
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeEnabled();

    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByRole("status")).toContainText("wait");
    expect(requestCount).toBe(1);
  });

  test("reset-password renders the invalid-link recovery state", async ({ page }) => {
    await page.goto("/en/reset-password?error=INVALID_TOKEN");

    await expect(page.getByRole("heading", { level: 1, name: "This reset link is not valid" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Request another reset link" })).toHaveAttribute(
      "href",
      "/en/forgot-password",
    );
  });

  test("reset-password accepts a valid token and shows the success state", async ({ page }) => {
    await page.route("**/api/auth/reset-password", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto("/en/reset-password?token=valid-token");
    await page.getByLabel("New password").fill("new-password-123");
    await page.getByRole("button", { name: "Update password" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Password updated" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Go to sign in" })).toBeVisible();
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

    await expect(page.locator('p[role="alert"]')).toBeVisible();
  });
});
