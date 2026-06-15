import { expect, test } from "@playwright/test";

test.describe("Landing go-live funnel", () => {
  test("hero primary CTA navigates to sign-up", async ({ page }) => {
    await page.goto("/en");

    await page.getByRole("link", { name: "Create free account" }).first().click();

    await expect(page).toHaveURL(/\/en\/sign-up$/);
  });

  test("header sign-in link navigates to sign-in", async ({ page }) => {
    await page.goto("/en");

    await page.getByRole("link", { name: "Sign in", exact: true }).first().click();

    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test("FAQ accordion opens the first item by default and toggles others", async ({ page }) => {
    await page.goto("/en");

    const firstTrigger = page.getByRole("button", { name: "Is PandaTrack free?" });
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");

    const secondTrigger = page.getByRole("button", { name: "Does it work with any store?" });
    await expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

    await secondTrigger.click();

    await expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
  });

  test("no waitlist form remains on the landing", async ({ page }) => {
    await page.goto("/en");

    await expect(page.locator("#waitlist-email")).toHaveCount(0);
  });
});
