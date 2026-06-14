import { expect, test, type Page } from "@playwright/test";
import { shouldSkipAuthenticatedE2E, signInAndLandOnDashboard } from "./_helpers/auth";

const E2E_ITEM_NAME = `E2E Delivery Item ${Date.now()}`;

function skipUnlessAuthenticatedEnv() {
  test.skip(shouldSkipAuthenticatedE2E(), "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set");
  test.skip(
    process.env.PLAYWRIGHT_PORT !== undefined && process.env.PLAYWRIGHT_PORT !== "3000",
    "Authenticated E2E uses Better Auth's local trusted origin on localhost:3000",
  );
}

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
  return page.url();
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
    await expect(page.getByRole("heading", { name: /new delivery|no eligible products/i })).toBeVisible();
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
