import { expect, test } from "@playwright/test";

test.describe("Landing critical flows", () => {
  test("landing CTA reaches the waitlist section", async ({ page }) => {
    await page.goto("/en");

    await page.getByRole("link", { name: "Join the waitlist" }).first().click();

    await expect(page).toHaveURL(/\/en#waitlist$/);
    await expect(page.getByRole("heading", { name: "You're one step away from a calmer collection." })).toBeVisible();
    await expect(page.locator("#waitlist-email")).toBeVisible();
  });
});
