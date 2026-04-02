import { expect, test } from "@playwright/test";
import { shouldSkipAuthenticatedE2E, signInAndLandOnDashboard } from "./_helpers/auth";

test.describe("Store creation flow", () => {
  test.describe.configure({ mode: "serial" });

  test("authenticated user can open create store page and see form", async ({ page }) => {
    test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores");
    await expect(page).toHaveURL(/\/en\/stores/);
    await page.getByRole("link", { name: /new store|nueva tienda/i }).click();
    await expect(page).toHaveURL(/\/en\/stores\/new/);

    await expect(page.getByRole("heading", { name: /new store/i, level: 1 })).toBeVisible();
    await expect(page.getByLabel(/store name|nombre de la tienda/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create store|crear tienda/i })).toBeVisible();
  });

  test("create store form shows the logo control for business stores and hides it for person stores", async ({ page }) => {
    test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores/new");

    await expect(page.getByText(/business logo|logo comercial/i)).toBeVisible();
    await page.getByRole("button", { name: /individual seller|vendedor individual/i }).click();
    await expect(page.getByText(/business logo|logo comercial/i)).toHaveCount(0);
    await page.getByRole("button", { name: /business|comercio/i }).click();
    await expect(page.getByText(/business logo|logo comercial/i)).toBeVisible();
  });

  test("create store logo preview stays square and can be reopened in the crop editor", async ({ page }) => {
    test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores/new");

    await page.locator('input[type="file"]#store-logo').setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHv14sAAAAASUVORK5CYII=",
        "base64",
      ),
    });

    await expect(page.getByRole("dialog", { name: /adjust logo framing/i })).toBeVisible();
    await page.getByRole("button", { name: /use this crop/i }).click();

    const preview = page.locator('[data-slot="logo-preview"]');
    await expect(preview).toBeVisible();
    await expect(page.getByRole("button", { name: /edit/i })).toBeVisible();

    const previewBox = await preview.boundingBox();
    expect(previewBox).not.toBeNull();
    expect(Math.abs((previewBox?.width ?? 0) - (previewBox?.height ?? 0))).toBeLessThanOrEqual(2);

    await page.getByRole("button", { name: /edit/i }).click();
    await expect(page.getByRole("dialog", { name: /adjust logo framing/i })).toBeVisible();
  });

  test("create store form validates required fields without persisting data", async ({ page }) => {
    test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores/new");
    await page.getByRole("button", { name: /create store|crear tienda/i }).click();

    await expect(page).toHaveURL(/\/en\/stores\/new$/);
    await expect(page.locator("#store-name:invalid")).toBeVisible();
    await expect(page.locator("#store-country:invalid")).toBeVisible();
  });
});
