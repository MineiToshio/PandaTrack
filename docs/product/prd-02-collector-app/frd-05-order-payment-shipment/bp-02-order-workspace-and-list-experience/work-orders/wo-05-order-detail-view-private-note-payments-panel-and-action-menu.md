---
id: WO-05
type: WORK_ORDER
slug: order-detail-view-private-note-payments-panel-and-action-menu
title: Order Detail View, Private Note, Payments Panel, and Action Menu
status: ACTIVE
parent: BP-02
source_features:
  - FEAT-0014
last_updated: 2026-04-26
implementation_status: IMPLEMENTED
---

# WO-05 Order Detail View, Private Note, Payments Panel, and Action Menu

## Summary

Build the order detail experience at `/orders/[id]`: a status-aware header with action hierarchy, items list, **read-only** automatic history, inline-editable private note, and a payments panel that reuses the payment server mutations from [FRD-05 · BP-01 · WO-03](../../bp-01-order-domain-foundation/work-orders/wo-03-order-payments-balances-and-payment-mutation-rules.md). **As implemented (April 2026):** payments and note changes use optimistic or immediate local UI updates where applicable; order history records **lifecycle events only** (`ORDER_CREATED`, `ORDER_CANCELLED`, `ORDER_REACTIVATED`, and `STATUS_CHANGED` reserved for delivery-driven updates). Note and payment activity **do not** append history rows (see migration `20260423000000_simplify_order_history_event_types`). The history panel is **read-only** (no per-entry delete in UI or `deleteOrderHistoryEntry` in `orderMutations.ts`). On desktop, history sits in the **right column** under the payments block, in a `SectionSurfaceCard` to match the payments list styling. Cancel and reactivate refresh the page after a successful Server Action instead of reconciling a full detail payload on the client. Opening the add-payment form scrolls the form into view (`scrollIntoView` + `scroll-mt-24`) so long payment lists do not hide the form. The header keeps a maximum of two visible affordances: a primary action plus one secondary affordance. In active states that secondary affordance is a split pattern: visible `Edit` plus a small adjacent overflow trigger. `View store` lives inside that overflow menu and links to `/stores/[slug]?returnTo={encodedCurrentOrderDetailUrl}` so store detail can route the collector back to the same order context.

## Prerequisites

This work order depends on the following slices being fully implemented before implementation begins:

- **FRD-05 · BP-01 · [WO-01](../../bp-01-order-domain-foundation/work-orders/wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md)** — Prisma schema for `Order`, `OrderPayment`, `OrderHistory`, `OrderStatus`, `OrderHistoryEventType`, the shared delete/cancel eligibility rule, and the module layout under `src/lib/data/orders/`.
- **FRD-05 · BP-01 · [WO-02](../../bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)** — `OrderItem` schema, `deriveOrderStatus`, `hasUnpaidBalance`, item deletion rules.
- **FRD-05 · BP-01 · [WO-03](../../bp-01-order-domain-foundation/work-orders/wo-03-order-payments-balances-and-payment-mutation-rules.md)** — `addPayment` and `deletePayment` Server Actions, `calculatePaymentSummary`, detail-query extension for payments.
- **FRD-05 · BP-02 · [WO-04](./wo-04-order-create-and-edit-form-with-spreadsheet-style-item-entry.md)** — create and edit routes (`/orders/new`, `/orders/[id]/edit`) so the detail view's `Edit` action has a target and the post-save redirect from WO-04 lands on this detail page.

WO-05 extends `orderMutations.ts` with `reactivateOrder` and `saveOrderNote`, and extends `getOrderDetail` with `eligibility` / `flags`. A follow-up migration **`20260423000000_simplify_order_history_event_types`** narrows `OrderHistoryEventType` to lifecycle (+ `STATUS_CHANGED`) and removes `NOTE_UPDATED`, `PAYMENT_ADDED`, `PAYMENT_DELETED`, and `ORDER_EDITED`; existing rows using removed types are deleted in that migration. **2026-04-24 update:** per-entry history delete (`deleteOrderHistoryEntry` and `orderHistoryActions.ts`) was removed; history is display-only in the app.

## In Scope

- Detail route `orders/[id]` with server-rendered initial state
- Status-aware action bar: primary action plus one secondary affordance per status
- `View store` menu action, with `?returnTo=` round-trip back to the current order detail URL
- `Create delivery` primary action disabled with tooltip until FRD-08 ships
- Inline-editable private note (reuses visual treatment of `StoreNoteForm`; wired to `Order.note`; no `OrderHistory` row on save)
- Payments panel: list, expandable add form, delete confirmation, optimistic summary recalculation
- Automatic history list (read-only; no per-entry delete)
- Cancel, delete, and reactivate flows with context-aware confirmation modals
- Shared eligibility rule for cancel and delete: blocked when any item is linked to a non-cancelled delivery
- Tooltip copy for all disabled states
- `COMPLETED`-with-unpaid-balance visual warning (chip + pill + banner)
- Extension to `orderQueries.ts` to expose the detail shape this page consumes
- Extension to `orderMutations.ts` with `reactivateOrder`
- PostHog analytics events
- Spanish and English localization
- `notFound()` when the order id does not exist or does not belong to the session user

## Out of Scope

- Order list filters ([WO-06](./wo-06-orders-list-filters-expansion-rows-and-overdue-payment-signals.md))
- Order create/edit form ([WO-04](./wo-04-order-create-and-edit-form-with-spreadsheet-style-item-entry.md))
- Delivery creation or allocation flows ([FRD-08](../../../frd-08-delivery-management/frd-08-delivery-management.md))
- Payment mutations implementation ([WO-03](../../bp-01-order-domain-foundation/work-orders/wo-03-order-payments-balances-and-payment-mutation-rules.md))
- Prisma migrations ([WO-01](../../bp-01-order-domain-foundation/work-orders/wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md) and [WO-02](../../bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md))
- Rate limiting

## Requirements

- `FR-05-17` through `FR-05-25`
- `FR-05-34`
- `FR-05-35`
- `BR-05-08` through `BR-05-12`
- `BR-05-15` through `BR-05-18`

## Blueprints

- [BP-02](../bp-02-order-workspace-and-list-experience.md) detail action contract
- [BP-02](../bp-02-order-workspace-and-list-experience.md) status-aware action bar decision
- [BP-02](../bp-02-order-workspace-and-list-experience.md) two-column detail layout decision
- [BP-02](../bp-02-order-workspace-and-list-experience.md) note-pattern reuse decision
- [BP-01](../../bp-01-order-domain-foundation/bp-01-order-domain-foundation.md) delete-and-cancel shared eligibility rule

## Routes

| Route                      | File                                             | Purpose                                                                                                  |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `/[locale]/orders/[id]` | `src/app/[locale]/(app)/orders/[id]/page.tsx` | Server-rendered detail page; resolves the session `userId` and fetches `getOrderDetail(orderId, userId)` |
| `/[locale]/stores/[slug]?returnTo={encodedOrderDetailUrl}` | `src/app/[locale]/(app)/stores/[slug]/page.tsx` | Store-detail entry from order detail; preserves the current order URL for back navigation |

If the order does not exist or does not belong to the session user, the page calls `notFound()` so Next.js renders the locale 404.

## Navigation Contract

- The order-detail page already accepts an optional `?returnTo=` pointing back to the orders list. That value must be sanitized to a relative path before being used as the order-page back link.
- The `View store` menu action must build a store-detail URL that carries the current order-detail URL, including its own sanitized `?returnTo=` list state when present.
- That same link also carries the visible order identifier so the store-detail `BackNavLink` label can read `Back to order {id}` instead of the generic listing label when the collector arrived from an order.
- The store-detail page must sanitize its incoming `?returnTo=` and use it for the top `BackNavLink`; when absent or invalid, it falls back to `/[locale]/stores`.

## Detail Query Shape

The existing `orderQueries.getOrderDetail(orderId, userId)` (established by WO-01 and extended by WO-02 and WO-03) must be extended so the detail page can render entirely from one server query. The shape consumed by the page:

| Field                                                                                                                                                                       | Source        | Notes                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------- |
| `id`, `humanReadableId`, `orderDate`, `expectedDeliveryFrom`, `expectedDeliveryTo`, `currencyCode`, `exchangeRate`, `totalCost`, `note`, `status`, `createdAt`, `updatedAt` | WO-01         | Direct from `Order`                                      |
| `store { id, name, slug }`                                                                                                                                                  | WO-01         | FK to `Store`                                            |
| `items[] { id, name, quantity, unitPrice, productTypeKey, position, deliveryState }`                                                                                        | WO-02         | `deliveryState` derived from linked deliveries per WO-02 |
| `payments[] { id, amount, paymentDate }`                                                                                                                                    | WO-03         | Ordered `paymentDate DESC`, tiebreaker `createdAt DESC`  |
| `summary { paidAmount, remainingAmount, paymentPercentage, hasUnpaidBalance }`                                                                                              | WO-03 + WO-02 | Computed via `calculatePaymentSummary`                   |
| `history[] { id, eventType, metadata, createdAt }`                                                                                                                          | WO-01         | Ordered `createdAt DESC`                                 |
| `eligibility { canDelete, canCancel, blockReason? }`                                                                                                                        | WO-05 (new)   | See rule below                                           |
| `flags { hasPayments, hasNonCancelledDeliveryLinks }`                                                                                                                       | WO-05 (new)   | Drives the confirmation-modal copy                       |

### Eligibility rule

```ts
const hasNonCancelledDeliveryLinks = items.some(
  (item) => item.deliveryState === "in_transit" || item.deliveryState === "delivered",
);

const canCancel = !hasNonCancelledDeliveryLinks;
const canDelete = !hasNonCancelledDeliveryLinks;
const blockReason = hasNonCancelledDeliveryLinks ? "ITEMS_LINKED_TO_DELIVERY" : undefined;
```

Delivery links to cancelled deliveries do not block the operation (WO-02 already treats them as `open` for state derivation; WO-05 follows the same convention).

## Module Structure

Placement must be validated against `.agents/rules/project-structure.mdc` and `.agents/rules/react-next-components.mdc` at implementation time. The intended layout:

```
src/app/[locale]/(app)/orders/[id]/
  page.tsx
  _components/
    OrderDetailContent.tsx         Server — orchestrator, 2-col layout
    OrderSummaryHeader.tsx         Server — store, humanReadableId, dates, status chip, unpaid pill
    OrderStatusBadge.tsx           Server — status chip localized
    OrderActionBar.tsx             Client — primary + More menu, status-aware
    OrderItemsList.tsx             Server — renders items read-only in detail (editing happens in WO-04)
    OrderPaymentSummaryCard.tsx    Client — reconciles with Server Action returns
    OrderPaymentsPanel.tsx         Client — list + expandable form + optimistic list mutations
    OrderPaymentForm.tsx           Client — `useState` + `addPaymentAction` (not `useActionState`)
    OrderPaymentRow.tsx            Client — delete confirmation
    OrderNoteForm.tsx              Client — `useState` + `saveOrderNoteAction`, local draft / saved state
    OrderHistoryList.tsx           Client — `SectionSurfaceCard` + map over `initialHistory` (read-only)
    OrderHistoryRow.tsx            Client — event label + date (read-only)
    OrderDangerousActionModal.tsx  Client — cancel + delete + reactivate reuse
  _actions/
    orderNoteActions.ts            saveOrderNoteAction (clear note = save null / empty trim)
    orderLifecycleActions.ts       cancelOrderAction, deleteOrderAction, reactivateOrderAction
  _schemas/
    orderNoteSchema.ts
```

Pure eligibility helpers live in `src/lib/orders/orderLifecycle.ts` (with Vitest coverage in `src/lib/orders/_tests/orderLifecycle.test.ts`). There is **no** `orderLifecycleSchema.ts` in the repo; actions validate via session + data-layer checks.

`orderMutations.ts` (WO-01) includes `reactivateOrder`, `saveOrderNote`, `cancelOrder`, and `deleteOrder` (no `deleteOrderHistoryEntry`). Payment Server Actions live in `orderPaymentActions.ts` and delegate to `orderPaymentMutations.ts`; they return `{ payments, paidAmount, remainingAmount, paymentPercentage }` for panel reconciliation.

## Layout

The page header (`OrderSummaryHeader`, full width) sits above the two-column block.

### Desktop (≥ lg)

Two-column grid `lg:grid-cols-[1fr_360px]`: **left** column — `OrderItemsList`, then `OrderNoteForm` (stacked with `space-y-8`). **Right** column — `OrderPaymentsPanel` (includes `OrderPaymentSummaryCard` + payment list and add form) and **below it** `OrderHistoryList`, both in a **sticky** container (`lg:sticky` with `space-y-4` between the payments section and the history card). The history list uses the same `SectionSurfaceCard` treatment as the payments list for visual consistency in the right rail.

### Tablet and mobile (< lg)

Single-column flow: after the full-width header, the grid becomes one column. Order: **items** → **payments panel** (summary + list) → **private note** → **history**. The payments panel is surfaced before the note on mobile because it is the most actionable section; the right-rail sticky behavior collapses into normal document flow. The layout uses CSS `order-N` properties on individual children (with a `contents`-display wrapper that dissolves on mobile so children become direct flex items of the outer column) so children participate in the outer flex column on mobile and regroup into the 2-column grid on desktop.

### Header

Uses `BackNavLink` (`appearance="pill"`) linking back to `/orders`, followed by `AppPageHero`:

- Title line: store name as primary emphasis, `humanReadableId` as secondary metadata.
- Meta row: order date, expected delivery range, currency/FX badge when `exchangeRate` is present.
- Status row: `OrderStatusBadge` plus an `Impago` pill when `status === "COMPLETED"` and `summary.hasUnpaidBalance === true` (`FR-05-35`).
- Below the meta row: the `OrderActionBar`.

## Action Bar

The action bar is a Client Component. It reads `status`, `eligibility`, and `flags` from the server query and decides which affordances to render.

### Status matrix

| Status                                                              | Primary                                              | Secondary affordance                                         | Overflow / menu actions                               |
| ------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED` | `Create delivery` (disabled, tooltip "Próximamente") | `Edit` → `/orders/[id]/edit` + adjacent overflow trigger     | `View store` · `Cancel` · `Delete`                    |
| `COMPLETED`                                                         | `Create delivery` (disabled, tooltip "Próximamente") | `Edit` → `/orders/[id]/edit` + adjacent overflow trigger     | `View store` · `Cancel` · `Delete` (last two disabled) |
| `CANCELLED`                                                         | `Reactivate`                                         | `More` button                                                | `View store` · `Delete` (enabled/disabled per eligibility) |

When `eligibility.canCancel === false` or `eligibility.canDelete === false`, the item stays visible but is rendered disabled with the shared unlink-first tooltip.

### Mobile (< md)

`Create delivery` renders full-width. The second visible affordance is the split `Edit` + overflow pattern. Reactivate in `CANCELLED` takes the primary slot and pairs with a standalone `More` trigger because edit is not available in that state.

### Analytics hooks

- `order_detail_more_menu_opened` when the menu opens.
- `order_create_delivery_clicked` fires even when the action is disabled so we can measure demand for FRD-08.

## Private Note Panel

A separate Client Component (`OrderNoteForm`) for this slice. It mirrors `StoreNoteForm` patterns (`Textarea`, `maxLength = 2000`, helper copy, disabled save until the draft differs from persisted content) and persists to `Order.note`.

Behavior (as implemented):

- Draft is local state initialized from `order.note ?? ""`; a parallel `savedNote` state tracks the last successful value for disable logic.
- The `Save` button is disabled while `draft.trim() === (savedNote ?? "").trim()` (and while pending).
- Submitting sends the trimmed string or `null` when empty to `saveOrderNoteAction` → `saveOrderNote` in `orderMutations.ts`. The server is a no-op when trimmed content is unchanged (`changed: false`); otherwise it updates `Order.note`.
- When the order already has a private note, the panel shows **"Last updated"** using the persisted `Order.updatedAt` timestamp returned by the detail query.
- On success, the client updates `savedNote` / `draft` and refreshes **"Last updated"** from the persisted `updatedAt` returned by `saveOrderNoteAction`, not from the client clock.
- The **"Last updated"** line is rendered **below the textarea and above the save button/error area**, so the metadata stays attached to the editable field rather than the section intro.
- **History:** no `OrderHistory` row is written for note changes; `NOTE_UPDATED` was removed from the enum (see migration above).
- On failure, an inline `role="alert"` message shows the error string from i18n (`detail.note.errorSave`).

## Payments Panel

Two sub-components: `OrderPaymentSummaryCard` (the three KPIs plus the progress bar) and `OrderPaymentsPanel` (the list and add/delete interactions).

### Summary card

- Displays `paidAmount`, `remainingAmount`, `paymentPercentage`.
- Progress bar from `0%` to `100%` using theme-aware semantic tokens.
- Secondary line shows "Último pago: {date}" when at least one payment exists.
- When `paymentPercentage === 100`, renders a `fully-paid` state that hides the add-payment affordance.
- When `status === "COMPLETED"` and `summary.hasUnpaidBalance === true`, renders the `Impago` banner inside this card (in addition to the header pill from `FR-05-35`).

### Payments list

- Empty state: `Banknote` icon, title "Aún no registras pagos" / "No payments yet", helper text, CTA `+ Registrar pago` / `+ Record payment`.
- Populated state: list of payment rows ordered by `paymentDate DESC` (tiebreaker `createdAt DESC`). Each row shows amount, date, and a trailing delete icon button.
- CTA `+ Registrar pago` toggles the add-payment form **inline** below the list at all breakpoints (no bottom sheet in the current implementation). When the form opens, `OrderPaymentsPanel` runs `scrollIntoView` on the form container (smooth, `block: "start"`) and applies `scroll-mt-24` so long payment lists do not leave the form below the fold.
- When `summary.remainingAmount === 0`, the CTA is hidden (WO-03 contract).

### Add payment form

- Implemented as `OrderPaymentForm` using **React `useState`**, not `useActionState`. When **embedded** in the payments panel, the form does **not** repeat a “Registrar pago” / “Record payment” heading (the section header and CTA already provide context).
- Fields: `amount` (money input, client validation against `remainingAmount`), `paymentDate` (date picker, default today, cannot be after today or before `order.orderDate` per server rules).
- Submit calls `addPaymentAction` → `addOrderPayment`; returns `{ paidAmount, remainingAmount, paymentPercentage, payments }` on success for reconciliation.
- Optimistic: the panel inserts a temporary row and recalculates summary, then reconciles or reverts on failure.
- **History:** payment add/delete does **not** create `OrderHistory` rows (payment event types were removed from the enum).

### Delete payment

- Trailing icon button opens a confirmation modal (immediate destructive; no undo).
- On confirm, the row is optimistically removed and the summary is recalculated locally in parallel with `deletePayment`. On failure the row reappears and the summary reverts.

## Automatic History Panel

- Rendered in the **right column** below `OrderPaymentsPanel`, as a **`SectionSurfaceCard`** titled with the localized “History” / “Historial” string (same card shell as the payments list for a consistent right-rail look).
- Renders the `history` array ordered `createdAt DESC` (props: `initialHistory`, `locale`; no client state required for mutations).
- **Event types in schema:** `ORDER_CREATED`, `ORDER_CANCELLED`, `ORDER_REACTIVATED`, `STATUS_CHANGED`. The UI/i18n may still contain legacy keys for removed types; rows for those types no longer exist after the simplification migration. `STATUS_CHANGED` is reserved for delivery-driven status transitions (FRD-08) when wired.
- Each row resolves display text from `orders.detail.history.events.{eventType}` where defined. **Read-only:** there is **no** delete control, modal, or `deleteOrderHistoryEntry` Server Action.
- Empty state: section hidden; in practice there is at least an `ORDER_CREATED` row for existing orders.

## Cancel, Delete, and Reactivate Flows

All three flows use `OrderDangerousActionModal`. The modal is a Client Component. Copy uses **next-intl** plus `humanReadableId`, `storeName`, and `flags.hasPayments` (payment-removal line); the Server Action re-validates live delivery links and order existence server-side (`BR-05-16` plus the shared eligibility rule).

### Cancel

- Triggered from the `More` menu when `status !== "CANCELLED"` and `eligibility.canCancel === true` (and not blocked by `COMPLETED` UI rules — see action bar).
- Modal title: "¿Cancelar este pedido?" / "Cancel this order?".
- Body names the `humanReadableId` and store; if `flags.hasPayments`, it adds the payment-removal line (i18n `detail.cancelModal.descriptionPayments`).
- On confirm, `cancelOrderAction` → `cancelOrder` re-validates live delivery links, deletes payments, sets status to `CANCELLED`, appends `ORDER_CANCELLED`, returns `{ ok: true }`. The UI then **`window.location.reload()`** to refresh server-rendered state (no client-side reconciled detail payload).

### Delete

- Triggered from the `More` menu when `status !== "CANCELLED"` and `eligibility.canDelete === true`, or from the `CANCELLED` chevron menu.
- Modal title: "¿Eliminar este pedido?" / "Delete this order?".
- Body names the `humanReadableId` and store; if `flags.hasPayments`, adds the payment-removal line.
- On confirm, `deleteOrderAction` → `deleteOrder` re-validates and deletes payments, delivery links, history, items, and order. On success, **`redirect` to `/[locale]/orders`** (success toast behavior depends on global redirect UX). On failure, the modal shows an error. When `eligibility.canDelete === false` or `COMPLETED`, menu items stay visible but disabled with tooltips.

### Reactivate

- Triggered from the primary button when `status === "CANCELLED"`.
- No modal (`BR-05-17`).
- `reactivateOrderAction` → `reactivateOrder` sets status to `OPEN` and appends `ORDER_REACTIVATED`. On success the page **`window.location.reload()`** (same pattern as cancel).

## Tooltip copy

| Situation                                                       | ES                                                                                                     | EN                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Cancel blocked (items linked to delivery)                       | "Este pedido tiene items asociados a una entrega. Desasócialos desde la entrega para poder cancelarlo." | "This order has items linked to a delivery. Unlink them from the delivery before cancelling." |
| Delete blocked (items linked to delivery)                       | "No se puede eliminar este pedido porque tiene items asociados a una entrega. Desasócialos primero."    | "This order can't be deleted because it has items linked to a delivery. Unlink them first."   |
| Item-level remove blocked (in edit mode; referenced from WO-02) | "Este item está asociado a una entrega. Desasócialo desde la entrega para poder eliminarlo."           | "This item is linked to a delivery. Unlink it from the delivery before deleting it."          |
| `Create delivery` (until FRD-08)                                | "Próximamente: podrás crear entregas para este pedido."                                                 | "Coming soon: you'll be able to create deliveries for this order."                            |

All copy lives in `src/i18n/locales/{locale}/orders.json` under the namespace `orders.detail.*`.

## Empty States

- **Note empty**: the card is visible with an empty textarea. Placeholder: "Añade recordatorios, detalles del vendedor, tracking intermedio… (solo tú los ves)" / "Add reminders, seller notes, partial tracking… (only you see this)". The `Save` button stays disabled until the user types.
- **Payments empty**: `Banknote` icon, title "Aún no registras pagos" / "No payments yet", helper "Cuando pagues en cuotas, regístralo aquí para ver cuánto te falta." / "When you pay in instalments, record it here to see what's left.", CTA `+ Registrar pago`. CTA hidden if `summary.remainingAmount === 0`.
- **History empty**: the section is hidden (defensive — always at least one `ORDER_CREATED` entry).
- **Items empty**: defensive banner `warning` "Este pedido no tiene items. Edítalo para agregar productos." / "This order has no items. Edit it to add products." with a link to `/orders/[id]/edit`. WO-04 prevents this state in practice.

## Optimistic Updates

Where `.agents/rules/optimistic-client-updates.mdc` applies:

| Mutation          | Client behavior                                              | Server / revert                                                                                         |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `saveOrderNote`   | Updates local note state on success only; no history row     | Error alert; draft unchanged relative to last save attempt                                              |
| `addPayment`      | Optimistic insert + local summary recalc                     | Revert list + summary from snapshot on failure                                                          |
| `deletePayment`   | Optimistic remove + local summary recalc                     | Revert on failure                                                                                       |
| `cancelOrder`     | No optimistic detail merge — **full page reload** on success | Error in modal                                                                                          |
| `reactivateOrder` | **`window.location.reload()` runs after the action returns** | On server failure the reload may still run (no branching on `ok` in the action bar) — hardening backlog |
| `deleteOrder`     | No optimistic UI — **redirect** on success                   | Error in modal                                                                                          |

## Technical Notes

- Payment and note actions return the shapes needed for their local UI; lifecycle actions return **`{ ok: true }` only** (no full detail object). Cancel/reactivate rely on a **full reload** to resync RSC data.
- `reactivateOrder` is added to `orderMutations.ts` (WO-01 module) in this slice. It performs two writes atomically inside a `prisma.$transaction`: flip `status` to `OPEN` and append `ORDER_REACTIVATED` history.
- The detail-query extension adds `eligibility` and `flags` derived from the already-loaded `items` and `payments`; no extra database round trips are needed.
- Monetary amounts stay as `Int` minor units through the wire; the UI formats via existing money helpers.
- `humanReadableId` is never mutated from the detail view.
- The payments panel's summary reconciliation uses the pure `calculatePaymentSummary` helper from WO-03 so client-side and server-side math stay in sync.
- **`COMPLETED` guard vs copy:** Cancel/delete are disabled when `status === "COMPLETED"` using the same tooltip strings as delivery-link blocking (`detail.actions.cancelDisabledTooltip` / `deleteDisabledTooltip`), which describe deliveries — not the completed-state rule. Consider separate copy in a future polish pass.

## Security Notes

- `page.tsx` resolves `userId` from the active session only. `getOrderDetail` is always called with the scoped `userId`.
- `notFound()` is used whenever the id does not exist or does not belong to the session user, to prevent enumeration.
- Server Actions resolve the session server-side and scope mutations with `{ orderId, userId }` (`userId` never from the client). Note/payment actions use Zod where a schema exists; lifecycle actions rely on the data layer for validation. There is **no** history-entry delete action.
- The shared delete/cancel eligibility rule is computed both in the query (for UI gating) and re-validated inside every destructive Server Action before any write (so a stale client cannot bypass the rule).
- Confirmation modal copy is built client-side for fast feedback but the server re-validates eligibility and the true state of the order before mutating; stale client flags are caught on the server.
- Destructive mutations run inside `prisma.$transaction` blocks owned by WO-01 so partial failures cannot leave inconsistent state.

## Observability

- Unexpected Server Action failures are captured with Sentry via the existing server wrappers.
- Expected validation / business rejections (e.g. `EXCEEDS_BALANCE`, `DATE_BEFORE_ORDER`, `HAS_LIVE_DELIVERY_LINKS` on cancel/delete) are not sent to Sentry.
- Client-side revert paths emit `console.error` but do not report to Sentry unless the Server Action surfaced an unexpected status.

## Analytics

Event names live under `POSTHOG_EVENTS.ORDER.*` in `src/lib/constants.ts`. **As implemented**, server `capture` calls mostly send `{ orderId }` (note, payment, cancel, delete, reactivate). The disabled **Create delivery** button includes **`{ orderId, status }`** via `posthogProps`. The **More** menu uses `posthogEvent={DETAIL_MORE_MENU_OPENED}` with `{ orderId }` on the chevron `Button`. `order_detail_more_menu_opened` is **not** fired from the placeholder `handleMoreToggle` path on mobile (that branch only calls `fetch("/api/noop")`).

| Event constant                  | When it fires                                               |
| ------------------------------- | ----------------------------------------------------------- |
| `order_note_saved`              | `saveOrderNote` returns success with a non-null note        |
| `order_note_deleted`            | `saveOrderNote` returns success with `note === null`        |
| `order_payment_added`           | `addPayment` returns success                                |
| `order_payment_deleted`         | `deletePayment` returns success                             |
| `order_cancelled`               | `cancelOrder` returns success                               |
| `order_deleted`                 | `deleteOrder` returns success                               |
| `order_reactivated`             | `reactivateOrder` returns success                           |
| `order_create_delivery_clicked` | User clicks `Create delivery`, including the disabled state |
| `order_view_store_clicked`      | User clicks the `View store` action inside the order-detail `More` menu |
| `order_detail_more_menu_opened` | The `More` / chevron menu opens                             |

## Assumptions

- `getOrderDetail` is the single source of the detail view; it lives in `src/lib/data/orders/orderQueries.ts` and is extended with `eligibility` and `flags` without extra joins (derived from items + payments already selected).
- **`OrderHistoryEventType`** (after the simplification migration) is: `ORDER_CREATED`, `ORDER_CANCELLED`, `ORDER_REACTIVATED`, `STATUS_CHANGED`. Notes and payments do not emit history events.
- `StoreNoteForm` provides the visual template but is not extracted to a shared abstraction. If a third consumer appears later, extract then.
- `Create delivery` navigation target will land in FRD-08. Until then the affordance is disabled; analytics measure demand so the prioritization decision is informed.

## Unit Tests

### `canDeleteOrder` / `canCancelOrder` / `computeOrderEligibility`

Covered in `src/lib/orders/_tests/orderLifecycle.test.ts`.

| Scenario                                                                | Input                  | `canDelete` | `canCancel` |
| ----------------------------------------------------------------------- | ---------------------- | ----------- | ----------- |
| No items at all                                                         | `items = []`           | `true`      | `true`      |
| All items open                                                          | all `open`             | `true`      | `true`      |
| At least one item `in_transit`                                          | mixed                  | `false`     | `false`     |
| At least one item `delivered`                                           | mixed                  | `false`     | `false`     |
| Items only linked to cancelled deliveries (treated as `open` per WO-02) | all `open` after remap | `true`      | `true`      |

### Destructive modal copy

Copy is composed in `OrderDangerousActionModal` via **next-intl** keys (`detail.cancelModal.*`, `detail.deleteModal.*`), not a separate `buildDestructiveModalCopy` helper — no unit tests for that indirection.

### `saveOrderNote` no-op / change detection

Server-side trim comparison lives in `saveOrderNote` (`orderMutations.ts`). Optional future tests: unchanged trim returns `changed: false`; whitespace-only normalization matches the WO-01-style rules described earlier in this doc’s history (now without a history row).

## E2E Acceptance Tests

### Note lifecycle

- Typing a note and saving persists the value; **no history row** is added. The save button disables until the draft differs from the last saved value.
- Clearing the note to an empty value persists `null`. **Last updated** line appears only after a successful save (client timestamp).
- Save is disabled when the trimmed draft equals the persisted trimmed content (or while pending).

### Payments panel

- Adding a valid payment updates `paidAmount`, `remainingAmount`, and `paymentPercentage` immediately (optimistic) and keeps the values after the Server Action response.
- Adding a payment greater than `remainingAmount` is rejected both client-side (button disabled) and server-side (error visible).
- Adding a payment exactly equal to `remainingAmount` completes the fully-paid state; the add CTA disappears.
- Deleting a payment optimistically updates the summary and the list; the CTA reappears when `remainingAmount > 0`.
- A future-dated payment or a payment before `order.orderDate` is rejected.
- When there are enough payment rows that the add form would sit below the fold, choosing **+ Registrar pago** scrolls the form into view (smooth) so the amount/date fields and actions stay visible.

### Action bar

- `Create delivery` is rendered for every non-cancelled status but stays disabled until FRD-08 ships; hovering it shows the "Próximamente" tooltip.
- `Edit` navigates to `/orders/[id]/edit` for `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, and `PARTIALLY_DELIVERED`.
- `Edit` is hidden when `status === "COMPLETED"` and when `status === "CANCELLED"`.
- `Cancel` and `Delete` render disabled with the unlink-first tooltip when any item is linked to a non-cancelled delivery.
- `Cancel` and `Delete` render disabled with the same tooltip when `status === "COMPLETED"`.
- Confirming a `Cancel` on an eligible order runs the server mutation then **full page reload**; the user sees `CANCELLED`, empty payments, and updated history after reload.
- Confirming a `Delete` on an eligible order redirects to `/orders`.
- `Reactivate` on a `CANCELLED` order runs the server mutation (status `OPEN` + `ORDER_REACTIVATED` history) then **full page reload**.

### `COMPLETED` with unpaid balance

- An order in `COMPLETED` with `hasUnpaidBalance === true` shows the `Impago` pill in the header and the warning banner in the payments panel. `Cancel` and `Delete` remain disabled.

### History list

- `ORDER_CREATED` is the oldest entry for orders created under the new enum.
- Lifecycle actions append **`ORDER_CANCELLED`** / **`ORDER_REACTIVATED`** as applicable. Notes and payments do **not** append rows.
- The history list is read-only: users cannot delete individual history entries from the UI; there is no `order_history_entry_deleted` analytics event in `POSTHOG_EVENTS.ORDER` (removed 2026-04-24).

### Authorization

- Navigating to `/orders/[id]` with an id that does not exist renders the Next.js 404 page.
- Navigating with an id that belongs to another user renders the Next.js 404 page (no distinguishing signal).
