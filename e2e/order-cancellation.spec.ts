import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";
import { deleteStoresByNamePrefix } from "./_helpers/dbCleanup";
import { getStoreSnapshotByNamePrefix } from "./_helpers/dbQuery";

/**
 * Order cancellation's payments choice: "lost" (money stays declared against the now-cancelled
 * order, which is what the dashboard reads as sunk) versus "credit" (the declaration is dropped, so
 * the same money becomes unassigned at the store). Covers the audit gap left by
 * `e2e/orders.spec.ts`'s `cancelCurrentOrder` helper, which only ever accepts the modal's default
 * choice and never exercises the payments-choice radio at all.
 *
 * Every fixture here is a store this spec creates for itself (never one of the collector's real
 * ones), following the same run-unique NAME PREFIX convention as `store-reconciliation.spec.ts`:
 * the slug is only readable once the create wizard's redirect lands, so a failure before that would
 * otherwise leave a public store behind. `Store` cascades to its orders/payments on delete.
 */

// Shared prefix every fixture store starts with, purely for readability in the dev DB; the real
// cleanup key is `currentStoreName` below. Each TEST computes its own store name fresh at run time
// (never a module-level constant): the dashboard assertions read an ACCOUNT-WIDE figure (the
// collector's real "Lost on cancelled" total), so a retry that reused a still-uncleaned fixture
// name would double-count the failed attempt's contribution into its own before/after diff.
const STORE_PREFIX = `E2E Cancel Payments Store ${Date.now()}`;

/**
 * The current test's own fixture store name, tracked so `afterEach` can hard-delete it even when
 * the test fails mid-way (`.agents/rules/testing-strategy.mdc`: cleanup must run from `afterEach`,
 * never only as the last synchronous step inside the test body — a failed diff assertion here would
 * otherwise skip an inline delete and leave the fixture polluting the very account-wide figure the
 * NEXT attempt, or the other test in this file, reads as its own "before" baseline).
 */
let currentStoreName: string | null = null;

test.afterEach(async () => {
  const name = currentStoreName;
  currentStoreName = null;
  if (name) await deleteStoresByNamePrefix(name);
});

/** Creates the spec's own store through the create wizard. Returns its slug from the detail URL.
 *  Mirrors `store-reconciliation.spec.ts`'s helper of the same name. */
async function createFixtureStore(page: Page, name: string): Promise<string> {
  await page.goto("/en/stores/new");

  // Step 1 — Type. "Retailer" is the default and needs no interaction.
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Step 2 — Identity: name + country.
  await page.getByLabel(/store name|nombre de la tienda/i).fill(name);
  await page.locator("#store-country").click();
  await page.getByRole("option", { name: /peru/i }).first().click();
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Step 3 — Categories: at least one product type and at least one presence.
  await page.locator('[data-field="productTypeKeys"] button[aria-pressed]').first().click();
  await page.locator('[data-field="presenceTypes"] button[aria-pressed]').first().click();
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Step 4 — Channels: entirely optional.
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Step 5 — Review and confirm.
  await page.getByRole("button", { name: /^create store$/i }).click();

  await expect(page).toHaveURL(/\/en\/stores\/(?!new$)[a-z0-9-]+$/i, { timeout: 20_000 });
  const slug = page.url().split("/").pop()!;
  expect(slug).not.toBe("new");
  return slug;
}

/** Creates a single-item order in `storeName` with total (and unit price) `price`, e.g. "50.00".
 *  Mirrors `store-reconciliation.spec.ts`'s helper of the same name, so the order attaches to the
 *  spec's own fixture store rather than the account's real first store. */
async function createFixtureOrder(page: Page, storeName: string, itemName: string, price: string): Promise<string> {
  await page.goto("/en/orders/new");

  const storeField = page.locator("#order-store");
  await storeField.click();
  await storeField.fill(storeName);
  await page
    .getByRole("option", { name: new RegExp(storeName, "i") })
    .first()
    .click();
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  await page
    .getByLabel(/^name$/i)
    .first()
    .fill(itemName);
  await page
    .getByLabel(/^unit price$/i)
    .first()
    .fill(price);
  await page.getByLabel(/^total/i).fill(price);
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders\/(?!new)[a-z0-9]+$/i, { timeout: 20_000 });
  return page.url();
}

/** Records a full payment of `amount` against `orderUrl` through the order detail's own inline
 *  payment panel (no product breakdown on a single-item order, so the submission is Optimistic
 *  Confirmation and the panel closes before the server commits). Polls the hero's own "Allocated"
 *  readout on a fresh navigation until the server has actually persisted the allocation, since the
 *  cancel mutation this spec exercises next reads the database directly, not the client's
 *  optimistic patch. */
async function recordFullPayment(page: Page, orderUrl: string, amount: string): Promise<void> {
  await page.goto(orderUrl);
  await page.getByRole("button", { name: /^record payment$/i }).click();
  await page.getByLabel(/^amount$/i).fill(amount);
  await page
    .locator("form")
    .filter({ has: page.getByLabel(/^amount$/i) })
    .getByRole("button", { name: /^record/i })
    .click();

  await expect(async () => {
    await page.goto(orderUrl);
    await expect(page.getByText(/^allocated /i).first()).toContainText(amount, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

/** Cancels the order currently shown on its detail page, picking `choice` in the payments-choice
 *  radio the modal renders because the order carries payments (`hasPayments`). Unlike
 *  `orders.spec.ts`'s plain `cancelCurrentOrder`, which never touches the radio and so only ever
 *  exercises the modal's default ("credit"). `handleConfirm` awaits the server action before
 *  closing (not Optimistic Confirmation), so the dialog going hidden means the cancellation, and
 *  whichever payments disposition was chosen, already committed. */
async function cancelOrderWithPaymentsChoice(page: Page, choice: "lost" | "credit"): Promise<void> {
  await page
    .getByRole("button", { name: /^cancel order$/i })
    .first()
    .click();
  const dialog = page.getByRole("alertdialog", { name: /cancel order/i });
  await expect(dialog).toBeVisible();

  // The radio's own `<input>` is visually hidden (`sr-only`) behind a decorative circle indicator
  // that sits on top of it, so `getByRole("radio").click()` targets a point Playwright reports as
  // covered and times out. Clicking the visible label TEXT instead is unobstructed and still
  // toggles the input: the text is a descendant of the same `<label>`, so the browser's native
  // label-for-control delegation fires the `onChange` exactly as a real click would.
  const radioText = choice === "lost" ? /count it as lost/i : /keep it as credit/i;
  await dialog.getByText(radioText).click();

  await dialog.getByRole("button", { name: /^cancel order$/i }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

/** The dashboard's own "Lost on cancelled" line, in minor units, or 0 when the line does not
 *  render at all (`lostOnCancelled.totalMinor > 0` is what gates it). The dev database carries the
 *  collector's real cancelled-order history, so this spec reads the figure BEFORE and AFTER its own
 *  cancellation and asserts on the DIFFERENCE rather than an absolute total. */
async function readLostOnCancelledMinor(page: Page): Promise<number> {
  await page.goto("/en/dashboard");
  // The route has its own `loading.tsx` skeleton while the async Server Component awaits its data
  // (`Promise.all` of several DB reads); a plain `page.goto` can settle DURING that skeleton, which
  // reads as "no note" (0) even though the real figure has not rendered yet. Wait for the Cash
  // zone's own always-present label first, so a read never races the loading state.
  await expect(page.getByText(/due this month/i).first()).toBeVisible({ timeout: 20_000 });
  const note = page.getByText(/paid on cancelled orders and never got back/i);
  if ((await note.count()) === 0) return 0;
  const text = (await note.first().textContent()) ?? "";
  const match = text.match(/[\d,]+\.\d{2}/);
  if (!match) return 0;
  return Math.round(parseFloat(match[0].replace(/,/g, "")) * 100);
}

test.describe("Order cancellation payments choice", () => {
  test("choosing 'lost' keeps the payment on the cancelled order and grows the dashboard's Lost on cancelled figure", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    // Fresh per attempt (see the constant's own note): a Playwright retry must never reuse the
    // previous attempt's still-uncleaned fixture name.
    const stamp = Date.now();
    const storeName = `${STORE_PREFIX} Lost ${stamp}`;
    const itemName = `E2E Cancel Lost Item ${stamp}`;
    currentStoreName = storeName;

    const beforeMinor = await readLostOnCancelledMinor(page);

    await createFixtureStore(page, storeName);
    const orderUrl = await createFixtureOrder(page, storeName, itemName, "50.00");
    const orderId = orderUrl.split("/").pop()!;
    await recordFullPayment(page, orderUrl, "50.00");

    await page.goto(orderUrl);
    // Sanity: the payments-choice radio only renders because `hasPayments` is true, proving this
    // test actually reaches the branch under test rather than the payment-less skip path.
    await page
      .getByRole("button", { name: /^cancel order$/i })
      .first()
      .click();
    const dialog = page.getByRole("alertdialog", { name: /cancel order/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /count it as lost/i })).toBeVisible();
    // See `cancelOrderWithPaymentsChoice`'s own note: click the visible label text, not the
    // covered `sr-only` radio input, so the click actually lands and label-delegates.
    await dialog.getByText(/count it as lost/i).click();
    await dialog.getByRole("button", { name: /^cancel order$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // (a) The order shows cancelled.
    await expect(page.getByText(/cancelled on/i).first()).toBeVisible({ timeout: 15_000 });

    // The "lost" branch never touches `PaymentAllocation`: it stays pinned to the now-cancelled
    // order, which is precisely what makes the money readable as sunk.
    const snapshot = await getStoreSnapshotByNamePrefix(storeName);
    const allocations = snapshot.storePayments.flatMap((payment) => payment.allocations);
    expect(allocations.some((allocation) => allocation.orderId === orderId)).toBe(true);

    // (b) The dashboard's conditional "Lost on cancelled" figure grew by exactly this order's
    // 50.00, against whatever the collector's own real history already contributed. Polled: the
    // figure is server-rendered fresh on every navigation (`revalidatePath` runs inside
    // `cancelOrderAction` before it returns), but a small propagation window is still cheaper to
    // absorb here than to chase.
    await expect(async () => {
      const afterMinor = await readLostOnCancelledMinor(page);
      expect(afterMinor - beforeMinor).toBe(5000);
    }).toPass({ timeout: 20_000 });
  });

  test("choosing 'credit' frees the payment as unassigned money at the store, and never touches the dashboard's Lost on cancelled figure", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    // Fresh per attempt — see `STORE_PREFIX`'s own note.
    const stamp = Date.now();
    const storeName = `${STORE_PREFIX} Credit ${stamp}`;
    const itemName = `E2E Cancel Credit Item ${stamp}`;
    currentStoreName = storeName;

    const beforeMinor = await readLostOnCancelledMinor(page);

    const storeSlug = await createFixtureStore(page, storeName);
    const orderUrl = await createFixtureOrder(page, storeName, itemName, "75.00");
    const orderId = orderUrl.split("/").pop()!;
    await recordFullPayment(page, orderUrl, "75.00");

    await page.goto(orderUrl);
    await cancelOrderWithPaymentsChoice(page, "credit");

    // (a) The order shows cancelled.
    await expect(page.getByText(/cancelled on/i).first()).toBeVisible({ timeout: 15_000 });

    // The credit remains available at the store: the allocation was dropped, so the same
    // `StorePayment` now reads as unassigned money the collector can apply to another order there.
    // Observed directly (not copied from `store-reconciliation.spec.ts`'s parked-money flow, whose
    // "already paid and not assigned" summary line is a DIFFERENT component/condition): the payment
    // row itself carries the stable "Unassigned {amount}" badge (`unassignedBadge`,
    // `StorePaymentRow.tsx`) regardless of whether the store has any open order to apply it to.
    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(page.getByText(/unassigned.*75\.00/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    const snapshot = await getStoreSnapshotByNamePrefix(storeName);
    const allocations = snapshot.storePayments.flatMap((payment) => payment.allocations);
    expect(allocations.some((allocation) => allocation.orderId === orderId)).toBe(false);
    expect(snapshot.storePayments.some((payment) => payment.amount === 7500)).toBe(true);

    // The dashboard's sunk-money figure never moves for a credited cancellation.
    const afterMinor = await readLostOnCancelledMinor(page);
    expect(afterMinor - beforeMinor).toBe(0);
  });
});
