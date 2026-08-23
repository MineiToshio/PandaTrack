import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";
import { deleteDeliveriesById, deleteOrdersById } from "./_helpers/dbCleanup";
import { expandStoreGroups } from "./_helpers/storeGroups";

const E2E_ITEM_NAME = `E2E Order Item ${Date.now()}`;

/**
 * Orders created by the current test, tracked so `afterEach` can hard-delete them as a backstop
 * even if the test fails before reaching its own UI-driven cleanup step (BR: no E2E-created rows
 * may persist in the database, see `.agents/rules/testing-strategy.mdc`).
 */
let createdOrderIds: string[] = [];

/** Also restore this if a test changes it and fails before undoing the change itself. */
let baseCurrencyToRestore: string | null = null;

/**
 * A `Delivery` has no FK to `Order` (it links through `DeliveryOrderItem`), so deleting the seed
 * orders leaves it behind as an orphan. Anything a test logs an arrival for goes in here.
 */
let createdDeliveryIds: string[] = [];

test.afterEach(async ({ page }) => {
  if (baseCurrencyToRestore) {
    const codeToRestore = baseCurrencyToRestore;
    baseCurrencyToRestore = null;
    await changeBaseCurrency(page, codeToRestore).catch(() => {});
  }
  if (createdDeliveryIds.length > 0) {
    const ids = createdDeliveryIds;
    createdDeliveryIds = [];
    await deleteDeliveriesById(ids);
  }
  if (createdOrderIds.length > 0) {
    const ids = createdOrderIds;
    createdOrderIds = [];
    await deleteOrdersById(ids);
  }
});

/** Creates a minimal order through the create wizard and returns its detail URL. Mirrors the
 *  helper in `deliveries.spec.ts`.
 *  `itemName` lets a spec create two orders it can tell apart in the "Por tienda" list.
 *  `fx` overrides the prefilled base currency (and optionally supplies the rate the wizard offers
 *  for a foreign currency) — the FX spec uses it to keep its blast radius off the account's real
 *  orders. */
async function createOrderWithOneItem(
  page: Page,
  itemName: string = E2E_ITEM_NAME,
  fx?: { currencyCode: string; exchangeRate?: string },
): Promise<string> {
  await page.goto("/en/orders/new");
  await expect(page).toHaveURL(/\/en\/orders\/new/);

  // Step 1 — store (first option in the combobox); currency + date are prefilled.
  await page.getByRole("combobox").first().click();
  const firstStoreOption = page.getByRole("option").first();
  await expect(firstStoreOption).toBeVisible();
  await firstStoreOption.click();
  if (fx) {
    // The closed field is a button; clicking it swaps in the combobox input under the same id.
    await page.locator("#order-currency").click();
    await page.locator("#order-currency").fill(fx.currencyCode);
    await page.getByRole("option", { name: new RegExp(`^${fx.currencyCode}`) }).click();
  }
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  // Step 2 — one named item + total.
  await page
    .getByLabel(/^name$/i)
    .first()
    .fill(itemName);
  await page.getByLabel(/^total/i).fill("10.00");
  if (fx?.exchangeRate) {
    await page.locator("#order-exchange-rate").fill(fx.exchangeRate);
  }
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  // Step 3 — confirm; `(?!new)` waits for the detail redirect, not the wizard URL.
  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
  const url = page.url();
  createdOrderIds.push(url.split("/").pop()!);
  return url;
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

    // 1. Read the current base from the inline currency select before touching anything.
    await page.goto("/en/settings");
    const tablist = page.getByRole("tablist", { name: /settings sections|secciones de ajustes/i }).first();
    await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();
    const currencySelect = page.getByRole("button", { name: /base currency|moneda base/i });
    await expect(currencySelect).toBeVisible();
    // The trigger label reads "USD — US dollar"; the leading 3 chars are the current base code.
    const originalCode = ((await currencySelect.textContent()) ?? "").trim().slice(0, 3).toUpperCase();
    const newBaseCode = originalCode === "USD" ? "EUR" : "USD";
    // The seed currency must be one the account's real orders never use. The reconciliation modal
    // groups every pending order into per-currency-pair cards and applies a rate to a whole pair
    // at once, so this test may only ever fill the pair that contains nothing but its own seeded
    // order. Filling the account's own pair once mass-stamped a placeholder rate onto every real
    // base-currency order in the dev database — that incident is why this list avoids PEN and USD
    // and why step 5 refuses to apply to more than one order.
    const seedCurrencyCode = ["GBP", "JPY", "CLP"].find(
      (code) => code !== originalCode && code !== newBaseCode,
    ) as string;

    // 2. Seed an order in that third currency, already reconciled against the current base (the
    //    wizard offers the rate field for a foreign currency). Pending must appear BECAUSE the
    //    base changes in step 3, not because the order was born rateless.
    const orderUrl = await createOrderWithOneItem(page, E2E_ITEM_NAME, {
      currencyCode: seedCurrencyCode,
      exchangeRate: "5.00",
    });
    const orderId = orderUrl.split("/").pop()!;

    // 3. Switch the base currency and confirm with "Save" (explicit-confirm, no modal).
    await page.goto("/en/settings");
    await tablist.getByRole("tab", { name: /preferences|preferencias/i }).click();
    await currencySelect.click();
    await page.getByRole("option", { name: new RegExp(`^${newBaseCode}`) }).click();
    await page.getByRole("button", { name: /^save$|^guardar$/i }).click();
    // "Cancel" clears only once the server action resolves (stable label, unlike "Save" → "Saving…").
    await expect(page.getByRole("button", { name: /^cancel$|^cancelar$/i })).toHaveCount(0, { timeout: 15_000 });
    // Base currency is real account state, not disposable test data — track it so `afterEach`
    // restores it even if a later assertion in this test fails.
    baseCurrencyToRestore = originalCode;
    // The conditional "reconcile rates" shortcut appears because the seeded order is now foreign.
    await expect(page.getByRole("link", { name: /update rates|actualizar tasas/i })).toBeVisible({ timeout: 15_000 });

    // 4. The seeded order (now stamped against a stale base) is flagged: the FX banner appears
    //    and the order shows under the `fxPending` filter.
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

    // 4b. Per-order indicators: a warning chip on the order detail and an inline warning on its edit form.
    await page.goto(orderUrl);
    await expect(page.getByText(/FX update pending/i).first()).toBeVisible({ timeout: 15_000 });
    await page.goto(`${orderUrl}/edit`);
    await expect(page.getByText(/may be outdated/i).first()).toBeVisible({ timeout: 15_000 });

    // 5. Reconcile the seedCurrencyCode → newBaseCode pair through the modal (back on the list,
    //    where the banner CTA lives — 4b navigated away to the detail/edit surfaces). ONLY that
    //    pair: the account's own pair (its real orders, also pending after the base switch) must
    //    never be filled, and the apply CTA must count exactly the one seeded order before it is
    //    pressed — if it ever counts more, failing here is the guard against a mass write.
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
      .filter({ hasText: new RegExp(`1\\s*${seedCurrencyCode}\\s*=\\s*\\?\\s*${newBaseCode}`, "i") })
      .first();
    await pairGroup.getByPlaceholder("0.00").fill("1.10");
    await fxDialog.getByRole("button", { name: /^apply to 1 order$/i }).click();
    await expect(page.getByText(/exchange rates updated/i)).toBeVisible({ timeout: 15_000 });

    // 6. The seeded order has left the FX-pending set (flag cleared on reconcile).
    await expect(async () => {
      await page.goto("/en/orders?fxPending=true");
      await expect(page.locator(`a[href*="/orders/${orderId}"]`)).toHaveCount(0, { timeout: 2_000 });
    }).toPass({ timeout: 15_000 });

    // 7. Cleanup — delete the order and restore the original base currency (afterEach is only the
    //    backstop for a failure above; the happy path restores inline so state is right immediately).
    await deleteOrder(page, orderUrl);
    await changeBaseCurrency(page, originalCode);
    baseCurrencyToRestore = null;
  });
});

/**
 * The toolbar's canonical control order — every breakpoint/view renders a subsequence of it.
 *
 * "group" still applies from `lg` up. Below `lg` the chooser is not a toolbar control at all any
 * more: it renders in the app header (`FR-05-71`), which is why the scan below is scoped to the
 * toolbar row rather than to the document.
 */
const TOOLBAR_CANONICAL_ORDER = ["search", "filter", "sort", "group", "new"] as const;

/**
 * Reads the visible toolbar controls' left edges in DOM order and maps each to its canonical
 * name. Matches the desktop `Select` sort trigger via its stable id, and the "Group by" control
 * (desktop `Select` or the mobile compact pill) via its aria-label, since only one of the two
 * variants is visible (`offsetParent !== null`) at a time.
 */
function readToolbarControlOrder(page: Page) {
  return page.evaluate(() => {
    const isVisible = (el: Element) => (el as HTMLElement).offsetParent !== null;
    // Scoped to the toolbar row itself. A document-wide scan would pick up the header's own view
    // chooser below `lg` and report it as a toolbar control sitting out of canonical order.
    const row = [...document.querySelectorAll("div")].find(
      (d) =>
        d.className === "hidden items-center gap-2 lg:flex" ||
        d.className.startsWith("sticky top-14 z-30 -mx-4 flex items-center gap-2"),
    );
    if (!row) return [];
    const search = [...row.querySelectorAll('[role="search"]')].find(isVisible);
    const buttons = [...row.querySelectorAll("button")].filter(isVisible);
    const filter = buttons.find((b) => (b.getAttribute("aria-label") || "").toLowerCase().includes("filter"));
    const sort = [...row.querySelectorAll("#orders-sort, #orders-sort-mobile")].find(isVisible);
    const group = buttons.find((b) => /group by/i.test(b.getAttribute("aria-label") || ""));
    const newOrder = buttons.find((b) => /new order/i.test(b.textContent || ""));

    const found: { key: string; left: number }[] = [];
    if (search) found.push({ key: "search", left: search.getBoundingClientRect().left });
    if (filter) found.push({ key: "filter", left: filter.getBoundingClientRect().left });
    if (sort) found.push({ key: "sort", left: sort.getBoundingClientRect().left });
    if (group) found.push({ key: "group", left: group.getBoundingClientRect().left });
    if (newOrder) found.push({ key: "new", left: newOrder.getBoundingClientRect().left });
    found.sort((a, b) => a.left - b.left);
    return found.map((f) => f.key);
  });
}

/** The visible toolbar row's rendered height — desktop (`lg:flex`) or mobile (sticky row). */
function readToolbarRowHeight(page: Page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll("div")];
    const row = rows.find(
      (d) =>
        d.className === "hidden items-center gap-2 lg:flex" ||
        d.className.startsWith("sticky top-14 z-30 -mx-4 flex items-center gap-2"),
    );
    return row ? row.getBoundingClientRect().height : null;
  });
}

/**
 * The visible "Group by" control's right edge — the desktop `Select` or the mobile compact pill.
 * The right edge, not the left, is the control's actual x-position invariant by design: both
 * variants are the last `shrink-0` item in a row whose earlier flex-1 sibling (Sort on mobile,
 * the `ml-auto` cluster on desktop) absorbs any width change, so the right edge is what's pinned
 * regardless of view. The left edge can drift a sub-pixel amount between "By order"/"By store" (or
 * "Pedido"/"Tienda") on the desktop `Select` — different glyph widths measured by its own
 * width-sizer, a pre-existing `Select` characteristic out of scope here — without the control
 * actually having moved.
 */
function readGroupByRight(page: Page) {
  return page.evaluate(() => {
    const byId = document.getElementById("orders-group-by");
    if (byId && (byId as HTMLElement).offsetParent !== null) return byId.getBoundingClientRect().right;
    const button = [...document.querySelectorAll("button")].find(
      (b) => (b as HTMLElement).offsetParent !== null && /group by/i.test(b.getAttribute("aria-label") || ""),
    );
    return button ? button.getBoundingClientRect().right : null;
  });
}

test.describe("Orders toolbar layout", () => {
  test("keeps a single-line toolbar with the canonical control order across breakpoints", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    const viewports = [
      { width: 1440, height: 900 },
      { width: 1280, height: 900 },
      { width: 1024, height: 900 },
      { width: 375, height: 800 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/en/orders");

      // The row renders on a single line — never the 3-line wrap the old flex-wrap layout produced
      // at `lg` widths.
      const rowHeight = await readToolbarRowHeight(page);
      expect(rowHeight, `toolbar row exists at ${viewport.width}px`).not.toBeNull();
      expect(rowHeight as number, `toolbar row height at ${viewport.width}px`).toBeLessThanOrEqual(56);

      // The visible controls, left-to-right, are a SUBSEQUENCE of the canonical order — never a
      // permutation (a control that doesn't apply at this breakpoint/view is simply absent, the
      // controls that remain keep their relative order).
      const rendered = await readToolbarControlOrder(page);
      let lastIndex = -1;
      for (const key of rendered) {
        const index = TOOLBAR_CANONICAL_ORDER.indexOf(key as (typeof TOOLBAR_CANONICAL_ORDER)[number]);
        expect(index, `"${key}" is a recognized toolbar control at ${viewport.width}px`).toBeGreaterThan(-1);
        expect(
          index,
          `toolbar control order is a subsequence of the canonical order at ${viewport.width}px`,
        ).toBeGreaterThan(lastIndex);
        lastIndex = index;
      }

      // Below `lg` the chooser leaves the toolbar for the app header (`FR-05-71`), which is what
      // gave the search back the 94px that used to truncate its placeholder mid-word.
      // VISIBLE in the header, not merely mounted there. The slot is `lg:hidden`, and a portal
      // still renders its children into a `display:none` container, so an existence check would
      // report the chooser as present at every width.
      const inHeader = await page.evaluate(() =>
        Boolean(
          [...(document.querySelector("header")?.querySelectorAll("button") ?? [])].find(
            (b) =>
              (b as HTMLElement).offsetParent !== null && /group by/i.test(b.getAttribute("aria-label") || ""),
          ),
        ),
      );
      if (viewport.width < 1024) {
        expect(inHeader, `Group by renders in the app header at ${viewport.width}px`).toBe(true);
        expect(rendered, `the mobile toolbar carries no Group by at ${viewport.width}px`).not.toContain("group");
      } else {
        expect(inHeader, `Group by stays out of the header at ${viewport.width}px`).toBe(false);
      }
    }
  });

  test("pins Group by's x position regardless of the active view, at desktop and mobile widths", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 800 },
    ]) {
      await page.setViewportSize(viewport);

      await page.goto("/en/orders");
      const orderViewRight = await readGroupByRight(page);
      expect(orderViewRight, `Group by is visible at ${viewport.width}px (order view)`).not.toBeNull();

      await page.goto("/en/orders?view=store");
      const storeViewRight = await readGroupByRight(page);
      expect(storeViewRight, `Group by is visible at ${viewport.width}px (store view)`).not.toBeNull();

      expect(
        Math.abs((orderViewRight as number) - (storeViewRight as number)),
        `Group by x position stays within 2px between views at ${viewport.width}px`,
      ).toBeLessThanOrEqual(2);
    }
  });
});

test.describe("Store view batch arrival", () => {
  test("marks two products of different orders as arrived in one delivery", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    // Two orders, same store (the wizard always picks the combobox's first option), one product
    // each: the shape the whole feature exists for, and the one the modal has to name as a single
    // delivery spanning several orders (`FR-08-38` / `BR-08-12`).
    const stamp = Date.now();
    const firstItem = `E2E Batch A ${stamp}`;
    const secondItem = `E2E Batch B ${stamp}`;
    await createOrderWithOneItem(page, firstItem);
    await createOrderWithOneItem(page, secondItem);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/en/orders?view=store");
    await expandStoreGroups(page);
    await expect(page.getByText(firstItem).first()).toBeVisible({ timeout: 15_000 });

    // The tile is a real checkbox named after its product; both trees render, so take the first.
    await page
      .getByRole("checkbox", { name: `Select ${firstItem}` })
      .first()
      .check();
    await page
      .getByRole("checkbox", { name: `Select ${secondItem}` })
      .first()
      .check();

    const bar = page.getByRole("toolbar", { name: /Actions for the selected products/i });
    await expect(bar).toBeVisible();
    await expect(bar.getByText(/2 products from 2 orders/i)).toBeVisible();

    await bar.getByRole("button", { name: /Log the arrival of the selected products/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The count and the list are the confirmation contract, and the notice is what warns that one
    // delivery is about to hold products from two orders.
    await expect(dialog.getByText(/A single delivery will be created/i)).toBeVisible();
    await dialog.getByRole("button", { name: /Log the arrival of 2 products/i }).click();

    // Optimistic Confirmation: the dialog dismisses on submit and the rows leave on the spot.
    await expect(page.getByText(firstItem)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText(secondItem)).toHaveCount(0);

    // Follow the success toast to the delivery it created, both to prove one row was written for
    // the pair and to learn the id `afterEach` has to delete (nothing else links it to the orders).
    await page.getByRole("button", { name: /view delivery/i }).click();
    await expect(page).toHaveURL(/\/en\/deliveries\/[a-z0-9]+$/i, { timeout: 15_000 });
    createdDeliveryIds.push(page.url().split("/").pop()!);
    await expect(page.getByText(firstItem).first()).toBeVisible();
    await expect(page.getByText(secondItem).first()).toBeVisible();
  });
});
