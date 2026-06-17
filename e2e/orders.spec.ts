import { expect, test, type Page } from "@playwright/test";
import { shouldSkipAuthenticatedE2E, signInAndLandOnDashboard } from "./_helpers/auth";

const E2E_ITEM_NAME = `E2E Order Item ${Date.now()}`;

function skipUnlessAuthenticatedEnv() {
  test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
  test.skip(
    process.env.PLAYWRIGHT_PORT !== undefined && process.env.PLAYWRIGHT_PORT !== "3000",
    "Authenticated E2E uses Better Auth's local trusted origin on localhost:3000",
  );
}

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
  await page
    .getByRole("button", { name: /^change$|^cambiar$/i })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: /change base currency|cambiar moneda base/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("option", { name: new RegExp(targetCode) }).click();
  await dialog.getByRole("button", { name: /save without updating|guardar sin actualizar/i }).click();
  await expect(dialog).toBeHidden();
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

    // 2. Read the current base (USD/EUR) from the currency modal, then switch to the other.
    await page.goto("/en/settings");
    const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();
    await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();
    await page
      .getByRole("button", { name: /^change$|^cambiar$/i })
      .first()
      .click();
    const curDialog = page.getByRole("dialog", { name: /change base currency|cambiar moneda base/i });
    await expect(curDialog).toBeVisible();
    const usdSelected = (await curDialog.getByRole("option", { name: /USD/ }).getAttribute("aria-selected")) === "true";
    const originalCode = usdSelected ? "USD" : "EUR";
    const newBaseCode = usdSelected ? "EUR" : "USD";
    await curDialog.getByRole("option", { name: new RegExp(newBaseCode) }).click();
    await curDialog.getByRole("button", { name: /save without updating|guardar sin actualizar/i }).click();
    await expect(curDialog).toBeHidden();

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
