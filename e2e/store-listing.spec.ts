import { expect, test } from "@playwright/test";

test.describe("Stores listing and detail", () => {
  test("stores listing page loads and opens filters drawer", async ({ page }) => {
    await page.goto("/en/stores");

    await expect(page).toHaveURL(/\/en\/stores$/);
    await expect(page.getByRole("button", { name: /search|buscar/i }).first()).toBeVisible();
    await page
      .getByRole("button", { name: /search|buscar/i })
      .first()
      .click();
    await expect(page.getByPlaceholder(/search by store name|buscar por nombre de tienda/i)).toBeVisible();
  });

  test("store detail page loads at /stores/[slug]", async ({ page }) => {
    await page.goto("/en/stores/any-slug");

    await expect(page).toHaveURL(/\/en\/stores\/any-slug/);
  });
});
