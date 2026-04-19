---
id: WO-05
type: WORK_ORDER
slug: order-detail-view-private-note-payments-panel-and-action-menu
title: Order Detail View, Private Note, Payments Panel, and Action Menu
status: ACTIVE
parent: BP-02
source_features:
  - FEAT-0014
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-05 Order Detail View, Private Note, Payments Panel, and Action Menu

## Summary

Build the order detail experience at `/purchases/[id]`: a status-aware header with action hierarchy, items list, automatic history with per-entry delete, inline-editable private note, and a payments panel that reuses the `addPayment` and `deletePayment` server mutations already defined by [FRD-05 · BP-01 · WO-03](../../bp-01-order-domain-foundation/work-orders/wo-03-order-payments-balances-and-payment-mutation-rules.md). All client-visible mutations follow the optimistic-updates pattern so the collector gets immediate feedback without waiting for a server refetch.

## Prerequisites

This work order depends on the following slices being fully implemented before implementation begins:

- **FRD-05 · BP-01 · [WO-01](../../bp-01-order-domain-foundation/work-orders/wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md)** — Prisma schema for `Order`, `OrderPayment`, `OrderHistory`, `OrderStatus`, `OrderHistoryEventType`, the shared delete/cancel eligibility rule, and the module layout under `src/lib/data/orders/`.
- **FRD-05 · BP-01 · [WO-02](../../bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)** — `OrderItem` schema, `deriveOrderStatus`, `hasUnpaidBalance`, item deletion rules.
- **FRD-05 · BP-01 · [WO-03](../../bp-01-order-domain-foundation/work-orders/wo-03-order-payments-balances-and-payment-mutation-rules.md)** — `addPayment` and `deletePayment` Server Actions, `calculatePaymentSummary`, detail-query extension for payments.
- **FRD-05 · BP-02 · [WO-04](./wo-04-order-create-and-edit-form-with-spreadsheet-style-item-entry.md)** — create and edit routes (`/purchases/new`, `/purchases/[id]/edit`) so the detail view's `Edit` action has a target and the post-save redirect from WO-04 lands on this detail page.

WO-05 does not introduce any Prisma migration. It consumes the schema and modules defined in WO-01/WO-02/WO-03 and extends `orderMutations.ts` with `reactivateOrder`, the note mutations, and the history-entry delete mutation.

## In Scope

- Detail route `purchases/[id]` with server-rendered initial state
- Status-aware action bar: primary, secondary, and `More`/chevron menus per status
- `Create delivery` primary action disabled with tooltip until FRD-08 ships
- Inline-editable private note (reuses visual treatment of `StoreNoteForm`; wired to `Order.note` and `NOTE_UPDATED` history event)
- Payments panel: list, expandable add form, delete confirmation, optimistic summary recalculation
- Automatic history list (read order) with per-entry delete
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
| `/[locale]/purchases/[id]` | `src/app/[locale]/(app)/purchases/[id]/page.tsx` | Server-rendered detail page; resolves the session `userId` and fetches `getOrderDetail(orderId, userId)` |

If the order does not exist or does not belong to the session user, the page calls `notFound()` so Next.js renders the locale 404.

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

Placement must be validated against `.cursor/rules/project-structure.mdc` and `.cursor/rules/react-next-components.mdc` at implementation time. The intended layout:

```
src/app/[locale]/(app)/purchases/[id]/
  page.tsx
  _components/
    OrderDetailContent.tsx         Server — orchestrator, 2-col layout
    OrderSummaryHeader.tsx         Server — store, humanReadableId, dates, status chip, unpaid pill
    OrderStatusBadge.tsx           Server — status chip localized
    OrderActionBar.tsx             Client — primary/secondary + More/chevron, status-aware
    OrderItemsList.tsx             Server — renders items read-only in detail (editing happens in WO-04)
    OrderPaymentSummaryCard.tsx    Client — reconciles with Server Action returns
    OrderPaymentsPanel.tsx         Client — list + expandable form + optimistic list mutations
    OrderPaymentForm.tsx           Client — useActionState(addPayment)
    OrderPaymentRow.tsx            Client — delete confirmation
    OrderNoteForm.tsx              Client — useActionState(saveOrderNote), optimistic local state
    OrderHistoryList.tsx           Server — shell
    OrderHistoryRow.tsx            Client — per-row delete with optimistic removal
    OrderDangerousActionModal.tsx  Client — cancel + delete + reactivate reuse
  _actions/
    orderNoteActions.ts            saveOrderNote, deleteOrderNote
    orderLifecycleActions.ts       cancelOrder, deleteOrder, reactivateOrder
    orderHistoryActions.ts         deleteOrderHistoryEntry
  _schemas/
    orderNoteSchema.ts
    orderLifecycleSchema.ts
    orderHistoryEntrySchema.ts
```

`orderMutations.ts` (owned by WO-01) is extended inside this slice with `reactivateOrder(orderId, userId)` and the atomic cancel/delete flows revised to match the shared eligibility rule documented in WO-01. The payment Server Actions live in `orderPaymentActions.ts` (re-exports from WO-03 wired to this route); they return the summary shape the panel needs.

## Layout

### Desktop (≥ lg)

Two-column grid: left column holds the page header, items list, and history list; the right column is sticky and holds the payment summary card, payment panel, and private note.

### Tablet and mobile (< lg)

Single-column stack: header → summary card → payment panel → note → items → history. The sticky right rail collapses into the natural document flow.

### Header

Uses `BackNavLink` (`appearance="pill"`) linking back to `/purchases`, followed by `AppPageHero`:

- Title line: store name as primary emphasis, `humanReadableId` as secondary metadata.
- Meta row: order date, expected delivery range, currency/FX badge when `exchangeRate` is present.
- Status row: `OrderStatusBadge` plus an `Impago` pill when `status === "COMPLETED"` and `summary.hasUnpaidBalance === true` (`FR-05-35`).
- Below the meta row: the `OrderActionBar`.

## Action Bar

The action bar is a Client Component. It reads `status`, `eligibility`, and `flags` from the server query and decides which affordances to render.

### Status matrix

| Status                                                              | Primary                                              | Secondary                       | More / chevron                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED` | `Create delivery` (disabled, tooltip "Próximamente") | `Edit` → `/purchases/[id]/edit` | `Cancel` · `Delete`                                          |
| `COMPLETED`                                                         | `Create delivery` (disabled, tooltip "Próximamente") | `Edit` hidden                   | `Cancel` · `Delete` (both disabled with eligibility tooltip) |
| `CANCELLED`                                                         | `Reactivate`                                         | —                               | `Delete` (enabled/disabled per eligibility)                  |

When `eligibility.canCancel === false` or `eligibility.canDelete === false`, the item stays visible but is rendered disabled with the shared unlink-first tooltip.

### Mobile (< md)

`Create delivery` renders full-width. `Edit` and the `More` trigger appear in a two-button row below. Reactivate in `CANCELLED` takes the full-width slot.

### Analytics hooks

- `order_detail_more_menu_opened` when the menu opens.
- `order_create_delivery_clicked` fires even when the action is disabled so we can measure demand for FRD-08.

## Private Note Panel

A separate Client Component (`OrderNoteForm`) created for this slice. Visually it mirrors `StoreNoteForm` (surface card, `Textarea` with `maxLength = 2000`, helper copy, "Última actualización" line, disabled-save until the draft differs from persisted content) but wires to `Order.note` rather than a separate `Note` table.

Behavior:

- Draft is a local client state initialized from `order.note ?? ""`.
- The `Save` button is disabled while `draft.trim() === (order.note ?? "").trim()`.
- Submitting trims the value. A non-empty trimmed value is persisted to `Order.note`. A blank value is persisted as `null`, which functions as "delete the note".
- After a successful mutation, the client optimistically updates local state and the history list receives an optimistic `NOTE_UPDATED` row. If the Server Action fails, both states revert and a toast-style `role="alert"` surface shows the error.
- `NOTE_UPDATED` history is emitted only when the trimmed content differs from the previously persisted trimmed content (see `orderHistoryMutations.ts` in WO-01). Saves that would be no-ops server-side skip both the `NOTE_UPDATED` entry and the `updatedAt` bump.

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
- CTA `+ Registrar pago` expands the add-payment form inline on desktop and tablet. On mobile, the form opens as a bottom sheet to keep keyboard input clear.
- When `summary.remainingAmount === 0`, the CTA is hidden (WO-03 contract).

### Add payment form

- Fields: `amount` (money input, real-time client validation against `remainingAmount`), `paymentDate` (date picker, default today, cannot be in the future or before `order.orderDate`).
- Submit dispatches `addPayment`. The Server Action returns `{ paidAmount, remainingAmount, paymentPercentage, payments }`; the client reconciles local state with that shape.
- Optimistic: the new row is inserted into the list and the summary is recalculated locally in parallel with the Server Action dispatch. On failure the row is removed, the summary is reverted, and an error toast appears.

### Delete payment

- Trailing icon button opens a confirmation modal (immediate destructive; no undo).
- On confirm, the row is optimistically removed and the summary is recalculated locally in parallel with `deletePayment`. On failure the row reappears and the summary reverts.

## Automatic History Panel

- Renders the `history` array ordered `createdAt DESC`.
- Each row resolves its display text from the i18n key matching `eventType` (per WO-01), interpolating `metadata`.
- Each row exposes a trailing delete icon button with a confirmation modal (`BR-05-09`). The delete is optimistic — the row disappears immediately and the Server Action runs in parallel.
- Empty state is rendered by hiding the section entirely; in practice there is always at least one `ORDER_CREATED` entry.

## Cancel, Delete, and Reactivate Flows

All three flows use `OrderDangerousActionModal`. The modal is a Client Component. Copy is built client-side using the `flags` and `summary` from the server query (fast feedback); the Server Action always re-validates eligibility and payment state server-side (`BR-05-16` plus the shared eligibility rule).

### Cancel

- Triggered from the `More` menu when `status !== "CANCELLED"` and `eligibility.canCancel === true`.
- Modal title: "¿Cancelar esta orden?" / "Cancel this order?".
- Body names the `humanReadableId` and store; if `flags.hasPayments`, it adds "Los pagos registrados serán eliminados." / "Recorded payments will be removed.".
- On confirm, optimistically switches the order to `CANCELLED`, clears the payment list in the client state, and appends an `ORDER_CANCELLED` history row. The Server Action (`cancelOrder`) re-validates, performs the atomic transaction from WO-01 (delete payments, transition status, append history), and returns the reconciled shape. On failure, revert.

### Delete

- Triggered from the `More` menu when `status !== "CANCELLED"` and `eligibility.canDelete === true`, or from the `CANCELLED` chevron menu.
- Modal title: "¿Eliminar esta orden?" / "Delete this order?".
- Body names the `humanReadableId` and store; if `flags.hasPayments`, adds the payment-removal line.
- On confirm, the Server Action (`deleteOrder`) re-validates and executes the atomic transaction from WO-01 (delete payments, residual cancelled delivery links, history, items, order). On success, the page redirects to `/purchases` with a success toast. On failure, the modal surfaces the error and the page stays.
- When `eligibility.canDelete === false`, the menu item is rendered disabled with the unlink-first tooltip; the action is never dispatched.

### Reactivate

- Triggered from the primary button when `status === "CANCELLED"`.
- No preconditions and no modal (`BR-05-17`).
- Optimistically flips `status` to `OPEN` and appends an `ORDER_REACTIVATED` history row. The Server Action (`reactivateOrder`) executes the atomic transaction from WO-01 and returns the reconciled shape. On failure, revert.

## Tooltip copy

| Situation                                                       | ES                                                                                                     | EN                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Cancel blocked (items linked to delivery)                       | "Esta orden tiene items asociados a una entrega. Desasócialos desde la entrega para poder cancelarla." | "This order has items linked to a delivery. Unlink them from the delivery before cancelling." |
| Delete blocked (items linked to delivery)                       | "No se puede eliminar esta orden porque tiene items asociados a una entrega. Desasócialos primero."    | "This order can't be deleted because it has items linked to a delivery. Unlink them first."   |
| Item-level remove blocked (in edit mode; referenced from WO-02) | "Este item está asociado a una entrega. Desasócialo desde la entrega para poder eliminarlo."           | "This item is linked to a delivery. Unlink it from the delivery before deleting it."          |
| `Create delivery` (until FRD-08)                                | "Próximamente: podrás crear entregas para esta orden."                                                 | "Coming soon: you'll be able to create deliveries for this order."                            |

All copy lives in `src/i18n/locales/{locale}/orders.json` under the namespace `orders.detail.*`.

## Empty States

- **Note empty**: the card is visible with an empty textarea. Placeholder: "Añade recordatorios, detalles del vendedor, tracking intermedio… (solo tú los ves)" / "Add reminders, seller notes, partial tracking… (only you see this)". The `Save` button stays disabled until the user types.
- **Payments empty**: `Banknote` icon, title "Aún no registras pagos" / "No payments yet", helper "Cuando pagues en cuotas, regístralo aquí para ver cuánto te falta." / "When you pay in instalments, record it here to see what's left.", CTA `+ Registrar pago`. CTA hidden if `summary.remainingAmount === 0`.
- **History empty**: the section is hidden (defensive — always at least one `ORDER_CREATED` entry).
- **Items empty**: defensive banner `warning` "Esta orden no tiene items. Edítala para agregar productos." / "This order has no items. Edit it to add products." with a link to `/purchases/[id]/edit`. WO-04 prevents this state in practice.

## Optimistic Updates

All client-visible mutations in this slice follow `.cursor/rules/optimistic-client-updates.mdc`:

| Mutation                       | Optimistic change                                        | Reconciles with                                 | Revert on failure                                  |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `saveOrderNote`                | `note` string + `NOTE_UPDATED` history row               | Server Action returns `{ note, historyEntry? }` | Revert note text and history row; show error toast |
| `deleteOrderNote` (empty save) | `note = null` + `NOTE_UPDATED` history row               | Same as above                                   | Same                                               |
| `addPayment`                   | Insert payment row + recalculate summary locally         | Server Action returns `{ payments, summary }`   | Remove inserted row, revert summary                |
| `deletePayment`                | Remove row + recalculate summary locally                 | Same                                            | Reinsert row, revert summary                       |
| `deleteOrderHistoryEntry`      | Remove the row                                           | Server Action returns `{ deletedId }`           | Reinsert row                                       |
| `cancelOrder`                  | `status = CANCELLED`, clear payments, append history row | Server Action returns reconciled detail         | Revert status, payments, and history row           |
| `reactivateOrder`              | `status = OPEN`, append history row                      | Same                                            | Revert                                             |
| `deleteOrder`                  | No optimistic UI — on success redirect to `/purchases`   | Redirect handled server-side                    | Surface error in modal; stay on page               |

`deleteOrder` is the documented exception per the rule: it is a navigation-changing destructive action that should confirm server success before unmounting the page.

## Technical Notes

- All Server Actions return the reconciled shape the UI needs to update itself without a second query. `revalidatePath("/[locale]/purchases/[id]")` is used only on `deleteOrder` (redirect target).
- `reactivateOrder` is added to `orderMutations.ts` (WO-01 module) in this slice. It performs two writes atomically inside a `prisma.$transaction`: flip `status` to `OPEN` and append `ORDER_REACTIVATED` history.
- The detail-query extension adds `eligibility` and `flags` derived from the already-loaded `items` and `payments`; no extra database round trips are needed.
- Monetary amounts stay as `Int` minor units through the wire; the UI formats via existing money helpers.
- `humanReadableId` is never mutated from the detail view.
- The payments panel's summary reconciliation uses the pure `calculatePaymentSummary` helper from WO-03 so client-side and server-side math stay in sync.

## Security Notes

- `page.tsx` resolves `userId` from the active session only. `getOrderDetail` is always called with the scoped `userId`.
- `notFound()` is used whenever the id does not exist or does not belong to the session user, to prevent enumeration.
- All Server Actions in this slice follow the same pattern: session resolution → Zod boundary → mutation scoped to `{ orderId, userId }`. `userId` is never taken from the client.
- The shared delete/cancel eligibility rule is computed both in the query (for UI gating) and re-validated inside every destructive Server Action before any write (so a stale client cannot bypass the rule).
- Confirmation modal copy is built client-side for fast feedback but the server re-validates eligibility and the true state of the order before mutating; stale client flags are caught on the server.
- Destructive mutations run inside `prisma.$transaction` blocks owned by WO-01 so partial failures cannot leave inconsistent state.

## Observability

- Unexpected Server Action failures are captured with Sentry via the existing server wrappers.
- Expected Zod validation failures and eligibility rejections (`EXCEEDS_BALANCE`, `DATE_BEFORE_ORDER`, `ITEMS_LINKED_TO_DELIVERY`) are not sent to Sentry.
- Client-side revert paths emit `console.error` but do not report to Sentry unless the Server Action surfaced an unexpected status.

## Analytics

Event names are added to `POSTHOG_EVENTS` in `src/lib/constants.ts`. Shared properties: `{ orderId, status, hasUnpaidBalance }`.

| Event constant                  | When it fires                                               |
| ------------------------------- | ----------------------------------------------------------- |
| `order_note_saved`              | `saveOrderNote` returns success with a non-null note        |
| `order_note_deleted`            | `saveOrderNote` returns success with `note === null`        |
| `order_payment_added`           | `addPayment` returns success                                |
| `order_payment_deleted`         | `deletePayment` returns success                             |
| `order_cancelled`               | `cancelOrder` returns success                               |
| `order_deleted`                 | `deleteOrder` returns success                               |
| `order_reactivated`             | `reactivateOrder` returns success                           |
| `order_history_entry_deleted`   | `deleteOrderHistoryEntry` returns success                   |
| `order_create_delivery_clicked` | User clicks `Create delivery`, including the disabled state |
| `order_detail_more_menu_opened` | The `More` / chevron menu opens                             |

## Assumptions

- `getOrderDetail` is the single source of the detail view; it lives in `src/lib/data/orders/orderQueries.ts` and is extended here with `eligibility` and `flags` without new database joins.
- `NOTE_UPDATED`, `ORDER_CANCELLED`, `ORDER_REACTIVATED`, `PAYMENT_ADDED`, `PAYMENT_DELETED` history event types already exist from WO-01. `OrderHistoryEventType` is not expanded in this slice.
- `StoreNoteForm` provides the visual template but is not extracted to a shared abstraction. If a third consumer appears later, extract then.
- `Create delivery` navigation target will land in FRD-08. Until then the affordance is disabled; analytics measure demand so the prioritization decision is informed.

## Unit Tests

### `canDeleteOrder` / `canCancelOrder`

Pure helpers exposed alongside the eligibility logic in `src/lib/orders/orderLifecycle.ts`.

| Scenario                                                                | Input                  | `canDelete` | `canCancel` |
| ----------------------------------------------------------------------- | ---------------------- | ----------- | ----------- |
| No items at all                                                         | `items = []`           | `true`      | `true`      |
| All items open                                                          | all `open`             | `true`      | `true`      |
| At least one item `in_transit`                                          | mixed                  | `false`     | `false`     |
| At least one item `delivered`                                           | mixed                  | `false`     | `false`     |
| Items only linked to cancelled deliveries (treated as `open` per WO-02) | all `open` after remap | `true`      | `true`      |

### `buildDestructiveModalCopy`

Pure helper that maps `{ action, flags }` to a copy bundle.

| Scenario                               | Expected                                       |
| -------------------------------------- | ---------------------------------------------- |
| `action="cancel"`, `hasPayments=false` | Title "¿Cancelar esta orden?"; no payment line |
| `action="cancel"`, `hasPayments=true`  | Title plus payment-removal line                |
| `action="delete"`, `hasPayments=false` | Title "¿Eliminar esta orden?"; no payment line |
| `action="delete"`, `hasPayments=true`  | Title plus payment-removal line                |

### `NOTE_UPDATED` emission predicate

| Scenario                               | Expected emission |
| -------------------------------------- | ----------------- |
| `null → "texto"`                       | Yes               |
| `"texto" → "texto distinto"`           | Yes               |
| `"texto" → ""` (persisted as `null`)   | Yes               |
| `"texto " → "texto"` (whitespace only) | No                |
| No change                              | No                |

## E2E Acceptance Tests

### Note lifecycle

- Typing a note and saving persists the value, appends a `NOTE_UPDATED` history row, and the save button disables until the next change.
- Clearing the note to an empty value persists `null`, appends `NOTE_UPDATED`, and the helper copy reflects the empty state.
- Save is disabled when the trimmed draft equals the persisted trimmed content.

### Payments panel

- Adding a valid payment updates `paidAmount`, `remainingAmount`, and `paymentPercentage` immediately (optimistic) and keeps the values after the Server Action response.
- Adding a payment greater than `remainingAmount` is rejected both client-side (button disabled) and server-side (error visible).
- Adding a payment exactly equal to `remainingAmount` completes the fully-paid state; the add CTA disappears.
- Deleting a payment optimistically updates the summary and the list; the CTA reappears when `remainingAmount > 0`.
- A future-dated payment or a payment before `order.orderDate` is rejected.

### Action bar

- `Create delivery` is rendered for every non-cancelled status but stays disabled until FRD-08 ships; hovering it shows the "Próximamente" tooltip.
- `Edit` navigates to `/purchases/[id]/edit` for `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, and `PARTIALLY_DELIVERED`.
- `Edit` is hidden when `status === "COMPLETED"` and when `status === "CANCELLED"`.
- `Cancel` and `Delete` render disabled with the unlink-first tooltip when any item is linked to a non-cancelled delivery.
- `Cancel` and `Delete` render disabled with the same tooltip when `status === "COMPLETED"`.
- Confirming a `Cancel` on an eligible order transitions to `CANCELLED`, clears payments, and the header updates immediately.
- Confirming a `Delete` on an eligible order redirects to `/purchases` with a success toast.
- `Reactivate` on a `CANCELLED` order returns to `OPEN` immediately and appends an `ORDER_REACTIVATED` history row.

### `COMPLETED` with unpaid balance

- An order in `COMPLETED` with `hasUnpaidBalance === true` shows the `Impago` pill in the header and the warning banner in the payments panel. `Cancel` and `Delete` remain disabled.

### History list

- `ORDER_CREATED` always appears as the oldest entry.
- Each lifecycle action appends exactly one row in the expected order (`NOTE_UPDATED`, `PAYMENT_ADDED`, `PAYMENT_DELETED`, `ORDER_CANCELLED`, `ORDER_REACTIVATED`).
- Deleting a history row optimistically removes it; on server failure the row reappears.

### Authorization

- Navigating to `/purchases/[id]` with an id that does not exist renders the Next.js 404 page.
- Navigating with an id that belongs to another user renders the Next.js 404 page (no distinguishing signal).
