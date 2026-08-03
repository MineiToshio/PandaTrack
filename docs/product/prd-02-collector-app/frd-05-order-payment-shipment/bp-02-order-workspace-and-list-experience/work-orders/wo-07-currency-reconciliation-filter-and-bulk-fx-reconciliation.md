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
last_updated: 2026-08-03
implementation_status: IMPLEMENTED
---

# WO-07 Currency Reconciliation Filter and Bulk FX Reconciliation

## Summary

Add the `Needs currency update` filter to the orders list and implement the bulk FX reconciliation flow that lets collectors apply a new exchange rate to multiple orders at once. The reconciliation flow is exposed as a modal (`FxReconciliationModal`) triggered from a persistent orders-list banner (the banner + modal trigger are wired together by `FxAnnouncer`). FX-pending eligibility is **derived per order** from the row's own currency data: an order is pending while its stored `exchangeRate` cannot convert it into the collector's current base currency. Changing the base currency in Settings writes nothing; reconciling (or editing) an order records a rate together with the base it converts into, which is what takes the order out of the set. There is **no** monthly cadence — staleness is per-order, with no recurring "your rates are stale" nag.

> **Design note (as shipped):** FX-pending tracking is **derived, not stored** (ADR 0024, `docs/design/decisions/0024-fx-reconciliation-derived-from-rate-base.md`). `Order.exchangeRateBaseCode String?` records the base currency the stored `exchangeRate` converts INTO, written by every path that persists a rate and `null` when there is no usable rate. The predicate lives once, in `src/lib/fx/reconciliation.ts` (`needsFxReconciliation` for in-memory checks, `buildNeedsFxReconciliationWhere` for the matching Prisma fragment), so the filter, the banner count, the modal rows and the dashboard rollup are one definition expressed twice rather than two that can drift. The earlier boolean `Order.needsExchangeRateUpdate` and its bulk-flagging helper were removed by migration `20260803053836_derive_fx_reconciliation_from_rate_base`, which backfills `exchangeRateBaseCode` only where the old flag vouched for the rate; rows that were still flagged keep a `NULL` base and stay pending until reconciled once. The `startOfCurrentMonth` / current-month scope was already removed earlier and does not return.

## Prerequisites

This work order must not begin until the following slices are fully implemented:

- **FRD-07 · BP-01 · [WO-05](../../../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-05-preferences-currency-country-product-types-and-budget.md)** — Base currency preference field in User Settings. `user.baseCurrencyCode` must be readable from the session, because it is the value the FX-pending derivation compares each order's stored rate against.
- **FRD-05 · BP-02 · [WO-06](./wo-06-orders-list-filters-expansion-rows-and-overdue-payment-signals.md)** — Orders list with URL-backed filters. WO-07 extends the existing `parseOrderListingParams` and filter sidebar rather than building a separate list.
- **FRD-05 · BP-01 · WO-01** — `Order` Prisma schema must expose `currencyCode` and `status`. FX-pending eligibility reads `exchangeRate` and `exchangeRateBaseCode` together with these columns.

## In Scope

- `Order.exchangeRateBaseCode String?` column (migration `20260803053836_derive_fx_reconciliation_from_rate_base`): the base currency the stored `exchangeRate` converts into, written on create/edit/reconcile and `null` when there is no usable rate
- `Needs currency update` filter option added to the orders list filter sidebar
- URL param `?fxPending=true` for the filter (`parseOrderListingParams` reads `raw.fxPending`; `buildOrderListFilterUrl` emits `fxPending=true`)
- Filter chip label `Currency update needed` / `Actualización de divisa pendiente`
- Reconciliation eligibility, **derived**: orders where `status != CANCELLED` AND `currencyCode !== user.baseCurrencyCode` AND the stored rate cannot convert into that base (missing, `<= 0`, or `exchangeRateBaseCode !== user.baseCurrencyCode`) (see `buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts`, which composes `buildNeedsFxReconciliationWhere`; returns `null` when the user has no base currency)
- `needsFxReconciliation` / `buildNeedsFxReconciliationWhere` / `resolveExchangeRateBaseCode` in `src/lib/fx/reconciliation.ts` — the single definition of "needs reconciliation" and of the base code to stamp next to a rate being written; a base-currency change performs no order write at all
- `FxReconciliationModal` component at `src/app/[locale]/(app)/orders/_components/FxReconciliationModal.tsx` — simple, non-multi-step modal rendered via `FxAnnouncer`
- Modal shows one group per currency pair (`from → to`) with the affected order count and one exchange rate input per group; each group offers a `Hoy` / `Today` button that prefills the latest published rate, and an expandable list of the affected orders
- Apply the entered exchange rate per `orderId` to all eligible orders; `updateExchangeRatesAction` runs one `updateMany` per `orderId` inside a single `prisma.$transaction`, writing `{ exchangeRate, exchangeRateBaseCode }` so reconciled orders leave the FX-pending set
- Defer behavior: leaving a group's rate field empty skips it; those orders keep a rate that cannot convert into the current base, so they remain in the filter and banner
- Persistent `info` banner in the orders list when one or more orders read as FX-pending; shows count and CTA to open `FxReconciliationModal`
- PostHog analytics events for filter use and bulk reconciliation actions
- Spanish and English localization

## Out of Scope

- Per-order exchange rate editing (already available via the order edit form in WO-04)
- Changing the user's base currency preference (FRD-07)
- Retroactive rewriting of stored `totalCost` or payment amounts (amounts stay anchored to order currency per FRD-05 confirmed decisions)
- Dashboard rollups and budget calculations (FRD-06)
- API-sourced exchange rate suggestions for the bulk flow (the `Today` button is a manual prefill; entered rates are confirmed by the collector)
- A recurring / monthly FX-staleness cadence (deliberately not built — tracking is per-order and base-change-triggered, with no monthly nag)
- `CANCELLED` orders (excluded from the FX-pending view, but nothing about the rate changes while an order is cancelled; reactivating one naturally re-surfaces it because the predicate only excludes cancelled status — there is no separate reactivation-time FX code path, and none is needed)

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
  schema.prisma                     Extended — Order.exchangeRateBaseCode String?
  migrations/20260803053836_derive_fx_reconciliation_from_rate_base/
    migration.sql                   Adds exchangeRateBaseCode, backfills it, drops the old flag
src/lib/fx/
  reconciliation.ts                 needsFxReconciliation, buildNeedsFxReconciliationWhere,
                                              resolveExchangeRateBaseCode — the single definition
  _tests/
    reconciliation.test.ts          Unit — covers the derivation and its Prisma fragment
src/lib/data/orders/
  orderQueries.ts                   Extended — buildFxPendingWhere composes the shared fragment;
                                              getOrdersList returns pendingFxCount
  orderMutations.ts                 Extended — applyOrderExchangeRates stamps the base alongside
                                              the rate; createOrder / editOrder do the same
  _tests/
    orderFxRateBase.test.ts         Unit — covers stamping the base on create/edit
    applyOrderExchangeRates.test.ts Unit — covers the bulk reconciliation write
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

`updateExchangeRatesAction` lives in `src/app/[locale]/(app)/orders/_actions/orderFxActions.ts` and delegates to `applyOrderExchangeRates(userId, baseCurrencyCode, updates)`, which writes `{ exchangeRate, exchangeRateBaseCode }` via `prisma.order.updateMany` inside one `prisma.$transaction` (scoped to `userId`). The FX-pending count and the eligible-orders set are computed by `getOrdersList` / `buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts` from the shared derivation, not from any stored flag.

## UX Notes

### Filter sidebar

The `Needs currency update` option is added to the orders list filter sidebar (WO-06 drawer pattern) as a standalone boolean filter toggle, separate from the status multi-select.

- Filter label: `Needs currency update` / `Actualización de divisa pendiente`
- Active chip label: `Currency update needed` / `Actualización de divisa pendiente`
- Removing the chip removes `?fxPending=true` from the URL

### Orders list banner

A persistent `info` banner appears at the top of the orders list content area (below the filter chips row, above the order cards) when one or more orders read as FX-pending (`pendingFxCount > 0`).

Visual treatment: `info` variant (`bg-info/12 border border-info/35 rounded-xl`), consistent with the base-currency info banner in WO-04.

Icon: `RefreshCw` from `lucide-react`

Copy (ES): _"Tienes [N] [pedido / pedidos] con el tipo de cambio desactualizado. Actualízalos para que tus reportes reflejen tu moneda base actual."_ · CTA: **"Actualizar tipos de cambio"**

Copy (EN): _"You have [N] [order / orders] with an outdated exchange rate. Update them so your reports reflect your current base currency."_ · CTA: **"Update exchange rates"**

The CTA opens `FxReconciliationModal`. The banner disappears once no order reads as FX-pending. **As shipped:** reconciling an order through the modal stores its rate together with the base currency it converts into, so the order leaves the count immediately on the next refetch and the banner converges to zero as the collector works through the set. The count also drops when an order is edited with a fresh exchange rate, or when a subsequent base-currency change makes the orders' stored rates valid again (including returning to a previously used base). Singular / plural copy is resolved from the count at render time.

### FxReconciliationModal

A simple, non-multi-step modal. It receives pre-fetched currency-pair groups as props.

Structure:

1. **Title** (ES): "Actualizar tipos de cambio" · (EN): "Update exchange rates"
2. **Description** (ES): "Ingresa el tipo de cambio actual para cada divisa. Se aplicará a todos los pedidos del grupo." · (EN): "Enter the current exchange rate for each currency. It will be applied to all orders in the group."
3. **Per-group row** (one per `from → to` currency pair):
   - Group label: e.g., `USD → PEN · 2 pedidos` / `USD → PEN · 2 orders`
   - Exchange rate input: label `1 [fromCurrency] =`, placeholder `0.00`, suffix showing the target currency code
   - `Hoy` / `Today` button: prefills the rate input with the latest market rate for that pair, fetched from the published-rates provider (`fetchTodayRate` in `src/lib/fx/exchangeRates.ts`); shows a loading state and an inline error if the fetch fails, and renders the provider credit the terms require
   - Expandable list of the affected orders in the group (toggle), so the collector can see which orders the rate will touch
   - Inline validation error below each input when the value is out of range
4. **Footer actions:**
   - `Cancelar` / `Cancel` (ghost) — closes modal without changes
   - `Aplicar` / `Apply` (primary) — submits all groups that have a value; groups with empty inputs are skipped (treated as deferred)

**Defer behavior.** Leaving a group's input empty is the deferral mechanism — no explicit "Defer" button. Those orders keep a rate that cannot convert into the current base, so they remain in the banner and filter.

**Success feedback (as shipped).** The action is **awaited** (not optimistic): on success the modal shows a success toast (`fx.modal.successToast`), closes, and calls `router.refresh()` to refetch the server-rendered list. Because the action stamps `exchangeRateBaseCode` alongside each reconciled rate, that refetch recomputes a lower `pendingFxCount` and the reconciled orders drop out of the banner and filter. The action revalidates `/[locale]/dashboard` as well as `/[locale]/orders`, since the dashboard banner reads the same derivation.

**Error feedback (as shipped).** On `{ success: false }` the modal shows an error toast (`fx.modal.errorToast`) and stays open. Because all writes run in one `prisma.$transaction`, a failed write rolls back every update together — there is no per-group partial commit.

### Order detail / edit form indicators (not yet rendered)

The per-order FX indicators are **implemented**. The UI is unchanged; only its source moved: the `needsExchangeRateUpdate` boolean in the `getOrderById` / `getOrderDetail` payloads is now **derived at read time** from the order's `currencyCode`, `exchangeRate` and `exchangeRateBaseCode` against the collector's base currency, not read from a column. A `warning` chip (`FX update pending` / `Tipo de cambio pendiente`) renders in the order-detail hero next to the status/overdue/unpaid chips (hidden on cancelled orders), and an inline `warning` (`exchangeRateOutdatedWarning`) renders under the edit-form `exchangeRate` field. Both clear naturally once the order is reconciled or its rate is re-submitted, because the saved rate is stamped with the current base.

### Settings entry point (FRD-07 WO-05 integration — shipped)

The Settings-side flow is **implemented**. On a confirmed base-currency change, `updateCurrencyAction` (`src/app/[locale]/(app)/settings/_actions/preferencesActions.ts`) persists the preference and **writes nothing to any order**; it then derives `pendingFxOrderCount` via `countOrdersPendingFxReconciliation` and, when it is `> 0`, the pane offers the optional `"Actualizar tasas · {n} pedidos →"` shortcut to `/{locale}/orders?fxPending=true`, where the reconciliation banner + `FxReconciliationModal` surface the pending orders. The action **never** mutates `exchangeRate`.

## Technical Notes

### FX-pending eligibility (derived)

Eligibility is derived from the order's own currency data. `buildFxPendingWhere` in `src/lib/data/orders/orderQueries.ts` composes the shared fragment from `src/lib/fx/reconciliation.ts`:

```ts
function buildFxPendingWhere(userId: string, baseCurrencyCode: string | null | undefined) {
  const fxWhere = buildNeedsFxReconciliationWhere(baseCurrencyCode);
  if (!fxWhere) return null;
  return {
    userId,
    status: { not: "CANCELLED" as OrderStatus },
    ...fxWhere,
  };
}
```

`buildNeedsFxReconciliationWhere` expands to `currencyCode != base` AND (`exchangeRate` is `null` OR `<= 0` OR `exchangeRateBaseCode` is `null` OR `exchangeRateBaseCode != base`). The `exchangeRateBaseCode: null` arm is spelled out rather than folded into `{ not: base }` because SQL three-valued logic drops `NULL` rows from a `<>` comparison, which would hide every never-reconciled order from the list built to surface it.

The same predicate drives the banner count, the modal rows and the list filter (`?fxPending=true`, which reuses `buildNeedsFxReconciliationWhere` inside `getOrdersList`), so none of them can disagree — and the in-memory `needsFxReconciliation` used by the dashboard rollup is the same rule. An order leaves the FX-pending set when a rate is written together with the current base, or it is cancelled. There is no monthly window.

### Writing the rate base

- **On a base-currency change:** nothing is written. The derivation simply compares against the new base, which also makes a `PEN → EUR → PEN` round trip self-healing instead of re-marking valid rates.
- **On write paths:** order create and edit (when `input.exchangeRate !== undefined`) and bulk reconciliation all persist `exchangeRateBaseCode` next to the rate, via `resolveExchangeRateBaseCode(exchangeRate, baseCurrencyCode)` — which returns `null` whenever there is no usable rate, so a cleared rate never leaves a stale base behind claiming the order is reconciled.
- **Through cancellation:** nothing about a cancelled order's rate changes, so reactivating one re-surfaces it (the predicate excludes cancelled status only). No separate reactivation-time FX code path exists or is needed.

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
- Writes run through `applyOrderExchangeRates(userId, baseCurrencyCode, updates)` as **one `prisma.order.updateMany` per `orderId`** (scoped to `id` + session `userId`), each setting `{ exchangeRate, exchangeRateBaseCode }`, all inside a **single `prisma.$transaction`** — not sequential per-currency transactions. Stamping the base is what removes the order from the FX-pending set.
- Result: `{ success: true; updatedCount }` or `{ success: false; error: "unauthorized" | "invalid" | "server_error" }`.
- Calls `revalidatePath("/[locale]/orders", "page")` **and** `revalidatePath("/[locale]/dashboard", "page")` on success, because the dashboard banner reads the same derivation and would otherwise stay stale.

### `parseOrderListingParams` extension

The `fxPending` boolean is read from `raw.fxPending` in `src/app/[locale]/(app)/orders/_utils/orderListingParams.ts` (`fxPendingOnly`), and `buildOrderListFilterUrl` emits `fxPending=true`. When `fxPendingOnly` is set (and a base currency exists), `getOrdersList` merges `buildNeedsFxReconciliationWhere(baseCurrencyCode)` into the list `where` clause, so the filter and the count share one predicate.

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

- **FRD-05 · BP-01 · WO-01** provides the `Order` model with `currencyCode` and `status`, which the FX-pending predicate reads alongside `exchangeRate` and `exchangeRateBaseCode`. This WO owns that base-code column via migration `20260803053836_derive_fx_reconciliation_from_rate_base`.
- **FRD-07 · BP-01 · WO-05** owns the user's `baseCurrencyCode` preference. Its `updateCurrencyAction` performs no order write; it only moves the base the derivation compares against and surfaces the optional shortcut into the flow this WO owns. This integration is **shipped**.
- **Implemented:** per-order FX indicators — a warning chip on the order-detail hero and an inline warning on the edit-form `exchangeRate` field, both driven by the derived `needsExchangeRateUpdate` value in the detail payloads.

## Assumptions

- Dashboard rollup logic (FRD-06) uses the **same derivation** as this flow (`needsFxReconciliation` from `src/lib/fx/reconciliation.ts`) as the per-order signal that a stored conversion cannot be used: pending orders are shown in order currency where needed but excluded from single-currency budget totals until reconciled, per the exact rollup rules FRD-06 defines. It must not use a separate rule of its own — the two definitions previously drifted, which is what ADR 0024 removed. There is no monthly boundary.
- The existing `Modal` core component (`src/components/core/`) is sufficient for `FxReconciliationModal`; no new modal primitive is needed.
- Plural/singular copy for the banner (`pedido` / `pedidos`, `order` / `orders`) is resolved from the count at render time using the existing next-intl plural API.

## Unit Tests

### FX-pending eligibility (`buildFxPendingWhere`, derived)

Eligibility is decided by `exchangeRate` and `exchangeRateBaseCode` together with `currencyCode` and `status`. Covered by `src/lib/fx/_tests/reconciliation.test.ts`.

| Scenario                                 | `exchangeRate` | `exchangeRateBaseCode` | `currencyCode` vs base | `status`    | Expected                       |
| ---------------------------------------- | -------------- | ---------------------- | ---------------------- | ----------- | ------------------------------ |
| Eligible — rate tagged with another base | `3.39`         | `EUR` (base is `PEN`)  | differs                | `OPEN`      | included                       |
| Eligible — never reconciled              | `null`         | `null`                 | differs                | `OPEN`      | included                       |
| Eligible — unusable rate                 | `0`            | `null`                 | differs                | `OPEN`      | included                       |
| Excluded — rate tagged with current base | `3.39`         | `PEN` (base is `PEN`)  | differs                | `OPEN`      | excluded                       |
| Excluded — CANCELLED                     | `null`         | `null`                 | differs                | `CANCELLED` | excluded                       |
| Excluded — matches base currency         | any            | any                    | same                   | `OPEN`      | excluded                       |
| Excluded — user has no base currency     | any            | any                    | n/a                    | `OPEN`      | excluded (predicate is `null`) |

### Stamping the rate base

Covered by `src/lib/data/orders/_tests/orderFxRateBase.test.ts` and `applyOrderExchangeRates.test.ts`:

| Scenario                          | Expected                                                                |
| --------------------------------- | ----------------------------------------------------------------------- |
| Create / edit with a usable rate  | persists `exchangeRateBaseCode` = the collector's current base currency |
| Create / edit with no usable rate | persists `exchangeRateBaseCode: null` (no stale base left behind)       |
| Bulk reconciliation               | each `updateMany` writes `{ exchangeRate, exchangeRateBaseCode }`       |
| Atomicity                         | all `updateMany` calls run inside a single `$transaction`               |

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

- Activating `?fxPending=true` shows only FX-pending orders (currency ≠ base, stored rate missing or tagged with a different base, not CANCELLED)
- The active chip reads `Currency update needed` / `Actualización de divisa pendiente`
- Removing the chip returns to the previous filter state without the `fxPending` param

### Banner

- A collector with FX-pending orders sees the banner with the correct singular/plural count
- The banner CTA opens `FxReconciliationModal`
- The banner count drops as orders are reconciled and the banner disappears once no order reads as FX-pending; reconciling and editing with a fresh rate both stamp the current base, and returning the base currency to the one a rate was recorded against also removes the order from the set
- A collector with no FX-pending orders does not see the banner

### Settings → orders handoff

- Changing the base currency and confirming writes nothing to any order; foreign-currency orders whose stored rate targets another base start reading as pending, and taking the optional `"Actualizar tasas · {n} pedidos →"` shortcut lands the collector on `/orders?fxPending=true` with the FX-pending banner already showing the same count
- Changing the base currency back to a previously used value does not re-surface orders already reconciled against it

### FxReconciliationModal — apply

- The modal shows one group per currency pair with its order count
- Each group offers a `Today` button that prefills the latest published rate, and an expandable list of the affected orders
- Entering a valid rate and clicking "Apply" updates the orders' `exchangeRate` and records the base currency it converts into
- After the action resolves, the reconciled orders leave the filter/banner, and the dashboard partial-totals notice updates too because the action revalidates the dashboard route

### FxReconciliationModal — defer

- Leaving a group's rate field empty and clicking "Apply" skips that group
- Those orders keep a rate that cannot convert into the current base and remain in the banner and filter

### Per-order indicators

- Per-order FX indicators (order-detail hero chip, edit-form inline warning) are **implemented** and covered by `e2e/orders.spec.ts` (the FX reconciliation test asserts the detail chip and the edit-form warning appear while an order reads as pending).
