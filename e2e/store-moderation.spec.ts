import { expect, test, type Page } from "@playwright/test";
import {
  signInAndLandOnDashboard,
  signInAsAdmin,
  skipUnlessAdminEnv,
  skipUnlessAuthenticatedEnv,
} from "./_helpers/auth";

const CONTINUE = /^(continue|continuar)$/i;
const STORE_DETAIL_URL = /\/en\/stores\/[a-z0-9-]+$/;
const HYDRATION_RETRY_MS = 250;

/**
 * Walks the create-store wizard for a BUSINESS (RETAILER) seller and lands on the new store's
 * detail page. A store created by a non-admin lands as `PENDING`; one created by an admin lands as
 * `APPROVED`. Returns the created store's detail URL.
 */
async function createBusinessStoreAndOpenDetail(page: Page, name: string): Promise<string> {
  await page.goto("/en/stores/new");

  // Step 1 (Type) — RETAILER is the default; advance. Retry the first click (can precede hydration).
  const nameField = page.getByLabel(/store name|nombre de la tienda/i);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole("button", { name: CONTINUE }).first().click();
    if (await nameField.isVisible()) break;
    await page.waitForTimeout(HYDRATION_RETRY_MS);
  }
  await expect(nameField).toBeVisible({ timeout: 10_000 });

  // Step 2 (Identity) — name + country are required.
  await nameField.fill(name);
  await page.locator("#store-country").click();
  await page.getByRole("combobox").fill("Peru");
  await page
    .getByRole("option", { name: /peru|perú/i })
    .first()
    .click();
  await page.getByRole("button", { name: CONTINUE }).first().click();

  // Step 3 (Catalog) — at least one product type and one presence.
  await page.getByRole("button", { name: /^manga$/i }).click();
  await page.getByRole("button", { name: /online store|tienda online/i }).click();
  await page.getByRole("button", { name: CONTINUE }).first().click();

  // Step 4 (Channels) — optional; advance.
  await page.getByRole("button", { name: CONTINUE }).first().click();

  // Step 5 (Review) — submit.
  await page.getByRole("button", { name: /create store|crear tienda/i }).click();

  // A duplicate-warning modal only appears when a similar name already exists; the timestamped name
  // avoids it, but confirm defensively if it shows.
  const confirmAnyway = page.getByRole("button", { name: /create anyway|crear de todos modos|crear igual/i });
  if (await confirmAnyway.isVisible().catch(() => false)) {
    await confirmAnyway.click();
  }

  await expect(page).toHaveURL(STORE_DETAIL_URL, { timeout: 15_000 });
  return page.url();
}

/**
 * Files one open report on the store detail page currently shown, then reloads so the governance
 * banner (which only renders when the store has reports) appears. Any signed-in user can report.
 */
async function fileOpenReport(page: Page): Promise<void> {
  await page.getByRole("button", { name: /report store/i }).click();
  const reportDialog = page.getByRole("dialog", { name: /report/i });
  await expect(reportDialog).toBeVisible();
  await reportDialog.getByRole("radio", { name: /spam or scam/i }).click();
  await reportDialog.getByRole("button", { name: /save report/i }).click();
  // The modal shows an inline success status; close it and reload to surface the governance banner.
  await expect(reportDialog.getByRole("status")).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.reload();
}

test.describe("Store moderation", () => {
  test.describe.configure({ mode: "serial" });

  test("a non-admin does not see the moderation panel", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await createBusinessStoreAndOpenDetail(page, `E2E Mod NonAdmin ${Date.now()}`);

    // AC-04-30 signal: moderation controls are gated; a non-admin sees none of them.
    await expect(page.getByRole("button", { name: /approve store/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /remove store/i })).toHaveCount(0);
  });

  test("an admin approves a pending community store (AC-04-20)", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    skipUnlessAdminEnv();

    // A non-admin creates the store, so it lands PENDING.
    await signInAndLandOnDashboard(page);
    const detailUrl = await createBusinessStoreAndOpenDetail(page, `E2E Mod Approve ${Date.now()}`);

    // The admin then approves it from the same detail page.
    await signInAsAdmin(page);
    await page.goto(detailUrl);

    const approveButton = page.getByRole("button", { name: /approve store/i });
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // Optimistic: the approve control disappears once the store is APPROVED.
    await expect(approveButton).toHaveCount(0, { timeout: 10_000 });
  });

  test("an admin flags then unflags a store, toggling the flagged banner (AC-04-23)", async ({ page }) => {
    skipUnlessAdminEnv();
    await signInAsAdmin(page);

    await createBusinessStoreAndOpenDetail(page, `E2E Mod Flag ${Date.now()}`);

    await page.getByRole("button", { name: /flag with reports/i }).click();
    // FLAGGED stays visible with a stronger warning banner.
    await expect(page.getByText(/store with reports/i).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /remove reports flag/i }).click();
    await expect(page.getByText(/store with reports/i)).toHaveCount(0, { timeout: 10_000 });
  });

  test("an admin removes a store via the removal modal (AC-04-21)", async ({ page }) => {
    skipUnlessAdminEnv();
    await signInAsAdmin(page);

    await createBusinessStoreAndOpenDetail(page, `E2E Mod Remove ${Date.now()}`);

    await page.getByRole("button", { name: /remove store/i }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // Pick a neutral reason, then confirm.
    await dialog.getByRole("radio", { name: /duplicate store/i }).click();
    await dialog.getByRole("button", { name: /remove store/i }).click();

    // The removed store leaves every public surface, so the admin is routed back to the listing.
    await expect(page).toHaveURL(/\/en\/stores(\/)?(\?.*)?$/, { timeout: 15_000 });
  });

  test("an admin resolves an open report from the governance panel (AC-04-24)", async ({ page }) => {
    skipUnlessAdminEnv();
    await signInAsAdmin(page);

    await createBusinessStoreAndOpenDetail(page, `E2E Report Resolve ${Date.now()}`);
    await fileOpenReport(page);

    await page.getByRole("button", { name: /view summary/i }).click();
    const summaryDialog = page.getByRole("dialog", { name: /reports and suggestions/i });
    await expect(summaryDialog).toBeVisible();

    // The admin-only open-reports section exposes the raw detail and the reporter identity.
    await expect(summaryDialog.getByText(/reported by @/i)).toBeVisible();

    const resolveButton = summaryDialog.getByRole("button", { name: /^resolve$/i }).first();
    await expect(resolveButton).toBeVisible();
    await resolveButton.click();

    // Optimistic: the resolved row leaves the list immediately; the modal stays open.
    await expect(summaryDialog.getByRole("button", { name: /^resolve$/i })).toHaveCount(0, { timeout: 10_000 });
    await expect(summaryDialog).toBeVisible();
  });

  test("an admin dismisses an open report from the governance panel (AC-04-24)", async ({ page }) => {
    skipUnlessAdminEnv();
    await signInAsAdmin(page);

    await createBusinessStoreAndOpenDetail(page, `E2E Report Dismiss ${Date.now()}`);
    await fileOpenReport(page);

    await page.getByRole("button", { name: /view summary/i }).click();
    const summaryDialog = page.getByRole("dialog", { name: /reports and suggestions/i });
    await expect(summaryDialog).toBeVisible();

    const dismissButton = summaryDialog.getByRole("button", { name: /^dismiss$/i }).first();
    await expect(dismissButton).toBeVisible();
    await dismissButton.click();

    await expect(summaryDialog.getByRole("button", { name: /^dismiss$/i })).toHaveCount(0, { timeout: 10_000 });
  });

  test("a non-admin does not see the admin open-reports section (AC-04-25)", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await createBusinessStoreAndOpenDetail(page, `E2E Report NonAdmin ${Date.now()}`);
    await fileOpenReport(page);

    await page.getByRole("button", { name: /view summary/i }).click();
    const summaryDialog = page.getByRole("dialog", { name: /reports and suggestions/i });
    await expect(summaryDialog).toBeVisible();

    // BR-04-25: the reporter identity and the admin resolve control never reach a non-admin viewer.
    await expect(summaryDialog.getByText(/reported by @/i)).toHaveCount(0);
    await expect(summaryDialog.getByRole("button", { name: /^resolve$/i })).toHaveCount(0);
  });
});
