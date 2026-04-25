---
id: WO-03
type: WORK_ORDER
slug: order-payments-balances-and-payment-mutation-rules
title: Order Payments, Balances, and Payment Mutation Rules
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-04-24
implementation_status: IMPLEMENTED
---

# WO-03 Order Payments, Balances, and Payment Mutation Rules

## Summary

Implement payment persistence and payment mutation rules so collectors can track what has been paid, what remains, and correct mistakes by deleting payments when needed. This slice delivers the `addPayment` and `deletePayment` mutations with their atomic transaction contracts, balance guardrails, and derived summary calculations. **Payment mutations do not append `OrderHistory` rows** (`PAYMENT_ADDED` / `PAYMENT_DELETED` were removed from the enum in migration `20260423000000_simplify_order_history_event_types`). The payment panel UI is built in [BP-02 · WO-05](../../bp-02-order-workspace-and-list-experience/work-orders/wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md).

## In Scope

- `addPayment` Server Action: validates amount and date, checks remaining balance atomically, persists `OrderPayment` (no `OrderHistory` row for the payment)
- `deletePayment` Server Action: verifies ownership, deletes `OrderPayment` (no `OrderHistory` row for the deletion)
- Remaining-balance guardrail: blocks payments whose amount exceeds the current remaining balance (enforced server-side inside transaction)
- Derived payment summary: `paidAmount`, `remainingAmount`, `paymentPercentage` — computed at query time for initial load, returned by Server Actions for client-side recalculation
- Detail-query extension: payment records included in the order detail query, ordered by `paymentDate DESC`, tiebreaker `createdAt DESC`
- Pure `calculatePaymentSummary` helper in `src/lib/orders/paymentSummary.ts`
- Zod schemas for `addPayment` and `deletePayment` inputs
- Unit tests for balance calculation helpers and Zod validation rules

## Out of Scope

- Order create/edit form
- Orders list UI
- Delivery-cost reporting
- Payment panel UI components ([BP-02 · WO-05](../../bp-02-order-workspace-and-list-experience/work-orders/wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md))
- Analytics event tracking ([BP-02 · WO-05](../../bp-02-order-workspace-and-list-experience/work-orders/wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md))

## Requirements

- `FR-05-17` through `FR-05-20`
- `BR-05-10` (payments may be deleted; summary recalculates; automatic **order** history is not used for payment lines — see `BR-05-09` in [`FRD-05`](../../frd-05-order-payment-shipment.md) for the read-only history product rule)

## Blueprints

- `BP-01` payment contract
- `BP-01` atomic-write priority

## Validation Contract

### Static Zod rules (enforced at schema boundary)

```ts
addPaymentSchema = z.object({
  orderId: z.string().cuid(),
  amount: z.number().int().min(1), // minimum 1 minor unit; zero and negative blocked
  paymentDate: z.coerce.date().max(new Date()), // no future dates
});

deletePaymentSchema = z.object({
  paymentId: z.string().cuid(),
});
```

### Dynamic mutation-level rules (enforced inside transaction)

| Rule                                | Error code          | Enforcement point                                             |
| ----------------------------------- | ------------------- | ------------------------------------------------------------- |
| `amount <= remainingAmount`         | `EXCEEDS_BALANCE`   | Inside `addPayment` transaction after reading current balance |
| `paymentDate >= order.orderDate`    | `DATE_BEFORE_ORDER` | Inside `addPayment` after fetching the order                  |
| `payment.userId === session.userId` | `NOT_FOUND`         | Inside `deletePayment` before any write (no ownership leak)   |

The balance check and insert must occur within the same `prisma.$transaction` to prevent TOCTOU races when concurrent payment submissions arrive.

## Derived Payment Summary

Computed values are never persisted. The formula is:

```ts
paidAmount = sum(payments.map((p) => p.amount));
remainingAmount = order.totalCost - paidAmount;
paymentPercentage = Math.floor((paidAmount / order.totalCost) * 100);
```

All values use the same minor-unit convention as `Order.totalCost` and `OrderPayment.amount` (cents × 100). `paymentPercentage` is an integer with no decimal places (floor division, not rounding).

### Where calculation lives

- **Initial page load**: computed server-side inside the order detail query shape in `orderQueries.ts`.
- **After add/delete mutation**: the Server Action returns `{ paidAmount, remainingAmount, paymentPercentage, payments }` so the UI updates local state immediately without a refetch round-trip.

This hybrid approach keeps the single calculation source in the query layer while enabling instant client feedback after mutations.

## Technical Notes

- `addPayment` must execute `[read current balance, insert OrderPayment]` inside a single `prisma.$transaction`. The balance check reads existing payment rows for `{ orderId, userId }` within the transaction to prevent TOCTOU races. No `OrderHistory` insert in this path.
- `deletePayment` must execute `[delete OrderPayment]` inside a transaction. No balance race check is needed for delete. No `OrderHistory` insert in this path.
- When `remainingAmount === 0`, `addPayment` must reject any attempt regardless of client state (belt-and-suspenders against stale client UI).
- `paymentDate` is user-provided and stored as-is without server-timezone normalization beyond Prisma's standard handling. The "no future date" check uses the server's current UTC date; the "≥ orderDate" check compares against the persisted `order.orderDate`.
- `paymentPercentage`: when `paidAmount === 0` result is `0`; when `paidAmount === totalCost` result is `100`. Integer floor division is used throughout — never rounding.
- `calculatePaymentSummary` is a pure function with no side effects. It is the single source of truth for these three derived values across both query-time and mutation-response calculations.

## UX Notes

These notes are consumed by [BP-02 · WO-05](../../bp-02-order-workspace-and-list-experience/work-orders/wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md) when building the payment panel. They are defined here because they follow directly from the mutation contracts above.

- The add-payment form must validate `amount` client-side in real time and disable or visually block submission when the entered value exceeds `remainingAmount`.
- When `remainingAmount === 0`, the add-payment button must be hidden or disabled and the panel must display a "fully paid" state instead of the add-payment form.
- After a successful `addPayment` or `deletePayment`, the client updates state using the summary returned by the Server Action. No full page refetch is needed.
- Percentage is displayed without decimals (e.g. "73%", not "73.3%").
- Delete payment requires a user confirmation modal before the mutation is dispatched (payments are managed from the read-only detail view; the operation is immediately destructive with no undo).

## Security Notes

- `userId` is taken exclusively from the authenticated session — never from client input.
- `deletePayment` queries `OrderPayment` by `{ id: paymentId, userId }`. A missing record (whether non-existent or belonging to another user) returns `NOT_FOUND` with no distinguishing message.
- The balance check inside `addPayment` reads `OrderPayment` rows filtered by `{ orderId, userId }` to prevent cross-user balance interference.
- `amount` and `paymentDate` are validated at the Zod boundary before reaching the database layer.
- `orderId` ownership is verified inside `addPayment` by querying `Order` with `{ id: orderId, userId }` before any write.

## Assumptions

- `OrderPayment` schema, `orderPaymentMutations.ts` module path, and `userId` on `OrderPayment` are established by [BP-01 · WO-01](./wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md). `OrderHistoryEventType` no longer includes payment event types (removed in migration `20260423000000_simplify_order_history_event_types`).
- `hasUnpaidBalance` derived field shape is defined in [BP-01 · WO-02](./wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md). This slice owns `paidAmount`, `remainingAmount`, and `paymentPercentage` as the complementary summary fields.
- `order.totalCost` is persisted before any payment mutation is attempted ([BP-01 · WO-01](./wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md) / [BP-02 · WO-04](../../bp-02-order-workspace-and-list-experience/work-orders/wo-04-order-create-and-edit-form-with-spreadsheet-style-item-entry.md) prerequisite).
- The detail query shape extended here is consumed by [BP-02 · WO-05](../../bp-02-order-workspace-and-list-experience/work-orders/wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md) to render the payment panel.

## Module Structure

| Path                                           | Responsibility                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib/data/orders/orderPaymentMutations.ts` | `addPayment` and `deletePayment` with full transaction contracts (path established in WO-01; implemented here)     |
| `src/lib/data/orders/orderQueries.ts`          | Extend order detail query to include payment list and derived summary fields                                       |
| `src/lib/orders/orderValidation.ts`            | `addPaymentSchema` and `deletePaymentSchema` (extends WO-01 base schemas)                                          |
| `src/lib/orders/paymentSummary.ts`             | Pure `calculatePaymentSummary(totalCost, payments)` returning `paidAmount`, `remainingAmount`, `paymentPercentage` |

Module paths must be validated against `.cursor/rules/project-structure.mdc` and `.cursor/rules/prisma-data-layer.mdc` at implementation time.

## Unit Tests

### `calculatePaymentSummary`

| Scenario                            | Input                                    | Expected                                  |
| ----------------------------------- | ---------------------------------------- | ----------------------------------------- |
| No payments                         | `totalCost=10000, payments=[]`           | `paidAmount=0, remaining=10000, pct=0`    |
| One partial payment                 | `totalCost=10000, payments=[3000]`       | `paidAmount=3000, remaining=7000, pct=30` |
| Multiple partial payments           | `totalCost=10000, payments=[5000, 2000]` | `paidAmount=7000, remaining=3000, pct=70` |
| Fully paid                          | `totalCost=10000, payments=[10000]`      | `paidAmount=10000, remaining=0, pct=100`  |
| Percentage uses floor (no round-up) | `totalCost=10000, payments=[7350]`       | `pct=73`                                  |

### `addPaymentSchema` (Zod)

| Scenario                    | Expected |
| --------------------------- | -------- |
| `amount=0`                  | Invalid  |
| `amount=-1`                 | Invalid  |
| `amount=1`                  | Valid    |
| `paymentDate` in the future | Invalid  |
| `paymentDate` = today       | Valid    |
| `orderId` not a cuid        | Invalid  |

### Balance guardrail (mutation-level)

| Scenario                              | Expected                                       |
| ------------------------------------- | ---------------------------------------------- |
| `amount < remainingAmount`            | Payment persisted                              |
| `amount === remainingAmount`          | Payment persisted (100% of remaining is valid) |
| `amount > remainingAmount`            | Rejected with `EXCEEDS_BALANCE`                |
| `remainingAmount === 0`, any `amount` | Rejected with `EXCEEDS_BALANCE`                |

### `paymentDate` range (mutation-level)

| Scenario                          | Expected                          |
| --------------------------------- | --------------------------------- |
| `paymentDate === order.orderDate` | Valid (boundary inclusive)        |
| `paymentDate < order.orderDate`   | Rejected with `DATE_BEFORE_ORDER` |
| `paymentDate === today`           | Valid                             |
| `paymentDate > today`             | Rejected (Zod boundary)           |

## E2E Acceptance Tests

- Users can add a valid payment and see `paidAmount`, `remainingAmount`, and `paymentPercentage` update immediately without a page reload.
- Users cannot add a payment larger than the remaining amount; a clear error message is shown.
- Users can add a payment exactly equal to the remaining amount; the order moves to fully-paid state.
- When all payments sum to `totalCost`, the add-payment button is hidden or disabled and a "fully paid" indicator is shown.
- Deleting a payment recalculates the order summary correctly and the add-payment button becomes available again.
- A payment with `paymentDate` before the order date is rejected.
- A payment with a future `paymentDate` is rejected.
