---
id: WO-07
type: WORK_ORDER
slug: currency-reconciliation-filter-and-bulk-fx-reconciliation
title: Currency Reconciliation Filter and Bulk FX Reconciliation
status: ACTIVE
parent: BP-02
source_features:
  - FEAT-0014
source_issue: 104
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-07 Currency Reconciliation Filter and Bulk FX Reconciliation

## Summary

Add the `Needs currency update` filter to the orders list and implement the bulk FX reconciliation flow that lets collectors apply a new exchange rate to multiple orders at once after changing their base currency in Settings. The reconciliation flow is exposed as a shared modal (`FxReconciliationModal`) triggered both from a persistent orders-list banner and from the Settings currency-change confirmation. Reconciliation scope is bounded to orders from the current month onward so that dashboard rollups can make a clean cut at the month the base currency changed.

## Prerequisites

This work order must not begin until the following slices are fully implemented:

- **FRD-07 · BP-01 · [WO-05](../../../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-05-preferences-currency-country-product-types-and-budget.md)** — Base currency preference field in User Settings. `user.baseCurrencyCode` must be readable from the session and the currency-change confirmation modal must mark eligible orders before this slice can integrate.
- **FRD-05 · BP-02 · [WO-06](./wo-06-orders-list-filters-expansion-rows-and-overdue-payment-signals.md)** — Orders list with URL-backed filters. WO-07 extends the existing `parseOrderListingParams` and filter sidebar rather than building a separate list.
- **FRD-05 · BP-01 · WO-01** — `Order` Prisma schema must include `needsExchangeRateUpdate: Boolean @default(false)`. WO-01 owns the `Order` model; this field must be added as part of WO-01's schema before WO-07 implementation begins.

## In Scope

- `Needs currency update` filter option added to the orders list filter sidebar
- URL param `?fxStatus=needs_reconciliation` for the filter
- Filter chip label `Currency update needed` / `Actualización de divisa pendiente`
- Reconciliation eligibility: orders where `needsExchangeRateUpdate = true` AND `status != CANCELLED` (set by FRD-07 WO-05 when base currency changes for orders where `currencyCode !== newBaseCurrencyCode` AND `orderDate >= first day of the current month`)
- `FxReconciliationModal` shared component at `src/components/modules/FxReconciliationModal.tsx` — simple, non-multi-step modal used by both Settings and the orders list banner
- Modal shows one group per currency pair (`from → to`) with the affected order count and one exchange rate input per group
- Apply one exchange rate per group to all eligible orders in that pair; each group is an independent atomic Prisma transaction
- Defer behavior: leaving a group's rate field empty skips it; deferred orders keep `needsExchangeRateUpdate = true` and remain in the filter and banner
- `needsExchangeRateUpdate: Boolean @default(false)` field on `Order` — set to `true` by FRD-07 WO-05 on currency change, cleared to `false` by this slice's bulk reconciliation action or by a manual `exchangeRate` save in WO-04
- Persistent `info` banner in the orders list when the collector has one or more orders with `needsExchangeRateUpdate = true`; shows count and CTA to open `FxReconciliationModal`
- Visual `warning` badge on the order detail view (WO-05 extension) when the displayed order has `needsExchangeRateUpdate = true`
- Inline field warning in the order edit form (WO-04 extension) on the `exchangeRate` field when `needsExchangeRateUpdate = true`
- Reactivation edge case: when a `CANCELLED` order is reactivated to `OPEN`, the reactivation server action in WO-05 checks if `currencyCode !== user.baseCurrencyCode` and sets `needsExchangeRateUpdate = true` when true
- PostHog analytics events for filter use and bulk reconciliation actions
- Spanish and English localization

## Out of Scope

- Per-order exchange rate editing (already available via the order edit form in WO-04)
- Changing the user's base currency preference (FRD-07)
- Retroactive rewriting of stored `totalCost` or payment amounts (amounts stay anchored to order currency per FRD-05 confirmed decisions)
- Dashboard rollups and budget calculations (FRD-06)
- API-sourced exchange rate suggestions (rates are entered manually)
- Orders from months prior to the current month at the time of currency change (preserved in DB but outside reconciliation scope)
- `CANCELLED` orders (excluded from reconciliation; reactivated orders are re-evaluated at the moment of reactivation)

## Requirements

- `FR-05-36`
- `FR-05-37`
- `FR-05-38`
- `BR-05-13`
- `BR-05-14`

## Blueprints

- [BP-02](../bp-02-order-workspace-and-list-experience.md) list filter contract — `fxStatus` URL param and `FxReconciliationModal` entry point
- [BP-02](../bp-02-order-workspace-and-list-experience.md) `fxStatus` URL param convention

## Module Structure

Placement must be validated against `.cursor/rules/project-structure.mdc` and `.cursor/rules/react-next-components.mdc` at implementation time.

```
src/components/modules/
  FxReconciliationModal.tsx         Client — shared reconciliation modal; used by Settings and
                                              the orders list banner; receives eligible currency-pair
                                              groups as props and calls applyBulkExchangeRateAction

src/app/[locale]/(app)/purchases/
  page.tsx                          Extended — resolves needsExchangeRateUpdate count for banner
                                              in parallel with getOrdersList via Promise.all
  _components/
    OrderListContent.tsx            Extended — renders FxReconciliationBanner when count > 0
    FxReconciliationBanner.tsx      Client — info banner with count + CTA to open modal
  _utils/
    orderListingParams.ts           Extended — parseOrderListingParams handles
                                              ?fxStatus=needs_reconciliation
  _actions/
    fxReconciliationActions.ts      Server Actions — applyBulkExchangeRateAction,
                                                     getEligibleOrdersForReconciliation
```

`applyBulkExchangeRateAction` lives in the purchases `_actions/` folder and delegates writes to `src/lib/data/orders/orderMutations.ts`. `getEligibleOrdersForReconciliation` is added to `src/lib/data/orders/orderQueries.ts`.

## UX Notes

### Filter sidebar

The `Needs currency update` option is added to the orders list filter sidebar (WO-06 drawer pattern) as a standalone boolean filter toggle, separate from the status multi-select.

- Filter label: `Needs currency update` / `Actualización de divisa pendiente`
- Active chip label: `Currency update needed` / `Actualización de divisa pendiente`
- Removing the chip removes `?fxStatus=needs_reconciliation` from the URL

### Orders list banner

A persistent `info` banner appears at the top of the orders list content area (below the filter chips row, above the order cards) when the collector has one or more orders with `needsExchangeRateUpdate = true`.

Visual treatment: `info` variant (`bg-info/12 border border-info/35 rounded-xl`), consistent with the base-currency info banner in WO-04.

Icon: `RefreshCw` from `lucide-react`

Copy (ES): _"Tienes [N] [orden / órdenes] con el tipo de cambio desactualizado. Actualízalas para que tus reportes reflejen tu moneda base actual."_ · CTA: **"Actualizar tipos de cambio"**

Copy (EN): _"You have [N] [order / orders] with an outdated exchange rate. Update them so your reports reflect your current base currency."_ · CTA: **"Update exchange rates"**

The CTA opens `FxReconciliationModal`. The banner disappears once all eligible orders are reconciled (`needsExchangeRateUpdate = false` for all). Singular / plural copy is resolved from the count at render time.

### FxReconciliationModal

A simple, non-multi-step modal. It receives pre-fetched currency-pair groups as props.

Structure:

1. **Title** (ES): "Actualizar tipos de cambio" · (EN): "Update exchange rates"
2. **Description** (ES): "Ingresa el tipo de cambio actual para cada divisa. Se aplicará a todas las órdenes del grupo." · (EN): "Enter the current exchange rate for each currency. It will be applied to all orders in the group."
3. **Per-group row:**
   - Group label: e.g., `USD → PEN · 2 órdenes` / `USD → PEN · 2 orders`
   - Exchange rate input: label `1 [fromCurrency] =`, placeholder `0.00`, suffix showing the target currency code
   - Inline validation error below each input when the value is out of range
4. **Footer actions:**
   - `Cancelar` / `Cancel` (ghost) — closes modal without changes
   - `Aplicar` / `Apply` (primary) — submits all groups that have a value; groups with empty inputs are skipped (treated as deferred)

**Defer behavior.** Leaving a group's input empty is the deferral mechanism — no explicit "Defer" button. Deferred orders keep `needsExchangeRateUpdate = true` and remain in the banner and filter.

**Success feedback.** On successful apply the modal closes and a toast confirms: `Tipos de cambio actualizados` / `Exchange rates updated`. The banner count updates optimistically before the response settles.

**Error feedback.** If a group's transaction fails, the modal stays open and shows an inline error above the footer. Groups that already succeeded are committed and not retried.

### Order detail view indicator (WO-05 extension)

When the displayed order has `needsExchangeRateUpdate = true`, show a `warning` badge next to the exchange rate in the financial summary section:

- Icon: `AlertTriangle` from `lucide-react` (warning semantic color)
- Tooltip / helper text (ES): _"El tipo de cambio está desactualizado. Edita la orden para actualizarlo."_ · (EN): _"Exchange rate is outdated. Edit the order to update it."_

### Order edit form indicator (WO-04 extension)

When the order being edited has `needsExchangeRateUpdate = true` and the exchange rate field is visible, show an inline `warning` message below the field:

Copy (ES): _"Este tipo de cambio está desactualizado desde tu último cambio de moneda base. Actualízalo para reflejar la conversión correcta."_

Copy (EN): _"This exchange rate is outdated since your last base currency change. Update it to reflect the correct conversion."_

The WO-04 edit server action must set `needsExchangeRateUpdate = false` when a new `exchangeRate` is saved for an order that had the flag set.

### Settings entry point (FRD-07 WO-05 integration)

After the collector confirms the currency change in Settings, the two save options are:

- **"Guardar y actualizar tipos de cambio"** / **"Save and update exchange rates"** (primary): save preferences → mark eligible orders (`needsExchangeRateUpdate = true`) → open `FxReconciliationModal`
- **"Guardar sin actualizar"** / **"Save without updating"** (secondary): save preferences → mark eligible orders → close modal, show toast: _"Preferencias guardadas. Puedes actualizar los tipos de cambio desde tu lista de órdenes cuando estés listo."_ / _"Preferences saved. You can update exchange rates from your orders list when you're ready."_

The button copy in `SettingsPreferencesSection.tsx` must be updated (`currencyChangeModal.saveAndReconcile` → `currencyChangeModal.saveAndUpdate`, `currencyChangeModal.saveSkip` → `currencyChangeModal.saveWithoutUpdating`) alongside the corresponding locale keys.

## Technical Notes

### `needsExchangeRateUpdate` field

Added to the `Order` Prisma model in **FRD-05 · BP-01 · WO-01**:

```prisma
needsExchangeRateUpdate Boolean @default(false)
```

Lifecycle:

| Event                                                    | Result                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| FRD-07 WO-05 saves new `baseCurrencyCode`                | `true` for all eligible orders of this user (month filter + currency mismatch + not CANCELLED) |
| WO-07 `applyBulkExchangeRateAction` succeeds for a group | `false` for all orders in that group                                                           |
| WO-04 edit server action saves a new `exchangeRate`      | `false` for the edited order                                                                   |
| WO-05 order detail reactivates a CANCELLED order         | `true` when `currencyCode !== user.baseCurrencyCode`; unchanged otherwise                      |

### `getEligibleOrdersForReconciliation` query shape

Added to `src/lib/data/orders/orderQueries.ts`:

```ts
interface FxCurrencyPairGroup {
  fromCurrency: string;
  toCurrency: string; // always user.baseCurrencyCode
  orderCount: number;
  orderIds: string[];
}

async function getEligibleOrdersForReconciliation(
  userId: string,
  baseCurrencyCode: string,
): Promise<FxCurrencyPairGroup[]>;
```

Query: `Order` records where `userId = userId AND needsExchangeRateUpdate = true AND status != CANCELLED`. Groups by `currencyCode`. The `toCurrency` is always `baseCurrencyCode` passed from the session.

### Banner count query

`page.tsx` runs `prisma.order.count({ where: { userId, needsExchangeRateUpdate: true, status: { not: "CANCELLED" } } })` in parallel with `getOrdersList` via `Promise.all`. Banner renders only when `count > 0`. Fails silently — banner is hidden on count query error to avoid blocking the list.

### `applyBulkExchangeRateAction`

```ts
type BulkFxGroup = {
  fromCurrency: string;
  exchangeRate: number; // validated: min(0.01), max(99999.99)
};

type ApplyBulkExchangeRateResult =
  | { ok: true; reconciledCount: number }
  | { ok: false; error: "unauthorized" | "validation" | "partial_failure" | "generic"; failedCurrency?: string };

async function applyBulkExchangeRateAction(groups: BulkFxGroup[]): Promise<ApplyBulkExchangeRateResult>;
```

For each group with a provided `exchangeRate`:

1. Validate `exchangeRate` with `z.number().min(0.01).max(99999.99)` and `fromCurrency` against `ALLOWED_COLLECTOR_BASE_CURRENCY_CODES`
2. Run a Prisma transaction: `updateMany` scoped to `userId`, `currencyCode = fromCurrency`, `needsExchangeRateUpdate = true`; sets `exchangeRate` and `needsExchangeRateUpdate = false`
3. Groups are processed sequentially; each is an independent transaction

Groups with no `exchangeRate` value are skipped without error.

### `parseOrderListingParams` extension

`fxStatus` is added to the existing utility in `src/app/[locale]/(app)/purchases/_utils/orderListingParams.ts`:

```ts
interface OrderListFilters {
  // ... existing filters from WO-06
  fxStatus?: "needs_reconciliation";
}
```

When `fxStatus=needs_reconciliation` is present, `getOrdersList` adds `needsExchangeRateUpdate: true` to the Prisma `where` clause.

### Optimistic updates

`FxReconciliationBanner` and `FxReconciliationModal` are Client Components. After `applyBulkExchangeRateAction` resolves, the banner count decrements optimistically (or hides when count reaches 0) without a full page refetch per `.cursor/rules/optimistic-client-updates.mdc`. On failure the optimistic count reverts.

## Security Notes

- `applyBulkExchangeRateAction` resolves `userId` from the active session only — never from the client payload
- All `updateMany` calls include `userId` in the `where` clause to prevent cross-user order mutation
- `exchangeRate` values are validated with Zod before any database write
- `fromCurrency` in each group is validated against `ALLOWED_COLLECTOR_BASE_CURRENCY_CODES`
- The banner count query is always scoped to `userId`

## Observability Notes

- Unexpected failures in `applyBulkExchangeRateAction` are captured with Sentry, including `userId` and `fromCurrency`
- Expected Zod validation errors are not sent to Sentry
- Banner count query failures are caught and logged; the banner is hidden on error (fail-safe, not fail-open)

## Analytics

All event names are added to `POSTHOG_EVENTS` in `src/lib/constants.ts`.

| Event constant                      | When it fires                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `orders_fx_filter_applied`          | Collector activates the `?fxStatus=needs_reconciliation` filter                                  |
| `orders_fx_banner_cta_clicked`      | Collector clicks the banner CTA to open `FxReconciliationModal`                                  |
| `orders_fx_reconciliation_applied`  | `applyBulkExchangeRateAction` completes successfully; include `groupCount` and `reconciledCount` |
| `orders_fx_reconciliation_deferred` | Modal closed without applying any rate (all groups empty or cancelled)                           |
| `orders_fx_reconciliation_partial`  | Some groups applied, some skipped; include `appliedCount` and `skippedCount`                     |

## Dependencies

- **FRD-05 · BP-01 · WO-01** must add `needsExchangeRateUpdate: Boolean @default(false)` to the `Order` Prisma model before this WO is implemented.
- **FRD-07 · BP-01 · WO-05** must: (a) mark eligible orders with `needsExchangeRateUpdate = true` when currency changes; (b) open `FxReconciliationModal` when the collector chooses "Save and update exchange rates"; (c) update button copy to `currencyChangeModal.saveAndUpdate` and `currencyChangeModal.saveWithoutUpdating`.
- **FRD-05 · BP-02 · WO-05** (order detail action menu) must: (a) show the `AlertTriangle` warning badge when `needsExchangeRateUpdate = true`; (b) set `needsExchangeRateUpdate = true` on reactivation when `currencyCode !== user.baseCurrencyCode`.
- **FRD-05 · BP-02 · WO-04** (order edit form) must: (a) show the inline `warning` message on the `exchangeRate` field when `needsExchangeRateUpdate = true`; (b) set `needsExchangeRateUpdate = false` when a new `exchangeRate` is saved.

## Assumptions

- Dashboard rollup logic (FRD-06) will treat the month of the base currency change as the boundary: orders from prior months remain in DB and are shown in order currency where needed, but are excluded from single-currency budget totals until FRD-06 defines the exact rollup rules.
- The existing `Modal` core component (`src/components/core/`) is sufficient for `FxReconciliationModal`; no new modal primitive is needed.
- Plural/singular copy for the banner (`orden` / `órdenes`, `order` / `orders`) is resolved from the count at render time using the existing next-intl plural API.

## Unit Tests

### Eligibility query

| Scenario                              | `needsExchangeRateUpdate` | `status`    | `orderDate`   | Expected |
| ------------------------------------- | ------------------------- | ----------- | ------------- | -------- |
| Eligible — current month, active      | `true`                    | `OPEN`      | current month | included |
| Excluded — CANCELLED                  | `true`                    | `CANCELLED` | current month | excluded |
| Excluded — already reconciled         | `false`                   | `OPEN`      | current month | excluded |
| Excluded — prior month (flag not set) | `false`                   | `OPEN`      | prior month   | excluded |

### `applyBulkExchangeRateAction` validation

| Scenario              | `exchangeRate` | Expected      |
| --------------------- | -------------- | ------------- |
| Valid rate            | `3.78`         | Accepted      |
| At minimum            | `0.01`         | Accepted      |
| At maximum            | `99999.99`     | Accepted      |
| Below minimum         | `0.009`        | Rejected      |
| Above maximum         | `100000`       | Rejected      |
| Omitted (deferred)    | omitted        | Group skipped |
| Invalid currency code | `"FAKE"`       | Rejected      |

## E2E Acceptance Tests

### Filter

- Activating `?fxStatus=needs_reconciliation` shows only orders with `needsExchangeRateUpdate = true`
- The active chip reads `Currency update needed` / `Actualización de divisa pendiente`
- Removing the chip returns to the previous filter state without the `fxStatus` param

### Banner

- A collector with eligible orders sees the banner with the correct singular/plural count
- The banner CTA opens `FxReconciliationModal`
- After all eligible orders are reconciled, the banner disappears
- A collector with no eligible orders does not see the banner

### FxReconciliationModal — apply

- The modal shows one group per currency pair with its order count
- Entering a valid rate and clicking "Apply" updates all orders in that group (`needsExchangeRateUpdate = false`)
- The banner count updates optimistically before the server confirms
- A success toast confirms the update
- The filter list removes reconciled orders

### FxReconciliationModal — defer

- Leaving a group's rate field empty and clicking "Apply" skips that group
- Deferred orders keep `needsExchangeRateUpdate = true` and remain in the banner and filter

### Order detail — indicator

- An order with `needsExchangeRateUpdate = true` shows the `AlertTriangle` badge next to the exchange rate
- After reconciliation (bulk or individual) the badge disappears

### Order edit form — indicator

- Opening the edit form for an order with `needsExchangeRateUpdate = true` shows the inline warning on the exchange rate field
- Saving a new exchange rate clears the warning on subsequent loads

### Reactivation edge case

- Reactivating a cancelled order whose `currencyCode !== user.baseCurrencyCode` sets `needsExchangeRateUpdate = true`
- That order then appears in the banner count and the reconciliation filter

### Settings entry point

- Changing base currency and clicking "Save and update exchange rates" saves preferences, marks eligible orders, and opens `FxReconciliationModal`
- Clicking "Save without updating" saves preferences, marks eligible orders, closes the modal, and shows the informational toast
- On next visit to `/purchases`, the banner reflects the marked orders
