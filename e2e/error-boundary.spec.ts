import { expect, test } from "@playwright/test";

test.describe("Locale error boundary", () => {
  test("a forced render error in a public route resolves to the localized destructive surface with a working retry", async ({
    page,
  }) => {
    await page.goto("/en/dev-error-boundary");

    // Filter by copy so the locator does not collide with Next's route announcer,
    // which also carries role="alert".
    const alert = page.getByRole("alert").filter({ hasText: "Something broke on our end" });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("heading", { level: 1, name: "Something broke on our end" })).toBeVisible();

    const retryButton = alert.getByRole("button", { name: "Try again" });
    await expect(retryButton).toBeVisible();
    const goHomeLink = alert.getByRole("link", { name: "Go home" });
    await expect(goHomeLink).toHaveAttribute("href", "/en");

    // Retrying re-runs the segment, which throws again, so the same destructive surface stays up.
    await retryButton.click();
    await expect(page.getByRole("alert").filter({ hasText: "Something broke on our end" })).toBeVisible();

    await goHomeLink.click();
    await expect(page).toHaveURL(/\/en$/);
  });
});
