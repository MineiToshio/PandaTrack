import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";
import { deleteOrdersById } from "./_helpers/dbCleanup";

/**
 * Orders created by the current test, tracked so `afterEach` can hard-delete them as a backstop
 * even if the test fails before its own UI-driven cleanup step runs (BR: no E2E-created rows may
 * persist in the database, see `.agents/rules/testing-strategy.mdc`).
 */
let createdOrderIds: string[] = [];

test.afterEach(async () => {
  const ids = createdOrderIds;
  createdOrderIds = [];
  await deleteOrdersById(ids);
});

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const NEW_ORDER_LABEL_REGEX = /new order/i;
/** Matches the `useIsMobile` hook's `(max-width: 767px)` media query breakpoint. */
const MOBILE_BREAKPOINT_PX = 768;

/** Only the button that is actually rendered (not just present in the DOM behind `lg:hidden` /
 *  `hidden lg:flex`) counts — the FAB and the desktop toolbar button share the same label. */
function visibleNewOrderButtons(page: Page) {
  return page.locator("button:visible", { hasText: NEW_ORDER_LABEL_REGEX });
}

/** Creates a minimal order through the create wizard and returns its detail URL. Mirrors the
 *  helper in `orders.spec.ts`, but stays viewport-aware since this spec (unlike `orders.spec.ts`,
 *  which only runs at desktop size) also runs at mobile size, where two step-1/step-2 controls
 *  render differently:
 *  - Step 1's store field: desktop is a `role="combobox"` input; mobile is a plain trigger button
 *    (`#order-store`) that opens a `MobilePicker` sheet. Clicking the field by id and picking the
 *    first `role="option"` row works for both.
 *  - Step 2's item entry: desktop renders an inline Name/Total grid; mobile replaces it with an
 *    "Add item" trigger that opens a sheet holding the same Name field. */
async function createOrderWithOneItem(page: Page): Promise<string> {
  await page.goto("/en/orders/new");
  await expect(page).toHaveURL(/\/en\/orders\/new$/);

  await page.locator("#order-store").click();
  const firstStoreOption = page.getByRole("option").first();
  await expect(firstStoreOption).toBeVisible();
  await firstStoreOption.click();
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  const isMobileViewport = (page.viewportSize()?.width ?? 0) < MOBILE_BREAKPOINT_PX;
  if (isMobileViewport) {
    await page.getByRole("button", { name: /^add item$/i }).click();
    await page.getByLabel(/^name$/i).fill(`E2E entry item ${Date.now()}`);
    await page.getByRole("button", { name: /^add$/i }).click();
  } else {
    await page
      .getByLabel(/^name$/i)
      .first()
      .fill(`E2E entry item ${Date.now()}`);
  }
  await page.getByLabel(/^total/i).fill("10.00");
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders\/(?!new)[a-z0-9]+$/i, { timeout: 15_000 });
  const url = page.url();
  createdOrderIds.push(url.split("/").pop()!);
  return url;
}

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

test.describe("Order creation entry — mobile floating button", () => {
  test("opens the selector from the Orders list and reaches the image method", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await page.setViewportSize(MOBILE_VIEWPORT);
    await signInAndLandOnDashboard(page);

    await page.goto("/en/orders");
    await expect(visibleNewOrderButtons(page)).toHaveCount(1);
    await visibleNewOrderButtons(page).click();

    const dialog = page.getByRole("dialog", { name: NEW_ORDER_LABEL_REGEX });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /from an image/i })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /by hand/i })).toBeVisible();

    await dialog.getByRole("link", { name: /from an image/i }).click();
    await expect(page).toHaveURL(/\/en\/orders\/new\/image$/);
  });

  test("opens on the Dashboard too, and the manual card reaches the wizard", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await page.setViewportSize(MOBILE_VIEWPORT);
    await signInAndLandOnDashboard(page);

    await expect(visibleNewOrderButtons(page)).toHaveCount(1);
    await visibleNewOrderButtons(page).click();

    const dialog = page.getByRole("dialog", { name: NEW_ORDER_LABEL_REGEX });
    await dialog.getByRole("link", { name: /by hand/i }).click();
    await expect(page).toHaveURL(/\/en\/orders\/new$/);
  });

  test("is absent on Stores, order detail, and inside the creation wizard", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(60_000);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await signInAndLandOnDashboard(page);

    await page.goto("/en/stores");
    await expect(visibleNewOrderButtons(page)).toHaveCount(0);

    await page.goto("/en/orders/new");
    await expect(visibleNewOrderButtons(page)).toHaveCount(0);

    const orderUrl = await createOrderWithOneItem(page);
    await expect(visibleNewOrderButtons(page)).toHaveCount(0);

    await deleteOrder(page, orderUrl);
  });
});

test.describe("Order creation entry — desktop", () => {
  test("the floating button is absent; the toolbar button opens the same selector", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await signInAndLandOnDashboard(page);

    await page.goto("/en/orders");
    // Exactly one visible "New order" control — the toolbar button, not the (CSS-hidden) FAB.
    await expect(visibleNewOrderButtons(page)).toHaveCount(1);
    await visibleNewOrderButtons(page).click();

    const dialog = page.getByRole("dialog", { name: NEW_ORDER_LABEL_REGEX });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /from an image/i })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /by hand/i })).toBeVisible();
  });
});

test.describe("Order creation entry — bridge from the manual wizard", () => {
  test("step 1 offers a discreet link into the image method", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await signInAndLandOnDashboard(page);

    await page.goto("/en/orders/new");
    await page.getByRole("link", { name: /got a screenshot\?/i }).click();
    await expect(page).toHaveURL(/\/en\/orders\/new\/image$/);
  });
});
