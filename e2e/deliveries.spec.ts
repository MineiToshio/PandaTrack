import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";
import { deleteDeliveriesById, deleteOrdersById } from "./_helpers/dbCleanup";

const E2E_ITEM_NAME = `E2E Delivery Item ${Date.now()}`;

/**
 * Orders/deliveries created by the current test, tracked so `afterEach` can hard-delete them as a
 * backstop even if the test fails before reaching its own UI-driven cleanup step (BR: no
 * E2E-created rows may persist in the database, see `.agents/rules/testing-strategy.mdc`).
 */
let createdOrderIds: string[] = [];
let createdDeliveryIds: string[] = [];

test.afterEach(async () => {
  const orderIds = createdOrderIds;
  const deliveryIds = createdDeliveryIds;
  createdOrderIds = [];
  createdDeliveryIds = [];
  await deleteDeliveriesById(deliveryIds);
  await deleteOrdersById(orderIds);
});

/** Creates a minimal order through the create wizard and returns its detail URL. */
async function createOrderWithOneItem(page: Page): Promise<string> {
  await page.goto("/en/orders/new");
  await expect(page).toHaveURL(/\/en\/orders\/new/);

  // Step 1 — store (first option in the combobox), currency + date are prefilled.
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

  // Step 3 — confirm. `(?!new)` so the assertion waits for the detail redirect
  // instead of matching the wizard's own /orders/new URL.
  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
  const url = page.url();
  createdOrderIds.push(url.split("/").pop()!);
  return url;
}

/** Deletes the current entity through the type-to-confirm destructive modal. */
async function confirmTypeToDelete(page: Page, dialogName: RegExp, confirmButton: RegExp) {
  const dialog = page.getByRole("alertdialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("delete");
  await dialog.getByRole("button", { name: confirmButton }).click();
}

test.describe("Delivery create flow", () => {
  test("standalone delivery create redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/en/deliveries/new");

    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test("authenticated user can open the standalone delivery create route", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await signInAndLandOnDashboard(page);

    await page.goto("/en/deliveries/new");

    await expect(page).toHaveURL(/\/en\/deliveries\/new/);
    // The app shell header shows the page title as plain text (not a heading), so the page's own
    // h1 is the only heading in the document; scoped to main anyway for clarity.
    await expect(
      page.getByRole("main").getByRole("heading", { name: /new delivery|no eligible products/i }),
    ).toBeVisible();
  });
});

test.describe("Delivery lifecycle journey", () => {
  test.describe.configure({ mode: "serial" });

  test("create from order, mark delivered, and clean up", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(120_000);
    await signInAndLandOnDashboard(page);

    // 1. Seed: an order with one eligible product (cleaned up at the end).
    const orderUrl = await createOrderWithOneItem(page);

    // 2. Create-from-order entry: the wizard starts at step 2 with the product preselected.
    await page
      .getByRole("link", { name: /create delivery/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/deliveries\/new\?sourceOrderId=/);
    await expect(page.getByText(/1 product selected/i)).toBeVisible();
    await expect(page.getByText(E2E_ITEM_NAME).first()).toBeVisible();
    await page
      .getByRole("button", { name: /^continue$/i })
      .first()
      .click();

    // 3. Step 3 keeps the prefilled date; shipping cost is required (no default 0).
    // Base currency needs no FX.
    await page.getByLabel(/shipping cost/i).fill("12.00");
    await page
      .getByRole("button", { name: /^continue$/i })
      .first()
      .click();

    // 4. Confirm — review lists the product, then create.
    await expect(page.getByText(/or press ⌘ Enter/i)).toBeVisible();
    await page
      .getByRole("button", { name: /create delivery/i })
      .last()
      .click();

    // 5. Lands on the delivery detail in transit.
    await expect(page).toHaveURL(/\/en\/deliveries\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
    const deliveryUrl = page.url();
    createdDeliveryIds.push(deliveryUrl.split("/").pop()!);
    await expect(page.getByText(/in transit/i).first()).toBeVisible();

    // 6. Mark as delivered (received date defaults to today) — optimistic flip.
    await page
      .getByRole("button", { name: /mark as delivered/i })
      .first()
      .click();
    const markDialog = page.getByRole("dialog", { name: /mark as delivered/i });
    await expect(markDialog).toBeVisible();
    await markDialog.getByRole("button", { name: /mark as delivered/i }).click();
    await expect(page.getByText(/delivery received/i)).toBeVisible();

    // 7. Source order status re-derived to COMPLETED (single product delivered).
    // The optimistic modal closes before the server transaction commits, so poll
    // with reloads until the server-rendered order page reflects the new status.
    await expect(async () => {
      await page.goto(orderUrl);
      await expect(page.getByText(/^completed$/i).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // 8. Cleanup — reopen (delivered cannot be deleted, BR-08-07), then delete the delivery.
    await page.goto(deliveryUrl);
    await page
      .getByRole("button", { name: /reopen delivery/i })
      .first()
      .click();
    await expect(page.getByText(/in transit/i).first()).toBeVisible();
    await page
      .getByRole("button", { name: /delete delivery/i })
      .first()
      .click();
    await confirmTypeToDelete(page, /delete delivery/i, /delete delivery/i);
    await expect(page).toHaveURL(/\/en\/deliveries(\?.*)?$/, { timeout: 15_000 });

    // 9. Cleanup — delete the seeded order.
    await page.goto(orderUrl);
    await page
      .getByRole("button", { name: /delete order/i })
      .first()
      .click();
    await confirmTypeToDelete(page, /delete order/i, /delete order/i);
    await expect(page).toHaveURL(/\/en\/orders(\?.*)?$/, { timeout: 15_000 });
  });
});

/** Creates a two-item order through the wizard and returns its detail URL. The order-level total
 *  covers both items; no per-item unit price is needed, mirroring `createOrderWithOneItem` above. */
async function createOrderWithTwoItems(page: Page, item1: string, item2: string): Promise<string> {
  await page.goto("/en/orders/new");
  await expect(page).toHaveURL(/\/en\/orders\/new/);

  // Step 1 — store (first option), currency + date are prefilled.
  await page.getByRole("combobox").first().click();
  const firstStoreOption = page.getByRole("option").first();
  await expect(firstStoreOption).toBeVisible();
  await firstStoreOption.click();
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  // Step 2 — two named items ("Add item" appends a second row) + order-level total.
  await page
    .getByLabel(/^name$/i)
    .first()
    .fill(item1);
  await page.getByRole("button", { name: /^add item$/i }).click();
  await page
    .getByLabel(/^name$/i)
    .nth(1)
    .fill(item2);
  await page.getByLabel(/^total/i).fill("25.00");
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  // Step 3 — confirm.
  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
  const url = page.url();
  createdOrderIds.push(url.split("/").pop()!);
  return url;
}

/** Marks the delivery currently shown on its detail page as delivered (received date defaults to
 *  today), the same optimistic flip the single-item journey above exercises. */
async function markCurrentDeliveryAsDelivered(page: Page) {
  await page
    .getByRole("button", { name: /mark as delivered/i })
    .first()
    .click();
  const markDialog = page.getByRole("dialog", { name: /mark as delivered/i });
  await expect(markDialog).toBeVisible();
  await markDialog.getByRole("button", { name: /mark as delivered/i }).click();
  await expect(page.getByText(/delivery received/i)).toBeVisible();
}

/** Reopens (delivered orders cannot be deleted, BR-08-07) then deletes the delivery currently shown
 *  on its detail page. */
async function reopenAndDeleteCurrentDelivery(page: Page) {
  await page
    .getByRole("button", { name: /reopen delivery/i })
    .first()
    .click();
  await expect(page.getByText(/in transit/i).first()).toBeVisible();
  await page
    .getByRole("button", { name: /delete delivery/i })
    .first()
    .click();
  await confirmTypeToDelete(page, /delete delivery/i, /delete delivery/i);
  await expect(page).toHaveURL(/\/en\/deliveries(\?.*)?$/, { timeout: 15_000 });
}

test.describe("Split shipment across two deliveries", () => {
  test.describe.configure({ mode: "serial" });

  test("delivering one product at a time carries the order through PARTIALLY_DELIVERED before it completes", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    // 1. Seed: a two-item order.
    const stamp = Date.now();
    const itemA = `E2E Split Item A ${stamp}`;
    const itemB = `E2E Split Item B ${stamp}`;
    const orderUrl = await createOrderWithTwoItems(page, itemA, itemB);

    // 2. First delivery, from the order: both products preselect, then uncheck item B so only
    // item A ships (the real wizard flow with a partial preselection, `sourceOrderId` plus an
    // explicit deselection, rather than a fixture that starts with one item).
    await page
      .getByRole("link", { name: /create delivery/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/deliveries\/new\?sourceOrderId=/);
    await expect(page.getByText(/2 products selected/i)).toBeVisible();
    await page.getByRole("checkbox", { name: new RegExp(itemB, "i") }).click();
    await expect(page.getByText(/1 product selected/i)).toBeVisible();
    await expect(page.getByText(itemA).first()).toBeVisible();
    await page
      .getByRole("button", { name: /^continue$/i })
      .first()
      .click();

    await page.getByLabel(/shipping cost/i).fill("5.00");
    await page
      .getByRole("button", { name: /^continue$/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /create delivery/i })
      .last()
      .click();

    await expect(page).toHaveURL(/\/en\/deliveries\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
    const firstDeliveryUrl = page.url();
    createdDeliveryIds.push(firstDeliveryUrl.split("/").pop()!);
    await expect(page.getByText(/in transit/i).first()).toBeVisible();

    // 3. Mark the first delivery delivered; the source order re-derives to PARTIALLY_DELIVERED
    // because item B has not shipped yet.
    await markCurrentDeliveryAsDelivered(page);
    await expect(async () => {
      await page.goto(orderUrl);
      await expect(page.getByText(/^partially delivered$/i).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // 4. Second delivery, from the same order: item A already shipped is no longer eligible, so
    // only item B preselects — no deselection needed this time.
    await page
      .getByRole("link", { name: /create delivery/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/deliveries\/new\?sourceOrderId=/);
    await expect(page.getByText(/1 product selected/i)).toBeVisible();
    await expect(page.getByText(itemB).first()).toBeVisible();
    await expect(page.getByText(itemA).first()).toHaveCount(0);
    await page
      .getByRole("button", { name: /^continue$/i })
      .first()
      .click();

    await page.getByLabel(/shipping cost/i).fill("5.00");
    await page
      .getByRole("button", { name: /^continue$/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /create delivery/i })
      .last()
      .click();

    await expect(page).toHaveURL(/\/en\/deliveries\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
    const secondDeliveryUrl = page.url();
    createdDeliveryIds.push(secondDeliveryUrl.split("/").pop()!);
    await expect(page.getByText(/in transit/i).first()).toBeVisible();

    // 5. Mark the second delivery delivered; every item has now arrived, so the order completes
    // exactly like the single-item journey does.
    await markCurrentDeliveryAsDelivered(page);
    await expect(async () => {
      await page.goto(orderUrl);
      await expect(page.getByText(/^completed$/i).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // 6. Cleanup — reopen and delete both deliveries, then the seeded order.
    await page.goto(firstDeliveryUrl);
    await reopenAndDeleteCurrentDelivery(page);
    await page.goto(secondDeliveryUrl);
    await reopenAndDeleteCurrentDelivery(page);
    await page.goto(orderUrl);
    await page
      .getByRole("button", { name: /delete order/i })
      .first()
      .click();
    await confirmTypeToDelete(page, /delete order/i, /delete order/i);
    await expect(page).toHaveURL(/\/en\/orders(\?.*)?$/, { timeout: 15_000 });
  });
});
