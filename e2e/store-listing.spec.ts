import { expect, test } from "@playwright/test";

test.describe("Stores listing and detail", () => {
  test("stores listing redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/en/stores");

    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test("store detail redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/en/stores/any-slug");

    await expect(page).toHaveURL(/\/en\/sign-in/);
  });
});
