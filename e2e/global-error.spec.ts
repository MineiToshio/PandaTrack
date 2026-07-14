import { expect, test } from "@playwright/test";

test.describe("Global error fallback", () => {
  test("the self-contained bilingual fallback renders with a working retry", async ({ page }) => {
    await page.goto("/dev-global-error");

    // Filter by copy so the locator does not collide with Next's route announcer,
    // which also carries role="alert".
    const alert = page.getByRole("alert").filter({ hasText: "Algo se rompió" });
    await expect(alert).toBeVisible();
    await expect(alert.locator('[lang="es"]').first()).toContainText("rompió");
    await expect(alert.locator('[lang="en"]').first()).toContainText("broke");

    const retryButton = alert.getByRole("button");
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    // The dev harness always throws the same forced error, so the fallback stays up after retry.
    await expect(page.getByRole("alert").filter({ hasText: "Algo se rompió" })).toBeVisible();
  });
});

test.describe("Root-scope 404", () => {
  test("a non-locale URL redirects to the default-locale surface instead of the framework default 404", async ({
    page,
  }) => {
    const response = await page.goto("/this-path-has-no-locale-prefix");

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.getByText("This page could not be found.")).toHaveCount(0);
  });
});
