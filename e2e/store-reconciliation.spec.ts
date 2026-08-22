import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";
import { deleteStoresByNamePrefix } from "./_helpers/dbCleanup";
import { getStoreSnapshotByNamePrefix } from "./_helpers/dbQuery";

/**
 * Store account reconciliation and settlement-on-arrival, end to end (`ADR 0033`, `ADR 0034`,
 * `FRD-05 · WO-09/10/11`, `FRD-08 · WO-08`).
 *
 * Every fixture here is a store this spec creates for itself, never one of the collector's real
 * ones (`StorePayment.store`, `StoreAccountAdjustment.store` and `Delivery.store` are all
 * `onDelete: Cascade` in the schema, so deleting the store takes its orders, payments, allocations,
 * adjustments and deliveries with it). Cleanup goes by a shared run-unique NAME PREFIX rather than
 * by slug, exactly as `store-payments.spec.ts` does: the slug is only readable once a wizard's
 * redirect lands, so a failure anywhere before that would otherwise leave a public store behind.
 *
 * Ten independent fixture stores, one per named suffix, all sharing the same prefix so one
 * `afterAll` cleans all of them:
 *  - `${STORE_PREFIX}` (no suffix): the reconciliation write-off narrative (scenarios a, c).
 *  - `${STORE_PREFIX} Refusal`: the written-off-order payment refusal (scenario b), a separate
 *    store so a failure here can never skip scenario c (see that describe block's own note).
 *  - `${STORE_PREFIX} Parked`: the parked-money guard (scenario d).
 *  - `${STORE_PREFIX} Settlement`: settlement-on-arrival and its reopen reversal (scenario e).
 *  - `${STORE_PREFIX} Partial`: typing a smaller balance writes only the difference (WO-11 deferred f).
 *  - `${STORE_PREFIX} AllSettled`: "todo saldado" across two open orders in one gesture (WO-11 deferred g).
 *  - `${STORE_PREFIX} Refusals`: the two client-side refusals, nothing marked and empty reason (WO-11
 *    deferred h).
 *  - `${STORE_PREFIX} DeliveredBalance`: the delivered-orders group on a formally-delivered order that
 *    was never settled (WO-11 deferred i, `ADR 0034` §7).
 *  - `${STORE_PREFIX} Consumption`: settlement on arrival consuming parked money, and the reopen toast
 *    naming both amounts (`FRD-08 · WO-08` deferred, `reopenedWithSettlementAndConsumption`).
 *  - `${STORE_PREFIX} WrittenOffArrival`: a fully written-off order arriving renders no settlement
 *    checkbox and creates no payment (`FRD-08 · WO-08` deferred).
 */

const FIXTURE_SUFFIX = Date.now();
const STORE_PREFIX = `E2E Reconciliation Store ${FIXTURE_SUFFIX}`;
const REFUSAL_STORE_NAME = `${STORE_PREFIX} Refusal`;
const PARKED_STORE_NAME = `${STORE_PREFIX} Parked`;
const SETTLEMENT_STORE_NAME = `${STORE_PREFIX} Settlement`;
const PARTIAL_STORE_NAME = `${STORE_PREFIX} Partial`;
const ALL_SETTLED_STORE_NAME = `${STORE_PREFIX} AllSettled`;
const REFUSALS_STORE_NAME = `${STORE_PREFIX} Refusals`;
const DELIVERED_BALANCE_STORE_NAME = `${STORE_PREFIX} DeliveredBalance`;
const CONSUMPTION_STORE_NAME = `${STORE_PREFIX} Consumption`;
const WRITTEN_OFF_ARRIVAL_STORE_NAME = `${STORE_PREFIX} WrittenOffArrival`;

const ITEM_A = `E2E Recon Item A ${FIXTURE_SUFFIX}`;
const ITEM_B = `E2E Recon Item B ${FIXTURE_SUFFIX}`;
const REFUSAL_ITEM_A = `E2E Recon Refusal Item A ${FIXTURE_SUFFIX}`;
const REFUSAL_ITEM_B = `E2E Recon Refusal Item B ${FIXTURE_SUFFIX}`;
const PARKED_ITEM = `E2E Recon Parked Item ${FIXTURE_SUFFIX}`;
const SETTLEMENT_ITEM = `E2E Recon Settlement Item ${FIXTURE_SUFFIX}`;
const PARTIAL_ITEM = `E2E Recon Partial Item ${FIXTURE_SUFFIX}`;
const ALL_SETTLED_ITEM_A = `E2E Recon AllSettled Item A ${FIXTURE_SUFFIX}`;
const ALL_SETTLED_ITEM_B = `E2E Recon AllSettled Item B ${FIXTURE_SUFFIX}`;
const REFUSALS_ITEM = `E2E Recon Refusals Item ${FIXTURE_SUFFIX}`;
const DELIVERED_BALANCE_ITEM = `E2E Recon DeliveredBalance Item ${FIXTURE_SUFFIX}`;
const CONSUMPTION_ITEM = `E2E Recon Consumption Item ${FIXTURE_SUFFIX}`;
const WRITTEN_OFF_ARRIVAL_ITEM = `E2E Recon WrittenOffArrival Item ${FIXTURE_SUFFIX}`;

/** Carried across the serial tests in the main narrative (scenarios a, c). */
let mainStoreSlug: string | null = null;

test.afterAll(async () => {
  await deleteStoresByNamePrefix(STORE_PREFIX);
});

/** The reconciliation sheet, by its own title ("Reconcile account with {store}"). */
function reconciliationSheet(page: Page) {
  return page.getByRole("dialog", { name: /reconcile account with/i });
}

/** The store payment sheet, by its own title ("Register a payment to {store}"). */
function paymentSheet(page: Page) {
  return page.getByRole("dialog", { name: /register a payment to/i });
}

/**
 * The store detail sidebar's live outstanding-debt figure (`ADR 0033`, `WO-09`), read from its own
 * element the same way `store-payments.spec.ts` does, so a bare text match on an amount cannot pass
 * on a price while the debt behind it is wrong.
 */
function outstandingHeadline(page: Page) {
  return page.getByText(/^outstanding on open orders\s/i).first();
}

/** Creates the spec's own store through the create wizard. Returns its slug from the detail URL. */
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

/** Creates a single-item order in `storeName` with total (and unit price) `price`, e.g. "180.00". */
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

/** The "Ya me llegó" modal, by its own title ("It arrived"). Named distinctly from the local
    `arrivalModal` const the existing settlement test below already declares, to avoid shadowing. */
function quickArrivalModal(page: Page) {
  return page.getByRole("dialog", { name: /^it arrived$/i });
}

/**
 * Creates a delivery from `orderUrl` through the formal wizard and marks it delivered from the
 * delivery detail page. This launcher renders NO settlement checkbox at all (`markDeliveredAction`'s
 * own doc: "this formal-flow launcher renders no settlement checkbox, so it never enables the
 * settlement half"), so an order delivered this way stays exactly as unpaid as it was before,
 * whatever its balance. Used to seed a genuinely delivered-with-a-balance order for the
 * reconciliation sheet's "Delivered orders with a balance" group (`ADR 0034` §7).
 */
async function deliverOrderFormally(page: Page, orderUrl: string): Promise<string> {
  await page.goto(orderUrl);
  await page
    .getByRole("link", { name: /create delivery/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/deliveries\/new\?sourceOrderId=/);
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
  const deliveryUrl = page.url();

  await page
    .getByRole("button", { name: /mark as delivered/i })
    .first()
    .click();
  const markDialog = page.getByRole("dialog", { name: /mark as delivered/i });
  await expect(markDialog).toBeVisible();
  await markDialog.getByRole("button", { name: /mark as delivered/i }).click();
  await expect(page.getByText(/delivery received/i)).toBeVisible();

  // The optimistic modal closes before the server transaction commits (`deliveries.spec.ts`'s own
  // documented race), so the source order's re-derived COMPLETED status is not guaranteed to be
  // visible yet even on a fresh navigation. Poll the ORDER page itself, exactly like the existing
  // "Delivery lifecycle journey" test does, so every caller of this helper inherits a store whose
  // debt figures are already settled by the time it returns.
  await expect(async () => {
    await page.goto(orderUrl);
    await expect(page.getByText(/^completed$/i).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  return deliveryUrl;
}

/**
 * Parks `amount` at `storeSlug` as unassigned money ("no sé todavía"), the same three-click
 * sequence `store-payments.spec.ts` and the "Parked money" describe block above both use: fill the
 * amount, open the allocation panel, then explicitly mark it parked instead of declaring it.
 */
async function parkMoneyAtStore(page: Page, storeSlug: string, amount: string): Promise<void> {
  await page.goto(`/en/stores/${storeSlug}`);
  await page.getByRole("button", { name: /^log payment$/i }).click();

  const sheet = paymentSheet(page);
  await expect(sheet).toBeVisible();
  await page.locator("#store-payment-amount").fill(amount);
  await sheet.getByRole("button", { name: /^assign$/i }).click();
  await sheet.getByRole("button", { name: /mark .* as parked money/i }).click();
  await sheet.getByRole("button", { name: /^register payment$/i }).click();
  await expect(sheet).toBeHidden({ timeout: 5_000 });
}

/**
 * Pays `orderUrl`'s single item (`itemName`) in full for `amount`, declared straight against that
 * product line rather than parked, closing the order's own balance to zero. Waits for the server
 * (`FR-05-42b`: a declared payment does not close the sheet optimistically).
 */
async function payItemInFull(page: Page, storeSlug: string, itemName: string, amount: string): Promise<void> {
  await page.goto(`/en/stores/${storeSlug}`);
  await page.getByRole("button", { name: /^log payment$/i }).click();

  const sheet = paymentSheet(page);
  await expect(sheet).toBeVisible();
  await page.locator("#store-payment-amount").fill(amount);
  await sheet.getByRole("button", { name: /^assign$/i }).click();
  await sheet.getByLabel(new RegExp(`amount for ${itemName}`, "i")).fill(amount);
  await sheet.getByRole("button", { name: /^register payment$/i }).click();
  await expect(sheet).toBeHidden({ timeout: 20_000 });
}

test.describe("Store account reconciliation write-off", () => {
  test.describe.configure({ mode: "serial" });

  test("marking one order settled drops the headline and files the adjustment under its own history, never the payments list", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    mainStoreSlug = await createFixtureStore(page, STORE_PREFIX);
    await createFixtureOrder(page, STORE_PREFIX, ITEM_A, "180.00");
    await createFixtureOrder(page, STORE_PREFIX, ITEM_B, "200.00");

    await page.goto(`/en/stores/${mainStoreSlug}`);
    await expect(outstandingHeadline(page)).toHaveText(/380\.00/, { timeout: 15_000 });

    // Open the reconciliation sheet from the payment block itself (`ReconciliationTrigger`,
    // rendered last inside `StorePaymentProgressRows`'s own currency block).
    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    const sheet = reconciliationSheet(page);
    await expect(sheet).toBeVisible();

    // Both orders are open and unpaid, so both must be listed by their DATE with their own balance
    // (`FR-05-67`): the code is present only as small secondary text.
    const rowA = sheet.getByRole("listitem").filter({ hasText: "180.00" });
    const rowB = sheet.getByRole("listitem").filter({ hasText: "200.00" });
    await expect(rowA).toBeVisible();
    await expect(rowB).toBeVisible();

    // Mark only order A settled; leave order B untouched.
    await rowA.getByRole("button", { name: /^settle$/i }).click();

    await sheet.locator("#store-reconciliation-reason").fill("no identificado");
    await expect(sheet.getByText(/so you really owe/i)).toHaveText(/200\.00/);

    await sheet.getByRole("button", { name: /^reconcile account$/i }).click();
    // Optimistic Confirmation: the sheet is gone before the server answers.
    await expect(sheet).toBeHidden({ timeout: 5_000 });

    await expect(async () => {
      await page.goto(`/en/stores/${mainStoreSlug}`);
      await expect(outstandingHeadline(page)).toHaveText(/200\.00/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // The adjustment is its own record: it appears under "Reconciliation adjustments", never mixed
    // into "Payments to this store" (`ADR 0034` §2).
    const historySection = page.locator("section").filter({ hasText: "Reconciliation adjustments" });
    await expect(historySection).toBeVisible();
    await expect(historySection.getByText("180.00").first()).toBeVisible();
    await expect(historySection.getByText("no identificado")).toBeVisible();

    // No store-level payment was ever recorded for this fixture, so "Payments to this store" never
    // renders at all (`StorePaymentsSection` returns null while both lists are empty) — the
    // adjustment must never read as, or live inside, a payment list.
    await expect(page.locator("section").filter({ hasText: "Payments to this store" })).toHaveCount(0);
  });

  test("deleting the adjustment restores the headline to its pre-write-off figure", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(120_000);
    expect(mainStoreSlug, "the fixture store from the first test").not.toBeNull();
    await signInAndLandOnDashboard(page);

    await page.goto(`/en/stores/${mainStoreSlug}`);
    const historySection = page.locator("section").filter({ hasText: "Reconciliation adjustments" });
    await expect(historySection).toBeVisible();

    await historySection.getByRole("button", { name: /delete the .*180\.00.* adjustment/i }).click();
    const confirmDialog = page.getByRole("alertdialog", { name: /delete this adjustment/i });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: /^delete$/i }).click();
    await expect(confirmDialog).toBeHidden({ timeout: 5_000 });

    // Neither order in this fixture ever received a payment, so the pre-write-off figure is simply
    // the sum of both orders' own totals again: 180.00 + 200.00 = 380.00.
    await expect(async () => {
      await page.goto(`/en/stores/${mainStoreSlug}`);
      await expect(outstandingHeadline(page)).toHaveText(/380\.00/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    await expect(page.locator("section").filter({ hasText: "Reconciliation adjustments" })).toHaveCount(0);
  });
});

// Deliberately its own describe with its own store, never chained after the write-off narrative
// above: (b) tests a different concern (the order-level EXCEEDS_BALANCE ceiling) than (a)/(c) (the
// store-level write-off and its history), and coupling it into the same serial chain would let a
// failure here skip (c) even though (c) does not depend on this scenario's outcome.
test.describe("A written-off order no longer offers a payment against its old balance", () => {
  test("the amount field is disabled with the reconciled explanation, the order keeps its own gross balance, and the untouched order in the same store still accepts a payment safely inside its own balance", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, REFUSAL_STORE_NAME);
    const orderAUrl = await createFixtureOrder(page, REFUSAL_STORE_NAME, REFUSAL_ITEM_A, "180.00");
    const orderBUrl = await createFixtureOrder(page, REFUSAL_STORE_NAME, REFUSAL_ITEM_B, "200.00");
    const orderAId = orderAUrl.split("/").pop()!;

    await page.goto(`/en/stores/${storeSlug}`);
    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    const sheet = reconciliationSheet(page);
    await expect(sheet).toBeVisible();

    await sheet
      .getByRole("listitem")
      .filter({ hasText: "180.00" })
      .getByRole("button", { name: /^settle$/i })
      .click();
    await sheet.locator("#store-reconciliation-reason").fill("no identificado");
    await sheet.getByRole("button", { name: /^reconcile account$/i }).click();
    await expect(sheet).toBeHidden({ timeout: 5_000 });

    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(outstandingHeadline(page)).toHaveText(/200\.00/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // Order A was fully written off (`openBalanceMinor` net of the adjustment is now 0). The form
    // no longer lets a collector type an amount the server is guaranteed to refuse (`BR-05-32`):
    // the field is disabled up front, the reconciled explanation is already showing (nothing has
    // to be typed to trigger it), and the "pay the whole balance" quick-pick is not rendered at
    // all (`netCeilingMinor > 0` gates the whole chip row in `OrderInlinePaymentForm`). Meanwhile
    // the ORDER's own displayed balance deliberately keeps reading its pre-adjustment 180.00
    // (`ADR 0034`: "orders keep their own balance"; `FR-05-35`) — a reconciliation adjustment
    // squares the STORE's account, it does not touch the order's own gross figure.
    await page.goto(orderAUrl);
    await page.getByRole("button", { name: /^record payment$/i }).click();

    const amountField = page.getByLabel(/^amount$/i).first();
    await expect(amountField).toBeDisabled();
    await expect(page.getByText(/this order's balance was reconciled with the store/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /pay the whole balance/i })).toHaveCount(0);

    const submitButton = page
      .locator("form")
      .filter({ has: page.getByLabel(/^amount$/i) })
      .getByRole("button", { name: /^record/i });
    await expect(submitButton).toBeDisabled();

    // The aside card's own "Left" figure (`detail.payments.remainingToAllocate`) is the order's
    // GROSS balance, computed from `totalCost` and `paidAmount` alone — an adjustment is not a
    // `PaymentAllocation`, so it never moves this number. `.first()` because the order detail page
    // mounts both a desktop and a mobile payments aside (one hidden by CSS only).
    const remainingRow = page
      .getByText(/^left$/i)
      .first()
      .locator("..");
    await expect(remainingRow).toContainText("180.00");

    // Order B was never written off: a payment safely inside its own 200.00 balance is still
    // accepted (the sliding case's money half).
    await page.goto(orderBUrl);
    await page.getByRole("button", { name: /^record payment$/i }).click();
    await page.getByLabel(/^amount$/i).fill("50.00");
    await page
      .locator("form")
      .filter({ has: page.getByLabel(/^amount$/i) })
      .getByRole("button", { name: /^record/i })
      .click();

    await expect(page.getByText(/amount exceeds the remaining balance/i)).not.toBeVisible();
    // The full "You have paid X of Y. Z left." sentence (`heroProgressSentence`) is only ever
    // wired to the progress bar's own `aria-valuetext` (`ProgressBar`'s screen-reader
    // announcement, `OrderDetailHero.tsx`), never rendered as visible page text, so `getByText`
    // can never resolve it. The hero's own visible readout is "Allocated {paid} of {total}"
    // (`detail.hero.allocatedOfTotal`).
    //
    // The figure the hero displays is itself animated (`useAnimatedNumber`, `OrderDetailHero.tsx`)
    // counting up from 0 on every allocation change, so a one-shot `textContent()` read races that
    // animation and can catch it mid-count (e.g. "S/ 4.46" instead of "S/ 50.00"). `toContainText`
    // polls until the settled DOM text matches, which waits the animation out instead of racing it.
    const heroAllocated = page.getByText(/^allocated /i).first();
    await expect(heroAllocated).toContainText("50.00");
    await expect(heroAllocated).toContainText("200.00");
    await expect(page.getByText("150.00").first()).toBeVisible();

    // No `StorePayment` ever landed for order A: the disabled field made the attempt unreachable
    // through the UI, so there is nothing here for the server-side `EXCEEDS_BALANCE` refusal to
    // even guard against. Order B's own 50.00 is the only allocation in the store's history.
    //
    // `handleAddPayment` (`OrderDetailClient.tsx`) is optimistic: `heroAllocated` above already
    // reflects the LOCAL patch, applied before the server round trip even resolves, so reading the
    // DB straight after that assertion can race the real `addPaymentAction` commit. `toPass` polls
    // the same read-only query until it reflects the server's own settled state, the same pattern
    // `outstandingHeadline` above uses for the (also-optimistic) reconciliation write.
    await expect(async () => {
      const snapshot = await getStoreSnapshotByNamePrefix(REFUSAL_STORE_NAME);
      const allAllocations = snapshot.storePayments.flatMap((payment) => payment.allocations);
      expect(allAllocations.some((allocation) => allocation.orderId === orderAId)).toBe(false);
      expect(allAllocations).toEqual([
        expect.objectContaining({ orderId: orderBUrl.split("/").pop()!, amountMinor: 5000 }),
      ]);
    }).toPass({ timeout: 15_000 });

    await deleteStoresByNamePrefix(REFUSAL_STORE_NAME);
  });
});

test.describe("Parked money blocks the reconciliation write", () => {
  test("names the parked amount and offers assigning it instead of a form", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(120_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, PARKED_STORE_NAME);
    await createFixtureOrder(page, PARKED_STORE_NAME, PARKED_ITEM, "100.00");

    await page.goto(`/en/stores/${storeSlug}`);
    await page.getByRole("button", { name: /^log payment$/i }).click();

    const sheet = paymentSheet(page);
    await expect(sheet).toBeVisible();
    await page.locator("#store-payment-amount").fill("40.00");
    await sheet.getByRole("button", { name: /^assign$/i }).click();
    await sheet.getByRole("button", { name: /mark .* as parked money/i }).click();
    await sheet.getByRole("button", { name: /^register payment$/i }).click();
    await expect(sheet).toBeHidden({ timeout: 5_000 });

    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(page.getByText(/40\.00.*already paid and not assigned/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    const reconSheet = reconciliationSheet(page);
    await expect(reconSheet).toBeVisible();

    await expect(reconSheet.getByText(/holds .*40\.00.* you have not assigned yet/i)).toBeVisible();
    await expect(reconSheet.getByRole("button", { name: /^go assign a payment$/i })).toBeVisible();
    await expect(reconSheet.getByText("Open orders")).not.toBeVisible();
    await expect(reconSheet.locator("#store-reconciliation-reason")).toHaveCount(0);
    await expect(reconSheet.getByRole("button", { name: /^reconcile account$/i })).toHaveCount(0);

    await deleteStoresByNamePrefix(PARKED_STORE_NAME);
  });
});

test.describe("Settlement on arrival, and its reversal on reopen", () => {
  test("logging the arrival with 'I already paid the rest' checked records the payment; reopening removes it and names the amount", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, SETTLEMENT_STORE_NAME);
    const orderUrl = await createFixtureOrder(page, SETTLEMENT_STORE_NAME, SETTLEMENT_ITEM, "120.00");

    await page.goto(orderUrl);
    await page.getByRole("button", { name: /^it arrived$/i }).click();

    const arrivalModal = page.getByRole("dialog", { name: /^it arrived$/i });
    await expect(arrivalModal).toBeVisible();

    // The settlement preview is fetched after a short debounce (`SETTLEMENT_CONTEXT_DEBOUNCE_MS`)
    // plus a real server round trip; on a cold `next dev` compile this can outlast the default
    // assertion timeout, so wait for "Calculating the payment…" to clear before reading the result.
    await expect(arrivalModal.getByText(/calculating the payment/i)).toBeHidden({ timeout: 30_000 });

    // Single-item order fully unpaid: the settlement block computes the whole balance and defaults
    // the "I already paid the rest" checkbox to checked (`ADR 0032`, closes-the-order branch).
    const settleCheckbox = arrivalModal.getByRole("checkbox", { name: /i already paid the rest/i });
    await expect(settleCheckbox).toBeChecked();
    await expect(arrivalModal.getByText(/a payment of .*120\.00.* will be recorded/i)).toBeVisible();

    await arrivalModal.getByRole("button", { name: /^log arrival$/i }).click();

    await expect(page.getByText(/arrival recorded, and .*120\.00.* logged as a payment/i)).toBeVisible({
      timeout: 10_000,
    });

    // The success toast carries a "View delivery" action button (`useQuickArrival`'s own toast),
    // which is how the collector actually reaches the delivery from this flow.
    await page.getByRole("button", { name: /^view delivery$/i }).click();
    await expect(page).toHaveURL(/\/en\/deliveries\/[a-z0-9]+$/i, { timeout: 15_000 });
    const deliveryUrl = page.url();

    // Store history shows the settlement payment.
    await page.goto(`/en/stores/${storeSlug}`);
    const paymentsSection = page.locator("section").filter({ hasText: "Payments to this store" });
    await expect(paymentsSection).toBeVisible();
    await expect(paymentsSection.getByText("120.00").first()).toBeVisible();

    await page.goto(deliveryUrl);
    await page
      .getByRole("button", { name: /reopen delivery/i })
      .first()
      .click();
    await expect(
      page.getByText(/delivery reopened, and .*120\.00.* went back to the outstanding balance/i),
    ).toBeVisible({ timeout: 10_000 });

    await page.goto(`/en/stores/${storeSlug}`);
    await expect(page.locator("section").filter({ hasText: "Payments to this store" })).toHaveCount(0);

    await deleteStoresByNamePrefix(SETTLEMENT_STORE_NAME);
  });
});

// Deferred WO-11 case (UX Notes: "type a smaller balance for it"): the collector types what is
// still left owed instead of clicking "Settle", so only the DIFFERENCE gets written off, never the
// order's whole balance.
test.describe("Typing a smaller balance writes only the difference", () => {
  test("a partial write-off drops the headline by the difference and leaves the order's own gross balance untouched", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, PARTIAL_STORE_NAME);
    const orderUrl = await createFixtureOrder(page, PARTIAL_STORE_NAME, PARTIAL_ITEM, "200.00");

    await page.goto(`/en/stores/${storeSlug}`);
    await expect(outstandingHeadline(page)).toHaveText(/200\.00/, { timeout: 15_000 });

    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    const sheet = reconciliationSheet(page);
    await expect(sheet).toBeVisible();

    // Type the SMALLER remaining balance directly, never clicking "Settle": the row's own
    // write-off chip and the store-level read-out both derive from this one typed figure
    // (`resolveLineAmountMinor`, `computeReconciliationReadOutMinor`).
    const row = sheet.getByRole("listitem").filter({ hasText: "200.00" });
    await row.getByRole("textbox").fill("120.00");
    await expect(row.getByText(/writing off.*80\.00/i)).toBeVisible();
    await expect(sheet.getByText(/so you really owe/i)).toHaveText(/120\.00/);

    await sheet.locator("#store-reconciliation-reason").fill("partial recount, 120 still genuinely owed");
    await sheet.getByRole("button", { name: /^reconcile account$/i }).click();
    await expect(sheet).toBeHidden({ timeout: 5_000 });

    // The headline drops by exactly the 80.00 difference, not the order's whole 200.00.
    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(outstandingHeadline(page)).toHaveText(/120\.00/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    const historySection = page.locator("section").filter({ hasText: "Reconciliation adjustments" });
    await expect(historySection).toBeVisible();
    await expect(historySection.getByText("80.00").first()).toBeVisible();

    // The ORDER's own writable ceiling is the NET 120.00, never the gross 200.00
    // (`netCeilingMinor`, `OrderInlinePaymentForm`, `BR-05-32`): typing 150.00, a figure between
    // the two, is refused client-side with the write-off-aware copy rather than the ordinary
    // "exceeds the remaining balance" message, which only proves the order still KNOWS its own
    // gross 200.00 if the net ceiling it is refusing against is genuinely 120.00 and not, say, 0.
    // 120.00 itself, right at the net ceiling, is accepted with no refusal at all.
    await page.goto(orderUrl);
    await page.getByRole("button", { name: /^record payment$/i }).click();
    const amountField = page.getByLabel(/^amount$/i);
    await amountField.fill("150.00");
    await expect(page.getByText(/this order's balance was reconciled with the store/i)).toBeVisible();

    await amountField.fill("120.00");
    await expect(page.getByText(/this order's balance was reconciled with the store/i)).not.toBeVisible();
    await expect(page.getByText(/amount exceeds the remaining balance/i)).not.toBeVisible();

    const snapshot = await getStoreSnapshotByNamePrefix(PARTIAL_STORE_NAME);
    expect(snapshot.adjustments).toHaveLength(1);
    expect(snapshot.adjustments[0]?.lines).toEqual([expect.objectContaining({ amountMinor: 8000 })]);

    await deleteStoresByNamePrefix(PARTIAL_STORE_NAME);
  });
});

// Deferred WO-11 case (UX Notes: "todo saldado is the common case and must be one gesture"): two
// open orders, marked at once, still write one line per order.
test.describe('"Todo saldado" marks every listed order in one gesture', () => {
  test("marking all settled on a two-order store writes one adjustment with two lines and zeroes the headline", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, ALL_SETTLED_STORE_NAME);
    await createFixtureOrder(page, ALL_SETTLED_STORE_NAME, ALL_SETTLED_ITEM_A, "90.00");
    await createFixtureOrder(page, ALL_SETTLED_STORE_NAME, ALL_SETTLED_ITEM_B, "60.00");

    await page.goto(`/en/stores/${storeSlug}`);
    await expect(outstandingHeadline(page)).toHaveText(/150\.00/, { timeout: 15_000 });

    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    const sheet = reconciliationSheet(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("listitem").filter({ hasText: "90.00" })).toBeVisible();
    await expect(sheet.getByRole("listitem").filter({ hasText: "60.00" })).toBeVisible();

    // One gesture marks every listed row settled at once (`markAllSettled`), never a store-level
    // shortcut computed differently: it still produces one line per order underneath.
    await sheet.getByRole("button", { name: /^mark all settled$/i }).click();
    await expect(sheet.getByText(/so you really owe/i)).toHaveText(/0\.00/);

    await sheet.locator("#store-reconciliation-reason").fill("full back-catalogue write-off, both orders");
    await sheet.getByRole("button", { name: /^reconcile account$/i }).click();
    await expect(sheet).toBeHidden({ timeout: 5_000 });

    // Nothing left open reads as the "All settled" chip, not a "0.00" headline (`resolveProgressState`:
    // `openOrderDebtMinor === 0` is the "settled" branch, which renders the chip instead of the
    // amount text `outstandingHeadline` matches).
    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(page.getByText(/^all settled$/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    const historySection = page.locator("section").filter({ hasText: "Reconciliation adjustments" });
    await expect(historySection).toBeVisible();
    await expect(historySection.getByText("150.00").first()).toBeVisible();

    const snapshot = await getStoreSnapshotByNamePrefix(ALL_SETTLED_STORE_NAME);
    expect(snapshot.adjustments).toHaveLength(1);
    expect(snapshot.adjustments[0]?.lines).toHaveLength(2);
    const totalWrittenOff = snapshot.adjustments[0]?.lines.reduce((sum, line) => sum + line.amountMinor, 0);
    expect(totalWrittenOff).toBe(15000);

    await deleteStoresByNamePrefix(ALL_SETTLED_STORE_NAME);
  });
});

// Deferred WO-11 cases (E2E Acceptance Tests): both client-side refusals, driven entirely through
// the sheet so neither ever reaches the server as a write.
test.describe("The sheet refuses to submit nothing, and refuses an empty reason", () => {
  test("an unmarked-but-touched row cannot submit without a reason, and a fully settled store offers no write at all", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, REFUSALS_STORE_NAME);
    await createFixtureOrder(page, REFUSALS_STORE_NAME, REFUSALS_ITEM, "150.00");

    // First refusal: a row is marked (so a line exists) but the reason is left empty.
    // `canSubmitReconciliation` requires BOTH; the primary button stays disabled, so the collector
    // cannot even reach the `REASON_REQUIRED` refusal the server would otherwise return.
    await page.goto(`/en/stores/${storeSlug}`);
    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    let sheet = reconciliationSheet(page);
    await expect(sheet).toBeVisible();
    await sheet
      .getByRole("listitem")
      .filter({ hasText: "150.00" })
      .getByRole("button", { name: /^settle$/i })
      .click();
    await expect(sheet.locator("#store-reconciliation-reason")).toHaveValue("");
    await expect(sheet.getByRole("button", { name: /^reconcile account$/i })).toBeDisabled();
    await sheet.getByRole("button", { name: /^cancel$/i }).click();
    await expect(sheet).toBeHidden();

    // Settle the order for real (through a declared payment, not the sheet), so nothing is left to
    // adjust at all.
    await payItemInFull(page, storeSlug, REFUSALS_ITEM, "150.00");
    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(page.getByText(/^all settled$/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // Second refusal: with nothing left carrying a balance, the sheet offers no form at all, only
    // the "nothing to adjust" state, and no submit control exists to even attempt a write with.
    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    sheet = reconciliationSheet(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(/nothing to adjust/i)).toBeVisible();
    await expect(sheet.getByRole("button", { name: /^reconcile account$/i })).toHaveCount(0);
    await sheet.getByRole("button", { name: /^cancel$/i }).click();

    // Neither refusal ever reached the server: no adjustment row exists for this store.
    const snapshot = await getStoreSnapshotByNamePrefix(REFUSALS_STORE_NAME);
    expect(snapshot.adjustments).toHaveLength(0);

    await deleteStoresByNamePrefix(REFUSALS_STORE_NAME);
  });
});

// Deferred WO-11 case (E2E Acceptance Tests, the back-catalogue pass; `ADR 0034` §7): a formally
// delivered order that was never settled shows up under "Delivered orders with a balance" and
// writing it off never moves the open-order headline, because it was already outside it.
test.describe("The delivered-orders group writes off a back-catalogue balance without moving the open headline", () => {
  test("a COMPLETED order still carrying a balance is listed, settled, and never touches the open-order figure", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, DELIVERED_BALANCE_STORE_NAME);
    const orderUrl = await createFixtureOrder(page, DELIVERED_BALANCE_STORE_NAME, DELIVERED_BALANCE_ITEM, "90.00");
    await deliverOrderFormally(page, orderUrl);

    // The order closed to COMPLETED with its 90.00 balance never paid or settled (the formal
    // mark-delivered launcher offers no settlement checkbox), so the store already reads "All
    // settled" before any reconciliation: a delivered order is outside `openOrderDebtMinor` by
    // construction (`ADR 0033`, `WO-09`).
    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(page.getByText(/^all settled$/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    const sheet = reconciliationSheet(page);
    await expect(sheet).toBeVisible();

    // Listed under its own group, never under "Open orders" (case-insensitive: the heading renders
    // uppercase via CSS `text-transform`, not in its own text content).
    await expect(sheet.getByText(/delivered orders with a balance/i)).toBeVisible();
    await expect(sheet.getByText(/open orders/i)).not.toBeVisible();
    const row = sheet.getByRole("listitem").filter({ hasText: "90.00" });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: /^settle$/i }).click();
    await sheet.locator("#store-reconciliation-reason").fill("delivered years ago, balance never collected");
    await sheet.getByRole("button", { name: /^reconcile account$/i }).click();
    await expect(sheet).toBeHidden({ timeout: 5_000 });

    // The headline never moved: still "All settled", not a fresh "0.00" that would imply it had
    // been carrying a live figure a moment ago.
    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(page.getByText(/^all settled$/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    const historySection = page.locator("section").filter({ hasText: "Reconciliation adjustments" });
    await expect(historySection).toBeVisible();
    await expect(historySection.getByText("90.00").first()).toBeVisible();

    const snapshot = await getStoreSnapshotByNamePrefix(DELIVERED_BALANCE_STORE_NAME);
    expect(snapshot.adjustments).toHaveLength(1);
    expect(snapshot.adjustments[0]?.lines).toEqual([expect.objectContaining({ amountMinor: 9000 })]);

    await deleteStoresByNamePrefix(DELIVERED_BALANCE_STORE_NAME);
  });
});

// The package's newest, currently-uncovered behaviour: settlement on arrival consuming money
// already parked at the store, and the reopen toast naming both the settlement AND the surviving
// consumption (`reopenedWithSettlementAndConsumption`, `FRD-08 · WO-08`).
test.describe("Settlement on arrival nets out parked money, and reopen names both amounts", () => {
  test("parking 40 then settling on arrival records a NET 110 payment, and reopening reverts only the settlement half", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, CONSUMPTION_STORE_NAME);
    const orderUrl = await createFixtureOrder(page, CONSUMPTION_STORE_NAME, CONSUMPTION_ITEM, "150.00");

    // Park 40.00 at the store BEFORE the arrival: unassigned money in the same currency, sitting on
    // no order at all.
    await parkMoneyAtStore(page, storeSlug, "40.00");
    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(page.getByText(/40\.00.*already paid and not assigned/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    await page.goto(orderUrl);
    await page.getByRole("button", { name: /^it arrived$/i }).click();
    const modal = quickArrivalModal(page);
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/calculating the payment/i)).toBeHidden({ timeout: 30_000 });

    // Single-item order, fully unpaid except for the parked 40.00: the settlement checkbox still
    // defaults to checked (consumption always runs first when the arrival closes the order, "double
    // counting guard", `getSettlementContextAction`'s own comment), and the computed amount is NET
    // of the parked money: 150.00 − 40.00 = 110.00, never the gross 150.00.
    const settleCheckbox = modal.getByRole("checkbox", { name: /i already paid the rest/i });
    await expect(settleCheckbox).toBeChecked();
    await expect(modal.getByText(/a payment of .*110\.00.* will be recorded/i)).toBeVisible();
    await expect(modal.getByText(/40\.00.*of this payment was already paid to the store/i)).toBeVisible();

    await modal.getByRole("button", { name: /^log arrival$/i }).click();
    await expect(page.getByText(/arrival recorded, and .*110\.00.* logged as a payment/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /^view delivery$/i }).click();
    await expect(page).toHaveURL(/\/en\/deliveries\/[a-z0-9]+$/i, { timeout: 15_000 });
    const deliveryUrl = page.url();
    const deliveryId = deliveryUrl.split("/").pop()!;

    // The DB facts the UI never surfaces directly: a NEW settlement `StorePayment` of 110.00
    // carrying `settledByDeliveryId`, and the PARKED payment's own allocation (not a new payment)
    // carrying `consumedByDeliveryId` for the SAME delivery.
    let snapshot = await getStoreSnapshotByNamePrefix(CONSUMPTION_STORE_NAME);
    const settlementPayment = snapshot.storePayments.find((payment) => payment.amount === 11000);
    expect(settlementPayment?.settledByDeliveryId).toBe(deliveryId);
    const parkedPayment = snapshot.storePayments.find((payment) => payment.amount === 4000);
    expect(parkedPayment?.settledByDeliveryId).toBeNull();
    expect(parkedPayment?.allocations.some((allocation) => allocation.consumedByDeliveryId === deliveryId)).toBe(true);

    await page.goto(deliveryUrl);
    await page
      .getByRole("button", { name: /reopen delivery/i })
      .first()
      .click();

    // The two-amount reopen copy (`WO-08` UX Notes): the settlement half this reopen deletes
    // (110.00) and the pre-existing consumption that SURVIVES the reopen (40.00) are both named,
    // because they are independent facts.
    await expect(
      page.getByText(
        /delivery reopened\..*110\.00.*went back to the outstanding balance\..*40\.00.*stays applied to this order/i,
      ),
    ).toBeVisible({ timeout: 10_000 });

    // The settlement payment is gone; the parked payment's consumption allocation survives with its
    // provenance stamp intact, exactly as `reopenDelivery`'s own doc promises ("deliberately left in
    // place, not cleared").
    snapshot = await getStoreSnapshotByNamePrefix(CONSUMPTION_STORE_NAME);
    expect(snapshot.storePayments.some((payment) => payment.amount === 11000)).toBe(false);
    const survivingParkedPayment = snapshot.storePayments.find((payment) => payment.amount === 4000);
    expect(
      survivingParkedPayment?.allocations.some((allocation) => allocation.consumedByDeliveryId === deliveryId),
    ).toBe(true);

    await deleteStoresByNamePrefix(CONSUMPTION_STORE_NAME);
  });
});

// The other half of the settlement-on-arrival surface with no coverage: a fully written-off order
// offers no settlement checkbox at all when it arrives, and creates no payment.
test.describe("A written-off order arrives with no settlement offered", () => {
  test("the arrival modal renders no settlement checkbox, records normally, and creates no StorePayment", async ({
    page,
  }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    const storeSlug = await createFixtureStore(page, WRITTEN_OFF_ARRIVAL_STORE_NAME);
    const orderUrl = await createFixtureOrder(page, WRITTEN_OFF_ARRIVAL_STORE_NAME, WRITTEN_OFF_ARRIVAL_ITEM, "130.00");

    // Write the whole order off through reconciliation BEFORE it ever arrives.
    await page.goto(`/en/stores/${storeSlug}`);
    await page.getByRole("button", { name: /^reconcile account$/i }).click();
    const sheet = reconciliationSheet(page);
    await expect(sheet).toBeVisible();
    await sheet
      .getByRole("listitem")
      .filter({ hasText: "130.00" })
      .getByRole("button", { name: /^settle$/i })
      .click();
    await sheet.locator("#store-reconciliation-reason").fill("written off before it ever arrived");
    await sheet.getByRole("button", { name: /^reconcile account$/i }).click();
    await expect(sheet).toBeHidden({ timeout: 5_000 });
    await expect(async () => {
      await page.goto(`/en/stores/${storeSlug}`);
      await expect(page.getByText(/^all settled$/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // Now the arrival: `openBalanceApprox <= 0` resolves to `{ kind: "nothingToSettle" }`
    // (`getSettlementContextAction`), so `relevantSettlementContexts` is empty and the whole
    // settlement block, checkbox included, never renders.
    await page.goto(orderUrl);
    await page.getByRole("button", { name: /^it arrived$/i }).click();
    const modal = quickArrivalModal(page);
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/calculating the payment/i)).toBeHidden({ timeout: 30_000 });
    await expect(modal.getByRole("checkbox", { name: /i already paid the rest/i })).toHaveCount(0);
    await expect(modal.getByText(/i already paid the rest/i)).toHaveCount(0);

    await modal.getByRole("button", { name: /^log arrival$/i }).click();
    await expect(page.getByText(/^arrival logged:/i)).toBeVisible({ timeout: 10_000 });

    await expect(async () => {
      await page.goto(orderUrl);
      await expect(page.getByText(/^completed$/i).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // No StorePayment was ever created for this store: the write-off already closed the balance,
    // so the arrival has nothing left to settle.
    const snapshot = await getStoreSnapshotByNamePrefix(WRITTEN_OFF_ARRIVAL_STORE_NAME);
    expect(snapshot.storePayments).toHaveLength(0);

    await deleteStoresByNamePrefix(WRITTEN_OFF_ARRIVAL_STORE_NAME);
  });
});
