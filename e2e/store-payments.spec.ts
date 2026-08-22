import { expect, test, type Page } from "@playwright/test";
import { signInAndLandOnDashboard, skipUnlessAuthenticatedEnv } from "./_helpers/auth";
import { deleteStoresByNamePrefix } from "./_helpers/dbCleanup";

/**
 * Store-level payments, end to end (`FR-05-42` / `42a` / `42b`).
 *
 * Both journeys run against a store this spec creates for itself rather than one of the
 * collector's real ones: `StorePayment.store` and `PaymentAllocation.payment` are both
 * `onDelete: Cascade` in the schema, so deleting the store takes its orders, its payments and
 * their allocations with it. Cleanup goes by the fixture's run-unique NAME rather than its slug:
 * the slug is only readable once the create wizard's redirect lands, so a failure anywhere before
 * that would leave a public store behind in the collector's own data with nothing holding its id.
 *
 * Serial, with one shared fixture: building it costs two wizards (a store and an order), and the
 * two journeys are read-only with respect to each other's preconditions — (a) pays 10 of a 100
 * debt on account, (b) then pays 30 more split across two product lines.
 */

const FIXTURE_SUFFIX = Date.now();
const STORE_NAME = `E2E Payments Store ${FIXTURE_SUFFIX}`;
const ITEM_A = `E2E Item A ${FIXTURE_SUFFIX}`;
const ITEM_B = `E2E Item B ${FIXTURE_SUFFIX}`;

/** Set by the fixture build in the first test, for navigating to the store's own detail page. */
let createdStoreSlug: string | null = null;

test.afterAll(async () => {
  await deleteStoresByNamePrefix(STORE_NAME);
});

/** The sheet, by its own title ("Register a payment to {store}"). */
function paymentSheet(page: Page) {
  return page.getByRole("dialog", { name: /register a payment to/i });
}

/**
 * The store detail sidebar's live remaining-debt figure, read from its own element rather than
 * from anywhere on the page: the fixture's first item costs exactly 60.00, so a bare text match on
 * the amount would pass on a price while the debt behind it is wrong.
 *
 * Reads the payment progress block's headline ("Outstanding on open orders {amount}", `ADR 0033`,
 * `WO-09`). It used to read "Remaining {amount}" before the headline was promoted to
 * `openOrderDebtMinor`. The `^outstanding on open orders ` anchor keeps it off any other figure on
 * the page.
 */
function remainingDebt(page: Page) {
  return page.getByText(/^outstanding on open orders\s/i).first();
}

/**
 * Creates the spec's own store through the create wizard (a gated `WizardAccordion`: only the
 * active step's fields are reachable, so every step has to be completed in order). Returns its
 * slug, read from the detail URL the form redirects to.
 */
async function createFixtureStore(page: Page): Promise<string> {
  await page.goto("/en/stores/new");

  // Step 1 — Type. "Retailer" is the default and needs no interaction.
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Step 2 — Identity: name + country.
  await page.getByLabel(/store name|nombre de la tienda/i).fill(STORE_NAME);
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

  // `(?!new$)` is load-bearing, exactly as in `createFixtureOrder`: without it the wizard's own
  // `/en/stores/new` satisfies the pattern, `toHaveURL` resolves on the first poll and the 20s
  // budget is never spent waiting for the redirect the assertion exists to wait for.
  await expect(page).toHaveURL(/\/en\/stores\/(?!new$)[a-z0-9-]+$/i, { timeout: 20_000 });
  const slug = page.url().split("/").pop()!;
  expect(slug).not.toBe("new");
  return slug;
}

/**
 * Creates a 100.00 order in the fixture store with two priced items (60.00 + 40.00), so the
 * allocation panel has two payable product lines and the store carries a 100.00 debt.
 */
async function createFixtureOrder(page: Page) {
  await page.goto("/en/orders/new");

  // Step 1 — store. `StoreCombobox` renders ONE element under `#order-store` and swaps which:
  // a `role="combobox"` input while nothing is selected, a plain button once something is. With
  // an empty field it is the input, which is why `order-entry.spec.ts` also drives it by id
  // rather than by role. Typing filters the list down to this run's own fixture store.
  const storeField = page.locator("#order-store");
  await storeField.click();
  await storeField.fill(STORE_NAME);
  await page
    .getByRole("option", { name: new RegExp(STORE_NAME, "i") })
    .first()
    .click();
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  // Step 2 — two priced items plus the order total.
  await page
    .getByLabel(/^name$/i)
    .first()
    .fill(ITEM_A);
  await page
    .getByLabel(/^unit price$/i)
    .first()
    .fill("60.00");
  await page.getByRole("button", { name: /^add item$/i }).click();
  await page
    .getByLabel(/^name$/i)
    .nth(1)
    .fill(ITEM_B);
  await page
    .getByLabel(/^unit price$/i)
    .nth(1)
    .fill("40.00");
  await page.getByLabel(/^total/i).fill("100.00");
  await page
    .getByRole("button", { name: /^continue$/i })
    .first()
    .click();

  // Step 3 — confirm; `(?!new)` waits for the detail redirect, not the wizard URL.
  await page.getByRole("button", { name: /create order/i }).click();
  await expect(page).toHaveURL(/\/en\/orders\/(?!new)[a-z0-9]+$/i, { timeout: 20_000 });
}

test.describe("Store-level payments", () => {
  test.describe.configure({ mode: "serial" });

  test("an on-account payment from the store view closes the sheet optimistically", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    await signInAndLandOnDashboard(page);

    createdStoreSlug = await createFixtureStore(page);
    await createFixtureOrder(page);

    await page.goto("/en/orders?view=store");
    const group = page.locator("section").filter({ hasText: STORE_NAME }).first();
    await expect(group).toBeVisible({ timeout: 15_000 });
    await expect(group.getByText(/100\.00/).first()).toBeVisible();

    await group.getByRole("button", { name: /^register payment$/i }).click();
    const sheet = paymentSheet(page);
    await expect(sheet).toBeVisible();

    // Nothing declared against an order or product: the amount is money on the store's account.
    // The store-level equality hardening (WO-09, `ADR 0033` §5a) refuses to submit a draft with
    // money neither declared nor parked, so the explicit "I don't know yet" affordance is what
    // reaches the same "on account" result now — the collector opens the allocation panel and
    // parks the whole 10.00 on purpose, rather than typing an amount and leaving nothing declared.
    await page.locator("#store-payment-amount").fill("10.00");
    await sheet.getByRole("button", { name: /^assign$/i }).click();
    await sheet.getByRole("button", { name: /mark .* as parked money/i }).click();
    await sheet.getByRole("button", { name: /^register payment$/i }).click();

    // Optimistic Confirmation: the sheet is gone before the server has answered. A parked slice is
    // request-shape only (never persisted), so the payment still lands with zero allocations and the
    // coordinator still takes the "nothing declared" close-immediately path.
    await expect(sheet).toBeHidden({ timeout: 5_000 });

    // And the debt really moved, not just on screen: a fresh server render says 90.00.
    await expect(async () => {
      await page.goto(`/en/stores/${createdStoreSlug}`);
      await expect(remainingDebt(page)).toHaveText(/\b90\.00\b/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // This fixture is exactly the shape the "unassigned money" line exists for (`BR-05-27`,
    // `FR-05-60`, `ADR 0033`): the headline says 90.00 is outstanding while the bar's own pair says
    // 100.00 is, because none of the 10.00 was declared against the order. Without the line nothing
    // on the page names the difference.
    await expect(page.getByText(/10\.00\s+already paid and not assigned/i).first()).toBeVisible();
  });

  test("a payment declared across two product lines waits for the server and lowers the debt", async ({ page }) => {
    skipUnlessAuthenticatedEnv();
    test.setTimeout(180_000);
    expect(createdStoreSlug, "the fixture store from the previous test").not.toBeNull();
    await signInAndLandOnDashboard(page);

    await page.goto(`/en/stores/${createdStoreSlug}`);
    await page.getByRole("button", { name: /^log payment$/i }).click();

    const sheet = paymentSheet(page);
    await expect(sheet).toBeVisible();
    await page.locator("#store-payment-amount").fill("30.00");

    // Into the allocation panel, and declare 20 + 10 across the order's two products.
    await sheet.getByRole("button", { name: /^assign$/i }).click();
    await sheet.getByLabel(new RegExp(`amount for ${ITEM_A}`, "i")).fill("20.00");
    await sheet.getByLabel(new RegExp(`amount for ${ITEM_B}`, "i")).fill("10.00");

    await sheet.getByRole("button", { name: /^register payment$/i }).click();

    // With declarations the sheet does NOT close optimistically (`FR-05-42b`): it waits for the
    // server so a refusal could still point at its own line. It closes only once the answer is in.
    await expect(sheet).toBeHidden({ timeout: 20_000 });

    // 100 − 10 (previous test) − 30 = 60.00, straight from the server.
    await expect(async () => {
      await page.goto(`/en/stores/${createdStoreSlug}`);
      await expect(remainingDebt(page)).toHaveText(/\b60\.00\b/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
  });
});
