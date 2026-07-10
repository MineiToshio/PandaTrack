import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";

const RETRY_ATTEMPTS = 3;
const RETRY_WAIT_MS = 250;

/**
 * The create-store form is a gated `WizardAccordion` (see `StoreForm.tsx`): only the active
 * step's fields are visible/accessible at a time, and creation mode requires completing steps
 * in order. Step 1 ("Type") has no required fields, so Continue always advances to step 2
 * ("Identity"), which holds the name/country/logo fields these specs exercise.
 * Retries the click: right after a client-side navigation, the first click can land before
 * hydration attaches the handler.
 */
async function advanceToIdentityStep(page: Page) {
  const continueButton = page.getByRole("button", { name: /^continue$/i });
  const nameField = page.getByLabel(/store name|nombre de la tienda/i);

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    await continueButton.click();

    if (await nameField.isVisible()) {
      return;
    }

    await page.waitForTimeout(RETRY_WAIT_MS);
  }

  await expect(nameField).toBeVisible({ timeout: 10_000 });
}

test.describe("Store creation flow", () => {
  test.describe.configure({ mode: "serial" });

  test("authenticated user can open create store page and see form", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores");
    await expect(page).toHaveURL(/\/en\/stores/);
    await page.getByRole("link", { name: /new store|nueva tienda/i }).click();
    await expect(page).toHaveURL(/\/en\/stores\/new/);

    await expect(page.getByRole("heading", { name: /new store/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /business|comercio/i })).toBeVisible();

    await advanceToIdentityStep(page);
    await expect(page.getByLabel(/store name|nombre de la tienda/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^continue$/i })).toBeVisible();
  });

  test("create store form shows the logo control for business stores and hides it for person stores", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores/new");

    // Business (the default type) shows the logo control on the Identity step.
    await advanceToIdentityStep(page);
    await expect(page.getByText(/business logo|logo comercial/i)).toBeVisible();

    // Back to Type, switch to Person, forward again: the logo control disappears.
    await page.getByRole("button", { name: /^back$/i }).click();
    await page.getByRole("button", { name: /individual seller|vendedor individual/i }).click();
    await advanceToIdentityStep(page);
    await expect(page.getByText(/business logo|logo comercial/i)).toHaveCount(0);

    // Back to Business: the logo control returns.
    await page.getByRole("button", { name: /^back$/i }).click();
    await page.getByRole("button", { name: /business|comercio/i }).click();
    await advanceToIdentityStep(page);
    await expect(page.getByText(/business logo|logo comercial/i)).toBeVisible();
  });

  test("create store logo preview stays square and can be reopened in the crop editor", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores/new");
    await advanceToIdentityStep(page);

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

    // `[data-slot="logo-preview"]` is the whole row (thumbnail + filename + actions); the square
    // thumbnail itself is the row's first child (see StoreLogoField.tsx).
    const preview = page.locator('[data-slot="logo-preview"]');
    await expect(preview).toBeVisible();
    await expect(page.getByRole("button", { name: /edit/i })).toBeVisible();

    const thumbnail = preview.locator(":scope > span").first();
    const previewBox = await thumbnail.boundingBox();
    expect(previewBox).not.toBeNull();
    expect(Math.abs((previewBox?.width ?? 0) - (previewBox?.height ?? 0))).toBeLessThanOrEqual(2);

    await page.getByRole("button", { name: /edit/i }).click();
    await expect(page.getByRole("dialog", { name: /adjust logo framing/i })).toBeVisible();
  });

  test("create store form validates required fields without persisting data", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores/new");
    await advanceToIdentityStep(page);

    // Attempting to continue with empty required fields blocks advancement (client-side
    // validation via `validateIdentityStep`) and marks both fields invalid: the name input is
    // natively `required` (native `:invalid`), while the country combobox is a custom
    // `SearchableSelect` that signals validity through `aria-invalid` instead.
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page).toHaveURL(/\/en\/stores\/new$/);
    await expect(page.locator("#store-name:invalid")).toBeVisible();
    await expect(page.locator('#store-country[aria-invalid="true"]')).toBeVisible();
  });
});
