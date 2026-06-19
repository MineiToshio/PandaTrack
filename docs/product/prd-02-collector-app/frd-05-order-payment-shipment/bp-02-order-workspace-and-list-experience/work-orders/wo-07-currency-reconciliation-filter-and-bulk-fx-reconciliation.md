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
last_updated: 2026-06-16
implementation_status: IMPLEMENTED
---

# WO-07 Currency Reconciliation Filter and Bulk FX Reconciliation

## Summary

Add the `Needs currency update` filter to the orders list and implement the bulk FX reconciliation flow that lets collectors apply a new exchange rate to multiple orders at once. The reconciliation flow is exposed as a modal (`FxReconciliationModal`) triggered from a persistent orders-list banner (the banner + modal trigger are wired together by `FxAnnouncer`). FX-pending eligibility is driven by a **persisted per-order flag**, `Order.needsExchangeRateUpdate`: changing the base currency in Settings flags every order whose currency differs from the new base, and reconciling (or editing) an order clears the flag. There is **no** monthly cadence — tracking is per-order and triggered by the base-currency change, with no recurring "your rates are stale" nag.

> **Design note (as shipped):** FX-pending tracking is **flag-based**. A `Order.needsExchangeRateUpdate Boolean @default(false)` column (added by migration `20260616230000_add_order_needs_exchange_rate_update`) records whether an order's stored exchange rate has gone stale relative to the current base currency. The flag is **set** on a base-currency change (`flagOrdersForFxReconciliation` in `src/lib/data/orders/orderMutations.ts`, called from `updateCurrencyAction` only when the base currency actually changed) and **cleared** on order create (defaults `false`), on edit when an `exchangeRate` is submitted, and on bulk reconciliation. Reconciling an order therefore **removes** it from the FX-pending set, so the banner/count converges to zero. The FX-pending predicate (`buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts`) reads this flag; the earlier `startOfCurrentMonth` / current-month scope has been **removed**.

## Prerequisites

This work order must not begin until the following slices are fully implemented:

- **FRD-07 · BP-01 · [WO-05](../../../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-05-preferences-currency-country-product-types-and-budget.md)** — Base currency preference field in User Settings. `user.baseCurrencyCode` must be readable from the session, and the currency-change flow flags eligible orders (`flagOrdersForFxReconciliation`) before this slice can surface them.
- **FRD-05 · BP-02 · [WO-06](./wo-06-orders-list-filters-expansion-rows-and-overdue-payment-signals.md)** — Orders list with URL-backed filters. WO-07 extends the existing `parseOrderListingParams` and filter sidebar rather than building a separate list.
- **FRD-05 · BP-01 · WO-01** — `Order` Prisma schema must expose `currencyCode` and `status`. FX-pending eligibility reads the persisted `Order.needsExchangeRateUpdate` flag (added by this WO's migration) together with these columns.

## In Scope

- Persisted `Order.needsExchangeRateUpdate Boolean @default(false)` column (migration `20260616230000_add_order_needs_exchange_rate_update`), set on base-currency change and cleared on create/edit/reconcile
- `Needs currency update` filter option added to the orders list filter sidebar
- URL param `?fxPending=true` for the filter (`parseOrderListingParams` reads `raw.fxPending`; `buildOrderListFilterUrl` emits `fxPending=true`)
- Filter chip label `Currency update needed` / `Actualización de divisa pendiente`
- Reconciliation eligibility, **flag-based**: orders where `needsExchangeRateUpdate == true` AND `status != CANCELLED` AND `currencyCode !== user.baseCurrencyCode` (see `buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts`; returns `null` when the user has no base currency)
- `flagOrdersForFxReconciliation(userId, newBaseCurrencyCode)` in `src/lib/data/orders/orderMutations.ts` — two `updateMany` calls inside one `$transaction` that set the flag on foreign-currency orders and clear it on base-currency orders; flag-only, never mutates `exchangeRate`
- `FxReconciliationModal` component at `src/app/[locale]/(app)/orders/_components/FxReconciliationModal.tsx` — simple, non-multi-step modal rendered via `FxAnnouncer`
- Modal shows one group per currency pair (`from → to`) with the affected order count and one exchange rate input per group; each group offers a `Hoy` / `Today` button that prefills the latest rate from Frankfurter, and an expandable list of the affected orders
- Apply the entered exchange rate per `orderId` to all eligible orders; `updateExchangeRatesAction` runs one `updateMany` per `orderId` inside a single `prisma.$transaction`, writing `{ exchangeRate, needsExchangeRateUpdate: false }` so reconciled orders leave the FX-pending set
- Defer behavior: leaving a group's rate field empty skips it; those orders keep `needsExchangeRateUpdate == true`, so they remain in the filter and banner
- Persistent `info` banner in the orders list when one or more orders are flagged FX-pending; shows count and CTA to open `FxReconciliationModal`
- PostHog analytics events for filter use and bulk reconciliation actions
- Spanish and English localization

## Out of Scope

- Per-order exchange rate editing (already available via the order edit form in WO-04)
- Changing the user's base currency preference (FRD-07)
- Retroactive rewriting of stored `totalCost` or payment amounts (amounts stay anchored to order currency per FRD-05 confirmed decisions)
- Dashboard rollups and budget calculations (FRD-06)
- API-sourced exchange rate suggestions for the bulk flow (the `Today` button is a manual prefill; entered rates are confirmed by the collector)
- A recurring / monthly FX-staleness cadence (deliberately not built — tracking is per-order and base-change-triggered, with no monthly nag)
- `CANCELLED` orders (excluded from the FX-pending view, but the flag is **preserved** through cancellation; reactivating an order naturally re-surfaces it because the predicate only excludes cancelled status — there is no separate reactivation-time FX code path, and none is needed)

## Requirements

- `FR-05-36`
- `FR-05-37`
- `FR-05-38`
- `BR-05-13`
- `BR-05-14`

## Blueprints

- [BP-02](../bp-02-order-workspace-and-list-experience.md) list filter contract — `fxPending` URL param and `FxReconciliationModal` entry point
- [BP-02](../bp-02-order-workspace-and-list-experience.md) `fxPending=true` URL param convention

## Module Structure

Placement must be validated against `.agents/rules/project-structure.mdc` and `.agents/rules/react-next-components.mdc` at implementation time.

```
prisma/
  schema.prisma                     Extended — Order.needsExchangeRateUpdate Boolean @default(false)
  migrations/20260616230000_add_order_needs_exchange_rate_update/
    migration.sql                   Adds the needsExchangeRateUpdate column
src/lib/data/orders/
  orderQueries.ts                   Extended — buildFxPendingWhere reads needsExchangeRateUpdate;
                                              getOrdersList returns pendingFxCount
  orderMutations.ts                 Extended — flagOrdersForFxReconciliation (set/clear flag);
                                              editOrder clears the flag when an exchangeRate is submitted
  _tests/
    fxReconciliationFlag.test.ts    Unit — covers flagOrdersForFxReconciliation
src/app/[locale]/(app)/orders/
  page.tsx                          Extended — getOrdersList returns pendingFxCount
                                              and the FX-pending orders feed FxAnnouncer
  _components/
    FxAnnouncer.tsx                 Client — combines the banner + modal trigger; renders
                                              FxBanner and FxReconciliationModal together
    FxBanner.tsx                    Client — info banner with count + CTA to open the modal
    FxReconciliationModal.tsx       Client — reconciliation modal; receives the FX-pending
                                              orders, groups by currency pair, calls
                                              updateExchangeRatesAction
  _utils/
    orderListingParams.ts           Extended — parseOrderListingParams reads ?fxPending=true
  _actions/
    orderFxActions.ts               Server Action — updateExchangeRatesAction
```

`updateExchangeRatesAction` lives in `src/app/[locale]/(app)/orders/_actions/orderFxActions.ts` and writes `{ exchangeRate, needsExchangeRateUpdate: false }` via `prisma.order.updateMany` inside one `prisma.$transaction` (scoped to `userId`). The FX-pending count and the eligible-orders set are computed by `getOrdersList` / `buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts` from the persisted flag.

## UX Notes

### Filter sidebar

The `Needs currency update` option is added to the orders list filter sidebar (WO-06 drawer pattern) as a standalone boolean filter toggle, separate from the status multi-select.

- Filter label: `Needs currency update` / `Actualización de divisa pendiente`
- Active chip label: `Currency update needed` / `Actualización de divisa pendiente`
- Removing the chip removes `?fxPending=true` from the URL

### Orders list banner

A persistent `info` banner appears at the top of the orders list content area (below the filter chips row, above the order cards) when one or more orders are flagged FX-pending (`pendingFxCount > 0`).

Visual treatment: `info` variant (`bg-info/12 border border-info/35 rounded-xl`), consistent with the base-currency info banner in WO-04.

Icon: `RefreshCw` from `lucide-react`

Copy (ES): _"Tienes [N] [pedido / pedidos] con el tipo de cambio desactualizado. Actualízalos para que tus reportes reflejen tu moneda base actual."_ · CTA: **"Actualizar tipos de cambio"**

Copy (EN): _"You have [N] [order / orders] with an outdated exchange rate. Update them so your reports reflect your current base currency."_ · CTA: **"Update exchange rates"**

The CTA opens `FxReconciliationModal`. The banner disappears once no order is flagged FX-pending. **As shipped:** reconciling an order through the modal clears its `needsExchangeRateUpdate` flag, so the order leaves the count immediately on the next refetch and the banner converges to zero as the collector works through the set. The count also drops when an order is edited with a fresh exchange rate, or when a subsequent base-currency change clears the flag for orders now matching the base. Singular / plural copy is resolved from the count at render time.

### FxReconciliationModal

A simple, non-multi-step modal. It receives pre-fetched currency-pair groups as props.

Structure:

1. **Title** (ES): "Actualizar tipos de cambio" · (EN): "Update exchange rates"
2. **Description** (ES): "Ingresa el tipo de cambio actual para cada divisa. Se aplicará a todos los pedidos del grupo." · (EN): "Enter the current exchange rate for each currency. It will be applied to all orders in the group."
3. **Per-group row** (one per `from → to` currency pair):
   - Group label: e.g., `USD → PEN · 2 pedidos` / `USD → PEN · 2 orders`
   - Exchange rate input: label `1 [fromCurrency] =`, placeholder `0.00`, suffix showing the target currency code
   - `Hoy` / `Today` button: prefills the rate input with the latest market rate for that pair, fetched from Frankfurter (`fetchTodayRate` in `src/lib/fx/frankfurter.ts`); shows a loading state and an inline error if the fetch fails
   - Expandable list of the affected orders in the group (toggle), so the collector can see which orders the rate will touch
   - Inline validation error below each input when the value is out of range
4. **Footer actions:**
   - `Cancelar` / `Cancel` (ghost) — closes modal without changes
   - `Aplicar` / `Apply` (primary) — submits all groups that have a value; groups with empty inputs are skipped (treated as deferred)

**Defer behavior.** Leaving a group's input empty is the deferral mechanism — no explicit "Defer" button. Those orders keep `needsExchangeRateUpdate == true`, so they remain in the banner and filter.

**Success feedback (as shipped).** The action is **awaited** (not optimistic): on success the modal shows a success toast (`fx.modal.successToast`), closes, and calls `router.refresh()` to refetch the server-rendered list. Because the action clears `needsExchangeRateUpdate` on every reconciled order, that refetch recomputes a lower `pendingFxCount` and the reconciled orders drop out of the banner and filter.

**Error feedback (as shipped).** On `{ success: false }` the modal shows an error toast (`fx.modal.errorToast`) and stays open. Because all writes run in one `prisma.$transaction`, a failed write rolls back every update together — there is no per-group partial commit.

### Order detail / edit form indicators (not yet rendered)

The per-order FX indicators are **implemented**, driven by the persisted `Order.needsExchangeRateUpdate` flag (added to the `getOrderById` / `getOrderDetail` payloads): a `warning` chip (`FX update pending` / `Tipo de cambio pendiente`) renders in the order-detail hero next to the status/overdue/unpaid chips (hidden on cancelled orders), and an inline `warning` (`exchangeRateOutdatedWarning`) renders under the edit-form `exchangeRate` field. Both clear naturally once the order is reconciled or its rate is re-submitted (the flag flips to `false`).

### Settings entry point (FRD-07 WO-05 integration — shipped)

The Settings-side flow is **implemented**. On a confirmed base-currency change, `updateCurrencyAction` (`src/app/[locale]/(app)/settings/_actions/preferencesActions.ts`) calls `flagOrdersForFxReconciliation` (only when the base currency actually changed), flagging every foreign-currency order, then — on Path A ("Save and update exchange rates") — returns `redirectToFxReconcile: true` so the client navigates to `/{locale}/orders`, where the reconciliation banner + `FxReconciliationModal` surface the flagged orders. The action **never** mutates `exchangeRate`; it only sets the flag.

## Technical Notes

### FX-pending eligibility (persisted flag)

Eligibility reads the persisted `Order.needsExchangeRateUpdate` column via `buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts`:

```ts
function buildFxPendingWhere(userId: string, baseCurrencyCode: string | null | undefined) {
  if (!baseCurrencyCode) return null;
  return {
    userId,
    needsExchangeRateUpdate: true,
    status: { not: "CANCELLED" as OrderStatus },
    currencyCode: { not: baseCurrencyCode },
  };
}
```

The same predicate drives the banner count. The list filter (`?fxPending=true`) applies the equivalent constraints inline in `getOrdersList` via `fxFilterBase` (`{ currencyCode: { not: base } }`) + `fxFilterFlag` (`{ needsExchangeRateUpdate: true }`). An order leaves the FX-pending set when its flag is cleared (reconciled, edited with a fresh rate, or the base currency changes to its currency), or it is cancelled. The `startOfCurrentMonth` / current-month scope has been **removed** — there is no monthly window.

### Setting and clearing the flag

- **Set** on base-currency change: `flagOrdersForFxReconciliation(userId, newBaseCurrencyCode)` in `src/lib/data/orders/orderMutations.ts` runs two `updateMany` calls inside one `$transaction` — `needsExchangeRateUpdate: true` where `currencyCode != newBase`, and `false` where `currencyCode == newBase`. It does **not** mutate `exchangeRate`.
- **Cleared** on order create (defaults `false` — a fresh rate is captured at creation), on edit when `input.exchangeRate !== undefined` (`editOrder` writes `needsExchangeRateUpdate: false`), and on bulk reconciliation (`updateExchangeRatesAction` writes `{ exchangeRate, needsExchangeRateUpdate: false }`).
- **Preserved** through cancellation: cancelled orders keep their flag, so reactivating one re-surfaces it (the predicate excludes cancelled status only). No separate reactivation-time FX code path exists or is needed.

### Banner count

`getOrdersList` returns `pendingFxCount` alongside the list: it runs `prisma.order.count({ where: buildFxPendingWhere(...) })` in the same `Promise.all` as the list query (returns `0` when the user has no base currency). The banner renders only when `pendingFxCount > 0`. The FX-pending orders themselves are passed to `FxAnnouncer` from `page.tsx`.

### `updateExchangeRatesAction`

Lives in `src/app/[locale]/(app)/orders/_actions/orderFxActions.ts`:

```ts
const updateSchema = z.object({
  updates: z
    .array(z.object({ orderId: z.string().min(1), exchangeRate: z.number().positive().finite() }))
    .min(1)
    .max(500),
});

async function updateExchangeRatesAction(input: {
  updates: Array<{ orderId: string; exchangeRate: number }>;
}): Promise<UpdateExchangeRatesResult>;
```

- Input is a flat array of `{ orderId, exchangeRate }` (one entry per order, not per currency-code group).
- `exchangeRate` validation is `z.number().positive().finite()` only — **no** `min`, `max`, or decimal-precision constraint.
- Writes run as **one `prisma.order.updateMany` per `orderId`** (scoped to `id` + session `userId`), each setting `{ exchangeRate, needsExchangeRateUpdate: false }`, all inside a **single `prisma.$transaction`** — not sequential per-currency transactions. Clearing the flag is what removes the order from the FX-pending set.
- Result: `{ success: true; updatedCount }` or `{ success: false; error: "unauthorized" | "invalid" | "server_error" }`.
- Calls `revalidatePath("/[locale]/orders", "page")` on success.

### `parseOrderListingParams` extension

The `fxPending` boolean is read from `raw.fxPending` in `src/app/[locale]/(app)/orders/_utils/orderListingParams.ts` (`fxPendingOnly`), and `buildOrderListFilterUrl` emits `fxPending=true`. When `fxPendingOnly` is set (and a base currency exists), `getOrdersList` adds `{ currencyCode: { not: baseCurrencyCode } }` (`fxFilterBase`) and `{ needsExchangeRateUpdate: true }` (`fxFilterFlag`) to the list `where` clause.

## Security Notes

- `updateExchangeRatesAction` resolves `userId` from the active session only — never from the client payload
- Each `updateMany` call includes `userId` in the `where` clause (alongside the `orderId`) to prevent cross-user order mutation
- `exchangeRate` values are validated with Zod (`positive().finite()`) before any database write
- The FX-pending count query (`buildFxPendingWhere`) is always scoped to `userId`

## Observability Notes

- Unexpected failures in `updateExchangeRatesAction` are captured with Sentry (tagged `orders.fx-reconciliation`)
- Expected Zod validation errors return `{ success: false, error: "invalid" }` and are not sent to Sentry

## Analytics

As shipped, the FX banner and `FxReconciliationModal` do **not** fire dedicated PostHog events. Activating the FX-pending filter is covered by the generic `POSTHOG_EVENTS.ORDER.LIST_FILTERED` event emitted from the orders list filters (`OrderListFilters.tsx`); there are no `orders_fx_*` events in `POSTHOG_EVENTS`. Adding FX-specific reconciliation analytics is open as a future enhancement.

## Dependencies

- **FRD-05 · BP-01 · WO-01** provides the `Order` model with `currencyCode` and `status`, which the FX-pending predicate reads alongside the new `needsExchangeRateUpdate` flag. This WO adds that column via migration `20260616230000_add_order_needs_exchange_rate_update`.
- **FRD-07 · BP-01 · WO-05** owns the user's `baseCurrencyCode` preference and the Settings-side trigger. Its `updateCurrencyAction` calls `flagOrdersForFxReconciliation` on a real base-currency change, flagging the orders this WO then surfaces. This integration is **shipped**.
- **Implemented:** per-order FX indicators — a warning chip on the order-detail hero and an inline warning on the edit-form `exchangeRate` field, both driven by the persisted `needsExchangeRateUpdate` flag.

## Assumptions

- Dashboard rollup logic (FRD-06) can use `needsExchangeRateUpdate` as the per-order signal that a stored conversion is stale: flagged orders are shown in order currency where needed but excluded from single-currency budget totals until reconciled, per the exact rollup rules FRD-06 defines. There is no monthly boundary — staleness is tracked per order from the base-currency change.
- The existing `Modal` core component (`src/components/core/`) is sufficient for `FxReconciliationModal`; no new modal primitive is needed.
- Plural/singular copy for the banner (`pedido` / `pedidos`, `order` / `orders`) is resolved from the count at render time using the existing next-intl plural API.

## Unit Tests

### FX-pending eligibility (`buildFxPendingWhere`, flag-based)

Eligibility is decided by the persisted `needsExchangeRateUpdate` flag together with `currencyCode` and `status`.

| Scenario                             | `needsExchangeRateUpdate` | `currencyCode` vs base | `status`    | Expected                       |
| ------------------------------------ | ------------------------- | ---------------------- | ----------- | ------------------------------ |
| Eligible — flagged, active, ≠base    | `true`                    | differs                | `OPEN`      | included                       |
| Excluded — not flagged               | `false`                   | differs                | `OPEN`      | excluded                       |
| Excluded — CANCELLED (flag kept)     | `true`                    | differs                | `CANCELLED` | excluded                       |
| Excluded — matches base currency     | `true`                    | same                   | `OPEN`      | excluded                       |
| Excluded — user has no base currency | `true`                    | n/a                    | `OPEN`      | excluded (predicate is `null`) |

### `flagOrdersForFxReconciliation`

Covered by `src/lib/data/orders/_tests/fxReconciliationFlag.test.ts`:

| Scenario                                          | Expected                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Flags orders whose currency differs from new base | `updateMany` with `{ currencyCode: { not: base } }` → `needsExchangeRateUpdate: true` |
| Clears flag on orders already in new base         | `updateMany` with `{ currencyCode: base }` → `needsExchangeRateUpdate: false`         |
| Atomicity                                         | both `updateMany` calls run inside a single `$transaction`                            |

### `updateExchangeRatesAction` validation

The schema is `z.number().positive().finite()` — **no** `min`, `max`, or precision bounds.

| Scenario              | `exchangeRate` | Expected              |
| --------------------- | -------------- | --------------------- |
| Valid rate            | `3.78`         | Accepted              |
| Very small positive   | `0.001`        | Accepted (no `min`)   |
| Very large            | `100000`       | Accepted (no `max`)   |
| Zero                  | `0`            | Rejected (`positive`) |
| Negative              | `-1`           | Rejected (`positive`) |
| Non-finite            | `Infinity`     | Rejected (`finite`)   |
| Empty `updates` array | `[]`           | Rejected (`min(1)`)   |

## E2E Acceptance Tests

### Filter

- Activating `?fxPending=true` shows only flagged FX-pending orders (`needsExchangeRateUpdate == true`, currency ≠ base, not CANCELLED)
- The active chip reads `Currency update needed` / `Actualización de divisa pendiente`
- Removing the chip returns to the previous filter state without the `fxPending` param

### Banner

- A collector with FX-pending orders sees the banner with the correct singular/plural count
- The banner CTA opens `FxReconciliationModal`
- The banner count drops as orders are reconciled and the banner disappears once no order is flagged FX-pending; reconciling, editing with a fresh rate, or changing the base back all clear the flag
- A collector with no FX-pending orders does not see the banner

### Settings → orders handoff

- Changing the base currency and confirming flags every foreign-currency order; on "Save and update exchange rates" the collector lands on `/orders` with the FX-pending banner already showing the flagged count

### FxReconciliationModal — apply

- The modal shows one group per currency pair with its order count
- Each group offers a `Today` button that prefills the latest Frankfurter rate, and an expandable list of the affected orders
- Entering a valid rate and clicking "Apply" updates the orders' `exchangeRate` and clears their flag
- After the action resolves, the reconciled orders leave the filter/banner because `needsExchangeRateUpdate` is now `false`

### FxReconciliationModal — defer

- Leaving a group's rate field empty and clicking "Apply" skips that group
- Those orders keep `needsExchangeRateUpdate == true` and remain in the banner and filter

### Not yet rendered

- Per-order FX indicators (order-detail hero chip, edit-form inline warning) are **implemented** and covered by `e2e/orders.spec.ts` (the FX reconciliation test asserts the detail chip and the edit-form warning appear once an order is flagged).
