import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";

const E2E_ITEM_NAME = `E2E Order Item ${Date.now()}`;

/** Creates a minimal order through the create wizard (in the account's base currency) and
 *  returns its detail URL. Mirrors the helper in `deliveries.spec.ts`. */
async function createOrderWithOneItem(page: Page): Promise<string> {
  await page.goto("/en/orders/new");
  await expect(page).toHaveURL(/\/en\/orders\/new/);

  // Step 1 — store (first option in the combobox); currency + date are prefilled.
  await page.getByRole("combobox").first().click();
  const firstStoreOption = page.getByRole("option").first();
  await expect(firstStoreOption).toBeVisible();
  await firstStoreOption.click();
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  // Step 2 — one named item + total.
  await page
    .getByLabel(/^name$/i)
    .first()
    .fill(E2E_ITEM_NAME);
  await page.getByLabel(/^total/i).fill("10.00");
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  // Step 3 — confirm; `(?!new)` waits for the detail redirect, not the wizard URL.
  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
  return page.url();
}

/** Cancels the order currently shown on its detail page (confirmation alertdialog). */
async function cancelCurrentOrder(page: Page) {
  await page
    .getByRole("button", { name: /^cancel order$/i })
    .first()
    .click();
  const dialog = page.getByRole("alertdialog", { name: /cancel order/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^cancel order$/i }).click();
  await expect(dialog).toBeHidden();
}

/** Deletes the order via the type-to-confirm destructive modal and lands back on the list. */
async function deleteOrder(page: Page, orderUrl: string) {
  await page.goto(orderUrl);
  await page
    .getByRole("button", { name: /delete order/i })
    .first()
    .click();
  const dialog = page.getByRole("alertdialog", { name: /delete order/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("delete");
  await dialog.getByRole("button", { name: /delete order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders(\?.*)?$/, { timeout: 15_000 });
}

/** Opens the currency modal in Settings → Preferences, switches the base currency, and saves
 *  without updating rates (Path B — still flags affected orders). Returns nothing. */
async function changeBaseCurrency(page: Page, targetCode: string) {
  await page.goto("/en/settings");
  const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();
  await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();
  await page.getByRole("button", { name: /base currency|moneda base/i }).click();
  await page.getByRole("option", { name: new RegExp(`^${targetCode}`) }).click();
  await page.getByRole("button", { name: /^save$|^guardar$/i }).click();
  // Wait on "Cancel" disappearing — its label is stable, so it only clears once the server action
  // resolves (the "Save" label flips to "Saving…" mid-flight, which would signal completion early).
  await expect(page.getByRole("button", { name: /^cancel$|^cancelar$/i })).toHaveCount(0, { timeout: 15_000 });
}

test.describe("Orders route protection", () => {
  test("the order create route redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/en/orders/new");

    await expect(page).toHaveURL(/\/en\/sign-in/);
  });
});

test.describe("Order edit lifecycle guard", () => {
  test.describe.configure({ mode: "serial" });

  test("a cancelled order cannot be edited until it is reactivated", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(120_000);
    await signInAndLandOnDashboard(page);

    const orderUrl = await createOrderWithOneItem(page);

    // While active, the edit route serves the form (no redirect).
    await page.goto(`${orderUrl}/edit`);
    await expect(page).toHaveURL(/\/edit$/);

    // Cancel the order, then wait until it lands server-side (the modal closes optimistically
    // before the transaction commits, so poll the server-rendered detail for the cancelled hero).
    await page.goto(orderUrl);
    await cancelCurrentOrder(page);
    await expect(async () => {
      await page.goto(orderUrl);
      await expect(page.getByText(/cancelled on/i).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // Guard: opening the edit route redirects back to detail. Start from a neutral page so a
    // failure to redirect can't be mistaken for an already-correct URL; tolerate the ERR_ABORTED
    // Playwright reports while following the server redirect, then assert the settled URL.
    await page.goto("/en/dashboard");
    await page.goto(`${orderUrl}/edit`).catch(() => {});
    await expect(page).toHaveURL(orderUrl, { timeout: 10_000 });

    // Reactivate; wait until it commits (the cancelled hero disappears), then edit serves again.
    await page.goto(orderUrl);
    await page
      .getByRole("button", { name: /reactivate order/i })
      .first()
      .click();
    await expect(async () => {
      await page.goto(orderUrl);
      await expect(page.getByText(/cancelled on/i)).toHaveCount(0, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await page.goto(`${orderUrl}/edit`);
    await expect(page).toHaveURL(/\/edit$/);

    // Cleanup.
    await deleteOrder(page, orderUrl);
  });
});

test.describe("Order FX reconciliation flag", () => {
  test.describe.configure({ mode: "serial" });

  test("changing the base currency flags orders, and reconciling clears them", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(120_000);
    await signInAndLandOnDashboard(page);

    // 1. Seed an order in the account's current base currency.
    const orderUrl = await createOrderWithOneItem(page);
    const orderId = orderUrl.split("/").pop()!;

    // 2. Read the current base from the inline currency select, then switch to a different one and
    //    confirm with "Save" (explicit-confirm, no modal).
    await page.goto("/en/settings");
    const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();
    await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();
    const currencySelect = page.getByRole("button", { name: /base currency|moneda base/i });
    await expect(currencySelect).toBeVisible();
    // The trigger label reads "USD — US dollar"; the leading 3 chars are the current base code.
    const originalCode = ((await currencySelect.textContent()) ?? "").trim().slice(0, 3).toUpperCase();
    const newBaseCode = originalCode === "USD" ? "EUR" : "USD";
    await currencySelect.click();
    await page.getByRole("option", { name: new RegExp(`^${newBaseCode}`) }).click();
    await page.getByRole("button", { name: /^save$|^guardar$/i }).click();
    // "Cancel" clears only once the server action resolves (stable label, unlike "Save" → "Saving…").
    await expect(page.getByRole("button", { name: /^cancel$|^cancelar$/i })).toHaveCount(0, { timeout: 15_000 });
    // The conditional "reconcile rates" shortcut appears because the seeded order is now foreign.
    await expect(page.getByRole("link", { name: /update rates|actualizar tasas/i })).toBeVisible({ timeout: 15_000 });

    // 3. The seeded order (now in a foreign currency) is flagged: the FX banner appears and
    //    the order shows under the `fxPending` filter.
    // The FX banner renders in two responsive slots (one hidden per breakpoint), so scope to
    // the visible one.
    await page.goto("/en/orders");
    await expect(
      page
        .getByText(/outdated exchange rate/i)
        .filter({ visible: true })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.goto("/en/orders?fxPending=true");
    // The card link is an inset overlay (visually "covered"), so assert DOM presence.
    await expect(page.locator(`a[href*="/orders/${orderId}"]`).first()).toBeAttached({ timeout: 15_000 });

    // 3b. Per-order indicators: a warning chip on the order detail and an inline warning on its edit form.
    await page.goto(orderUrl);
    await expect(page.getByText(/FX update pending/i).first()).toBeVisible({ timeout: 15_000 });
    await page.goto(`${orderUrl}/edit`);
    await expect(page.getByText(/may be outdated/i).first()).toBeVisible({ timeout: 15_000 });

    // 4. Reconcile the originalCode → newBaseCode pair through the modal (back on the list, where
    //    the banner CTA lives — 3b navigated away to the detail/edit surfaces).
    await page.goto("/en/orders?fxPending=true");
    await page
      .getByRole("button", { name: /^update exchange rates$/i })
      .filter({ visible: true })
      .first()
      .click();
    const fxDialog = page.getByRole("dialog", { name: /update exchange rates/i });
    await expect(fxDialog).toBeVisible();
    const pairGroup = fxDialog
      .getByRole("listitem")
      .filter({ hasText: new RegExp(`1\\s*${originalCode}\\s*=\\s*\\?\\s*${newBaseCode}`, "i") })
      .first();
    await pairGroup.getByPlaceholder("0.00").fill("1.10");
    await fxDialog.getByRole("button", { name: /apply to \d+ order/i }).click();
    await expect(page.getByText(/exchange rates updated/i)).toBeVisible({ timeout: 15_000 });

    // 5. The seeded order has left the FX-pending set (flag cleared on reconcile).
    await expect(async () => {
      await page.goto("/en/orders?fxPending=true");
      await expect(page.locator(`a[href*="/orders/${orderId}"]`)).toHaveCount(0, { timeout: 2_000 });
    }).toPass({ timeout: 15_000 });

    // 6. Cleanup — delete the order and restore the original base currency.
    await deleteOrder(page, orderUrl);
    await changeBaseCurrency(page, originalCode);
  });
});
