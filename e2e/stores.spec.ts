import { expect, test } from "@playwright/test";

test.describe("Store creation flow", () => {
  test("authenticated user can open create store page and see form", async ({ page }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set",
    );

    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);

    await page.goto("/en/stores");
    await expect(page).toHaveURL(/\/en\/stores/);
    await page.getByRole("link", { name: /new store|nueva tienda/i }).click();
    await expect(page).toHaveURL(/\/en\/stores\/new/);

    await expect(page.getByRole("heading", { name: /new store/i })).toBeVisible();
    await expect(page.getByLabel(/store name|nombre de la tienda/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create store|crear tienda/i })).toBeVisible();
  });

  test("authenticated user can create a store and is redirected to store detail with pending disclaimer", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set",
    );

    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.locator('input[name="password"]').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);

    await page.goto("/en/stores/new");
    await page.getByLabel(/store name|nombre de la tienda/i).fill(`E2E Store ${Date.now()}`);
    await page.locator("#store-country").selectOption("ES");
    await page.getByRole("button", { name: /manga/i }).click();
    await page.getByRole("button", { name: /create store|crear tienda/i }).click();

    await expect(page).toHaveURL(/\/en\/store\/.+/);
    await expect(page.getByText(/store pending review|tienda pendiente de revisión/i)).toBeVisible();
  });
});
