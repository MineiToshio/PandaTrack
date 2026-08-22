---
id: WO-09
type: WORK_ORDER
slug: store-payment-assignment-and-open-order-debt
title: Store Payment Assignment and Open-Order Debt
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-08-20
implementation_status: IMPLEMENTED
---

# WO-09 Store Payment Assignment and Open-Order Debt

## Summary

Two changes to the store-level payment domain, approved by the owner and implemented 2026-08-20
(uncommitted, staging):

1. **The debt figure shown for a store counts only its open orders.** A fully delivered order leaves
   the debt calculation together with its own payments, never leaving one behind without the other,
   because the market this product serves never lets a store hand over goods before it is paid in
   full: a delivered order carrying a balance is a registration gap, not a real debt. The figure that
   VALIDATES a new payment stays the full lifetime debt (including delivered orders), so a late
   payment on an already-closed order keeps working.
2. **A payment raised against a store must account for every unit of its own amount**, either by
   naming products or by an explicit "I don't know yet" that parks the rest on purpose. Naming a
   product derives its order; the collector is never asked to remember a generated order code. A
   payment raised from inside an order (`addOrderPayment`) is untouched by this: naming products
   there stays exactly as optional as it is today.

Both changes are additive to the store-level payment machinery already shipped
(`docs-and-standards.mdc`-tracked as store-level payments, migration `20260808215744`): the product
picker, the allocation ceilings, and the transaction-refusal discipline (ADR 0022) all stay in place.
This work order hardens and extends them; it does not replace them.

## Prerequisites

- [`WO-01`](wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md) — the currency
  catalog and the order/payment persistence contracts this work order's new query and mutation reuse
  as-is
- [`WO-02`](wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md) —
  `Order.allocatedAmountMinor`, `Order.totalCost`, `OrderStatus`, and the derived-status rules
  `consumeUnassignedStoreMoneyOnOrderClose` keys its close-time trigger on (an order's status becoming
  `COMPLETED`)
- [`WO-03`](wo-03-order-payments-balances-and-payment-mutation-rules.md) — `StorePayment`,
  `PaymentAllocation`, `createStorePayment`, `getStoreDebtMinor` / `getStoreDebtByCurrency`, and the
  `ADR 0022` pre-write refusal discipline already shipped as store-level payments (migration
  `20260808215744`). This work order hardens and extends that surface; it does not assume any part of
  it is unbuilt.
- [`WO-10`](wo-10-order-open-balance-and-store-account-adjustment-model.md) — sole owner of
  `StoreAccountAdjustmentLine` and the canonical `openBalanceMinor(order)` helper (`BR-05-32`,
  `ADR 0034`) that `openOrderDebtMinor`, `unrecordedPaymentsMinor`, and
  `consumeUnassignedStoreMoneyOnOrderClose` all read in this work order. **This reverses this document's
  own earlier landing order** (see `## Notes`): `openBalanceMinor` did not exist when this work order
  was first scoped against a gross balance, and it now cannot be net of adjustment lines without the
  model `WO-10` defines. **(round-4 arbitration):** `WO-10` was split into two work orders; the model
  (`StoreAccountAdjustment`, `StoreAccountAdjustmentLine`, `openBalanceMinor`,
  `declaredAgainstOrderMinor`) stays `WO-10`, under this new filename, while the "cuadrar cuenta" write
  action itself moved to a new `WO-11` (see `## Out of Scope`). The canonical build order across the
  whole package, `WO-01 → WO-02 → WO-03 → WO-10 → WO-09 → WO-11 → {WO-08, WO-07}`, is declared once in
  `FRD-05 · BP-01`'s own implementation plan; this document cites it rather than restating it.

## In Scope

- `createStorePayment`: a `requireFullAllocation` flag, set only by the store-level entry point
  (`createStorePaymentAction`), that hardens `Σ allocations.amountMinor <= amount` to
  `Σ allocations.amountMinor + parkedAmountMinor === amount`
- A new `parkedAmountMinor` field on `CreateStorePaymentInput`: request-shape only, never persisted,
  the deliberate "I don't know yet" amount the collector chose not to name
- A new `ALLOCATION_SUM_BELOW_PAYMENT` error for the undershoot half of the hardened rule
- `getUnassignedStoreMoneyMinor(storeId, currencyCode)`: the precise "money paid to this store, in
  this currency, not yet declared against any non-cancelled order" figure
- `consumeUnassignedStoreMoneyOnOrderClose`: applies `min(order's own remaining balance, unassigned
store money)` to an order the moment it closes, so it never leaves debt behind uncollected in its
  own store's unassigned pool
- Promoting `activeCommittedMinor - activePaidMinor` (already computed by `getStoreDebtByCurrency`
  for the progress bar) to the figure every "Debes / Falta" surface renders, replacing the lifetime
  `debtMinor` there
- Retiring the store detail block's `outsideActiveOrders` reconciliation line. The dashboard's
  "payments you never recorded" figure is **not** a reuse of this line's arithmetic: the same
  underlying idea, at a different scope, is defined independently by
  [`FRD-06 · WO-07`](../../../frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md)
  (global, in base currency, with FX-reconciliation exclusion), compared with this work order's own
  `outsideActiveOrders` line (store/currency-scoped, no FX handling). This work order only owns
  retiring the store-level line; it does not hand its formula to `WO-07`.
- Client-side mirror of the equality rule and the explicit "I don't know yet" affordance in
  `StorePaymentAllocationPanel` / `storePaymentSheetValidation.ts`

## Out of Scope

- Calling `consumeUnassignedStoreMoneyOnOrderClose` from whichever delivery mutation actually closes an
  order (`persistDerivedOrderStatuses`, called by both `createDelivery` with `receivedDate` set and
  `markDeliveryDelivered`; **round-4 correction:** an earlier draft of this bullet named only
  `markDeliveryDelivered`, but the five approved settlement launchers verifiably call `createDelivery`
  instead). That call site belongs to
  [`FRD-08 · WO-08`](../../../frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md);
  this work order only owns the function being called and its contract.
- The "Ya pagué el resto" checkbox and the two-transaction settle-on-arrival flow
  (`FRD-08 · WO-08`)
- The dashboard's "pagos que no registraste" figure and its own global, base-currency,
  FX-reconciliation-excluded derivation: defined and owned independently by
  [`FRD-06 · WO-07`](../../../frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md),
  not handed off from this work order's store/currency-scoped `unrecordedPaymentsMinor`
- The "cuadrar cuenta" reconciliation action ([`WO-11`](./wo-11-store-account-reconciliation-action.md),
  split from the former `WO-10` in the round-4 arbitration)
- Naming a pedido by date instead of by its generated code, wherever this work order's surfaces
  happen to render one (tracked as a separate cross-cutting requirement, not owned here)

## Requirements

- `FR-05-58` through `FR-05-63`
- `BR-05-26`, `BR-05-27`, `BR-05-28`, `BR-05-31`

## Blueprints

- `BP-01` payment contract (hardened: store-level allocation now sums to equality)
- `BP-01` architecture decision: debt scoped to open orders (`ADR 0033`)

## Validation Contract

| Rule                                                                                                                                                                                    | Error code                                                                                 | Enforcement point                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `amount` well-formed, positive, within the ceiling (unchanged)                                                                                                                          | `AMOUNT_INVALID`, `AMOUNT_FRACTIONAL_SUBUNITS`                                             | `createStorePayment`, before the first write                                                                                          |
| `amount <= validationCeilingMinor` (lifetime debt, includes `COMPLETED` orders; unchanged, `FR-05-63`)                                                                                  | `STORE_DEBT_EXCEEDED`                                                                      | `createStorePayment`, via `getStoreDebtMinor`                                                                                         |
| Order-scoped caller (`addOrderPayment`, `createOrder`'s initial payment): `Σ allocations.amountMinor <= amount` (unchanged)                                                             | `ALLOCATION_SUM_EXCEEDS_PAYMENT`                                                           | `createStorePayment` / `writeStorePaymentWithAllocations`, `requireFullAllocation` left `false`                                       |
| Delivery-settlement caller (`FRD-08 · WO-08`'s settlement write, raised through `createStorePayment` with `settledByDeliveryId` set): `Σ allocations.amountMinor <= amount` (unchanged) | `ALLOCATION_SUM_EXCEEDS_PAYMENT`                                                           | `createStorePayment`, `requireFullAllocation` left `false`; the caller already knows the order it settles, so nothing is left to park |
| Store-level caller (`createStorePaymentAction`, `requireFullAllocation: true`): sum overshoots                                                                                          | `ALLOCATION_SUM_EXCEEDS_PAYMENT`                                                           | `createStorePayment`, before the first write                                                                                          |
| Store-level caller: sum undershoots and `parkedAmountMinor` does not close the gap                                                                                                      | `ALLOCATION_SUM_BELOW_PAYMENT` (new)                                                       | `createStorePayment`, before the first write, only when `requireFullAllocation` is `true`                                             |
| Per-line / per-item ceilings (unchanged)                                                                                                                                                | `EXCEEDS_BALANCE`, `EXCEEDS_ITEM_BASE`, `ITEM_ORDER_MISMATCH`, `ALLOCATION_AMOUNT_INVALID` | `validateAllocations`, before the first write                                                                                         |
| Close-time consumption never exceeds the closing order's own remaining balance                                                                                                          | none (`min(remaining, unassigned)` cannot overshoot by construction)                       | `consumeUnassignedStoreMoneyOnOrderClose`                                                                                             |
| Batch close-time consumption is applied oldest order first                                                                                                                              | none (ordering rule, `orderDate ASC, humanReadableId ASC`)                                 | caller loop around `consumeUnassignedStoreMoneyOnOrderClose` (`FRD-08 · WO-08`)                                                       |

Every refusal above is decided before `createStorePayment`'s first write, inside the same
`runSerializableTransaction` callback that already guards `STORE_DEBT_EXCEEDED` and `EXCEEDS_BALANCE`
(ADR 0022); `ALLOCATION_SUM_BELOW_PAYMENT` joins that pre-write block rather than opening a second
one. `consumeUnassignedStoreMoneyOnOrderClose` needs no sentinel-rollback path of its own: it only
ever writes `min(remaining, unassigned)`, a value that cannot violate `EXCEEDS_BALANCE` by
construction, so it has no refusal branch to decide late.

An allocation submitted by the store-level surface never carries a bare `orderId`: the payload only
ever carries `orderItemId`, and `orderId` is read off the chosen product server-side, exactly as
`validateAllocations` already does today. This is a client-shape discipline (`StorePaymentAllocationPanel`,
`buildAllocationInputs`), not a new server error code.

## Derived Payment Summary

```ts
// Validation ceiling. UNCHANGED by this work order: every non-cancelled order, including COMPLETED
// ones, so a late payment on an already-delivered order keeps working (FR-05-63).
// Already implemented as getStoreDebtMinor (transactional) / getStoreDebtByCurrency(...).debtMinor.
validationCeilingMinor =
  sum(order.totalCost for order in nonCancelledOrders(store, currency)) -
  (sum(storePayment.amount for payment in payments(store, currency)) - lostMinor);

// Displayed figure, "Pendiente en pedidos abiertos" (BR-05-26 / FR-05-61). Reads the canonical
// per-order balance (openBalanceMinor, FRD-05 · BR-05-32, ADR 0034: totalCost minus allocations
// minus reconciliation adjustment lines) rather than holding its own formula, so an active order
// that was partially written off in a store reconciliation is never overstated here. Before
// StoreAccountAdjustmentLine existed this was exactly the pair getStoreDebtByCurrency already
// computed for the progress bar (StoreDebtRow.activeCommittedMinor / activePaidMinor); this work
// order promotes it to be the number every "Debes / Falta" surface renders, in place of the
// lifetime debtMinor, and cites BR-05-32 instead of re-deriving the subtraction itself.
openOrderDebtMinor =
  sum(openBalanceMinor(order) for order in activeStatusOrders(store, currency));

// Store/currency-scoped shape of what the retired "outsideActiveOrders" reconciliation line already
// computed, shown here only to justify retiring that line. Also reads openBalanceMinor per order, so
// an order already covered by a reconciliation adjustment does not read as an unrecorded payment a
// second time. This is NOT the figure FRD-06 · WO-07 renders: WO-07's "pagos que no registraste" is
// global, in base currency, with the FX-reconciliation exclusion applied (FR-06-13); it is defined
// independently there, at its own scope, not derived from or handed off by this formula (FR-06-28 /
// BR-06-13). NEVER clamped to zero per order (round-4 arbitration, BR-05-32): openBalanceMinor cannot
// be negative by construction (each of its three terms is bounded before being written), so a negative
// reading here can only mean one of those ceilings was bypassed and money was counted twice; clamping
// it to zero in this sum would convert that one loud symptom into silence, exactly the failure BR-05-32
// forbids. A `max(0, ...)` guard in an earlier draft of this formula is retracted for the same reason
// BR-06-08 was corrected in FRD-06.
unrecordedPaymentsMinor(storeId, currencyCode) =
  sum(openBalanceMinor(order) for order in completedOrders(store, currency));

// Unassigned ("parked") money (BR-05-27 / FR-05-60). New, precise figure: store/currency-wide, every
// non-cancelled order. Backs the CHANGE-1.6 guard, the "no sé todavía" display, and this work
// order's own close-time consumption. Unaffected by StoreAccountAdjustmentLine: an adjustment line
// reduces what an order is shown to owe, never what a StorePayment is shown to have paid, so this
// figure's own two terms (payments in, allocations out) are unchanged by ADR 0034.
unassignedStoreMoneyMinor(storeId, currencyCode) =
  (sum(storePayment.amount for payment in payments(store, currency)) - lostMinor) -
  sum(order.allocatedAmountMinor for order in nonCancelledOrders(store, currency));

// Close-time consumption (BR-05-28), applied once when an order's derived status becomes COMPLETED.
// Reads the canonical openBalanceMinor (FRD-05 · BR-05-32, ADR 0034), not the older
// totalCost - allocatedAmountMinor: an order that a store reconciliation already partly or fully
// wrote off must not have unassigned money land on top of a balance that no longer exists, or that
// money never reduces the debt of the order it actually still belongs to (spec's write-off scenario).
orderRemainingMinor = openBalanceMinor(order);
consumedMinor = min(orderRemainingMinor, unassignedStoreMoneyMinor(order.storeId, order.currencyCode));
// Written as one PaymentAllocation(orderId: order.id, orderItemId: null) per contributing
// StorePayment, drained oldest paymentDate first until consumedMinor is covered. This consumption
// never writes a StoreAccountAdjustmentLine and never changes one; it only interacts with
// openBalanceMinor's other term (PaymentAllocation) and reads whatever adjustment lines already
// exist as a fixed input.
```

### The numeric example that forces the consumption rule (spec §2.3)

```
Store S, currency X. Order A totalCost 50, Order B totalCost 50 -> committed 100.
An unassigned payment of 30 arrives (no allocations) -> paidMinor 30, validationCeilingMinor 70. Correct.

Order A is delivered.

WITHOUT close-time consumption:
  A leaves the debt calculation with its own 50 subtracted from committedMinor, but with none of
  the 30 unassigned money, because it was never assigned to A. What is left reads as B's 50 minus
  the 30 still sitting unassigned = 20, while B alone genuinely still owes 50.
  Understated by 30 -- a silent hole in the store's own money.

WITH close-time consumption (this work order):
  Closing A first runs consumeUnassignedStoreMoneyOnOrderClose: orderRemainingMinor(A) = 50,
  unassignedStoreMoneyMinor(S, X) = 30, consumedMinor = min(50, 30) = 30. A takes the 30 with it
  when it leaves the active set; its own remaining balance drops to 20 (still short, but that 20
  is A's own gap, tracked at the order level exactly as it is today, not the store debt's problem).
  openOrderDebtMinor is now B's 50 alone. Correct, and it stays correct no matter how many more
  orders close afterward.
```

Overstating the wrong order's debt is visible and gets corrected the next time that order is looked
at; understating it silently erodes the whole store's figures and is never noticed until a much
later reconciliation. That asymmetry is why `min(remaining, unassigned)` always applies to the
CLOSING order rather than leaving the money in the pool for someone to notice later (`BR-05-28`).

### The numeric example that forces reading `openBalanceMinor` instead of the gross balance

```
Store S, currency X. Order C totalCost 180, no payments -> committed 180, openOrderDebtMinor 180.

The store then has no other open order for months, so the collector reconciles the account
(FRD-05 · FR-05-64): the whole 180 is written off with one StoreAccountAdjustmentLine against C.
openOrderDebtMinor(S, X) is now 0 (BR-05-32: 180 - 0 allocations - 180 adjustment = 0).

Months later, C finally arrives and its delivery is marked delivered.

WITH the pre-ADR-0034 formula (orderRemainingMinor = totalCost - allocatedAmountMinor):
  orderRemainingMinor(C) = 180 - 0 = 180. If any unassigned money sits in (S, X), up to 180 of it
  gets consumed into C, re-inflating a balance the collector already resolved months earlier, and
  FRD-08 · WO-08's settlement checkbox would separately offer to write a fresh 180 StorePayment for
  a debt that no longer exists -- exactly the double-resolution ADR 0034 exists to prevent.

WITH openBalanceMinor (this work order, ADR 0034):
  orderRemainingMinor(C) = openBalanceMinor(C) = 180 - 0 - 180 = 0. consumeUnassignedStoreMoneyOnOrderClose
  is a no-op for C: there is nothing left to consume into it, so any unassigned money in (S, X) stays
  available for whichever order genuinely still owes something. WO-08's settlement checkbox does not
  even render for C, because its openBalanceMinor is already 0.
```

## Technical Notes

- **`requireFullAllocation` is a caller-chosen flag, not a global behavior change.** Both
  `addOrderPayment` (`orderPaymentMutations.ts`) and `createOrder`'s initial payment already reach
  `createStorePayment` / `writeStorePaymentWithAllocations` with allocations that may legitimately
  fall short of the payment's amount (§3.5, `BR-05-31`). Neither caller is touched by this work
  order: they simply never set the flag, so `Σ allocations.amountMinor <= amount` keeps being the
  only rule they see. Only `createStorePaymentAction` (the `StorePaymentSheet`'s own Server Action)
  sets `requireFullAllocation: true`.
- **`parkedAmountMinor` is never persisted.** It exists purely so the equality check has something
  to add to `Σ allocations.amountMinor` when the collector deliberately leaves money unassigned. The
  written state of "money not yet assigned" is exactly what it always was: a `StorePayment` with
  allocations that do not cover its own `amount`. The field's only job is turning a silent shortfall
  into a value the server can prove was intentional.
- **`consumeUnassignedStoreMoneyOnOrderClose` is unconditional.** Spec §2.3 requires the money to be
  applied "even if the user skips the prompt" that asks whether the unassigned money belonged to the
  order being closed. The confirmation dialog is a courtesy step owned by whichever surface triggers
  the close (`FRD-08 · WO-08`); the mutation itself never waits on it and never has a "skip"
  parameter, because skipping changes nothing about what gets written.
- **No schema migration.** Consumption reuses the existing `PaymentAllocation` shape with
  `orderItemId: null`, the same shape "on account" allocations already use today.
  `requireFullAllocation` and `parkedAmountMinor` are request-shape only. `getUnassignedStoreMoneyMinor`
  is a derivation over existing columns (`StorePayment.amount`, `Order.allocatedAmountMinor`,
  `PaymentAllocation` for the `lostMinor` exclusion), not a new stored value.
- **`resolveDebtReconciliationLine`'s `outsideActiveOrders` branch becomes structurally zero against
  the new headline**, because before `StoreAccountAdjustmentLine` existed `openOrderDebtMinor` equalled
  `activeCommittedMinor - activePaidMinor` by construction; the gap that branch used to name no longer
  exists between the headline and the bar. It is removed from the store detail block rather than left
  dead. Its `onAccount` branch is superseded by `unassignedStoreMoneyMinor`, which is exact
  (store/currency-wide over every non-cancelled order) where `computeDebtOutsideActiveOrdersMinor`'s
  derivation was only approximately so.
- **`openOrderDebtMinor` now reads `openBalanceMinor` per order (`FRD-05 · BR-05-32`, `ADR 0034`),
  so it can diverge from `activeCommittedMinor - activePaidMinor` once an active order carries a
  reconciliation adjustment line** (`FRD-05 · WO-10`): the headline nets that line out, while the
  progress bar's own `activeCommittedMinor` / `activePaidMinor` pair (`getStoreDebtByCurrency`) is a
  paid-versus-committed visual, not a third bar segment for "written off". This is the same kind of
  declared gap `ADR 0027` already requires elsewhere in this package: the headline number is correct,
  and the bar visibly under-represents how much of the gap between its own two ends has actually been
  resolved. Reconciling the bar itself (a third segment, or narrowing its own denominator) is left to
  implementation as a presentation refinement, not a correctness requirement of this work order.
- **Batch consumption order matches the settle-on-arrival batch order** (`orderDate ASC,
humanReadableId ASC`, `FR-08-45` / spec §1.7) so a store-grouped batch that closes several orders
  in one delivery drains the same shared pool deterministically, oldest order first.

## UX Notes

- The store-level sheet keeps its product-first picker exactly as built
  (`StorePaymentAllocationPanel`, listing payable lines per product with a "Resto del pedido" line
  for the order-level remainder). What changes is the submit gate: with money left over and nothing
  parked, the submit control stays disabled and the panel surfaces an explicit "I don't know yet"
  action next to the remaining amount. Choosing it sets `parkedAmountMinor` to the exact remainder;
  it is never a default, only a deliberate choice (`FR-05-58`, spec §3.4).
- The order-inline payment form (`OrderInlinePaymentForm`) is visually and behaviorally unchanged:
  no submit gate, no "I don't know yet" control, because there is nothing to park when the order is
  already known from context (`BR-05-31`).
- Every store headline that today reads the lifetime `debtMinor` (`StoreGroupHeader`'s "Debes
  {amount}", `StorePaymentProgressRows`, the `stores/[slug]` page header) switches to
  `openOrderDebtMinor` and its label moves from "Debes {amount}" to "Pendiente en pedidos abiertos
  {amount}" (copy table, spec §6 / §2.5). The `StorePaymentSheet`'s own ceiling messaging
  (`StorePaymentPanel`'s `debtAmount` / `exceedsDebt` strings) keeps reading the lifetime `debtMinor`
  unchanged, because that copy is about what a NEW payment may still validly cover, not about what is
  outstanding on open orders.
- `unassignedStoreMoneyMinor`, when positive, is shown as its own line wherever the store's payment
  state is summarized ("{store} holds {amount} already paid and not assigned", spec §6), never folded
  into `openOrderDebtMinor`.

## Security Notes

- `requireFullAllocation` and `parkedAmountMinor` are set by the Server Action, never trusted from
  arbitrary client input beyond the amount the collector actually typed for the parked slice; the
  equality check itself re-derives `Σ allocations.amountMinor` server-side from the validated
  allocation list, exactly as `ALLOCATION_SUM_EXCEEDS_PAYMENT` already does.
- `getUnassignedStoreMoneyMinor` and `consumeUnassignedStoreMoneyOnOrderClose` are scoped by
  `userId` on every read and write, the same ownership discipline `getStoreDebtMinor` and
  `recalculateOrderAllocationCache` already carry.
- `consumeUnassignedStoreMoneyOnOrderClose` never crosses a store boundary: the unassigned pool it
  reads is keyed by the closing order's own `(storeId, currencyCode)`, so money paid to a different
  store can never be pulled in.

## Assumptions

- `StorePayment`, `PaymentAllocation`, `Order.allocatedAmountMinor`, `getStoreDebtByCurrency`,
  `getStoreDebtMinor`, `validateAllocations`, and `createStorePayment`'s existing pre-write refusal
  chain are established by store-level payments (migration `20260808215744`) and by
  [`BP-01`'s payment contract](../bp-01-order-domain-foundation.md). This work order hardens and
  extends them; it assumes them as-is.
- [`FRD-08 · WO-08`](../../../frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md)
  is the caller that invokes `consumeUnassignedStoreMoneyOnOrderClose` at the moment an order's
  derived status becomes `COMPLETED`; this work order does not wire that call site.
- [`FRD-06 · WO-07`](../../../frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md)
  does **not** consume this work order's `unrecordedPaymentsMinor`. It defines its own "payments you
  never recorded" derivation independently, at a different scope (global, base currency,
  FX-reconciliation-excluded, versus this work order's store/currency-scoped figure), because that
  scope mismatch makes literal reuse impossible. This work order's own responsibility ends at retiring
  the store detail's `outsideActiveOrders` line.
- [`WO-11`](./wo-11-store-account-reconciliation-action.md) (the "cuadrar cuenta" reconciliation action,
  split from the former `WO-10` in the round-4 arbitration) is expected to read
  `unassignedStoreMoneyMinor` and the same active-order ordering this work order establishes, rather
  than recomputing either.

## Module Structure

| Path                                                                                           | Responsibility                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/data/orders/storePaymentMutations.ts`                                                 | `requireFullAllocation` + `parkedAmountMinor` on `createStorePayment`; new `ALLOCATION_SUM_BELOW_PAYMENT`; new `consumeUnassignedStoreMoneyOnOrderClose` |
| `src/lib/data/orders/storePaymentQueries.ts`                                                   | New `getUnassignedStoreMoneyMinor`; `getStoreDebtByCurrency` / `getStoreDebtMinor` unchanged (validation ceiling stays lifetime-wide)                    |
| `src/lib/data/orders/orderPaymentAllocations.ts`                                               | No functional change; `recalculateOrderAllocationCache` reused by the new consumption path                                                               |
| `src/lib/orders/storePaymentPresentation.ts`                                                   | Promote `activeCommittedMinor - activePaidMinor` to the displayed headline; retire the `outsideActiveOrders` kind of `resolveDebtReconciliationLine`     |
| `src/lib/orders/storePaymentSheetValidation.ts`                                                | Client mirror of the hardened equality rule; `parkedAmountMinor` in the draft shape                                                                      |
| `src/components/modules/StorePaymentSheet/StorePaymentAllocationPanel.tsx`                     | The explicit "I don't know yet" affordance next to the remaining amount                                                                                  |
| `src/components/modules/StorePaymentSheet/StorePaymentSheet.tsx`                               | Submit gate reads the new equality validation instead of the `<=` one                                                                                    |
| `src/app/[locale]/(app)/_actions/storePaymentActions.ts`                                       | `createStorePaymentAction` sets `requireFullAllocation: true`                                                                                            |
| `src/app/[locale]/(app)/stores/[slug]/_components/StorePaymentProgressRows.tsx`                | Headline switches from `debtMinor` to `openOrderDebtMinor`; label changes to "Pendiente en pedidos abiertos"                                             |
| `src/app/[locale]/(app)/orders/_components/StoreGroupHeader.tsx`                               | Same headline switch, on the "Por tienda" order view                                                                                                     |
| `src/app/[locale]/(app)/stores/[slug]/page.tsx`, `src/app/[locale]/(app)/orders/[id]/page.tsx` | Read the new figure where the page currently reads `debtMinor` for display                                                                               |
| `src/lib/data/orders/pendingProductsByStoreQueries.ts`                                         | `StoreDebtEntry` gains `openOrderDebtMinor` alongside the unchanged `debtMinor`                                                                          |

No Prisma migration: this work order adds no persisted column. Module paths must be validated
against `.agents/rules/project-structure.mdc` and `.agents/rules/prisma-data-layer.mdc` at
implementation time.

## Unit Tests

### `createStorePayment` with `requireFullAllocation: true`

| Scenario                                                                | Expected                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| `Σ allocations === amount`, `parkedAmountMinor` omitted                 | Payment persisted                              |
| `Σ allocations + parkedAmountMinor === amount`, `parkedAmountMinor > 0` | Payment persisted                              |
| `Σ allocations + parkedAmountMinor < amount`                            | Rejected with `ALLOCATION_SUM_BELOW_PAYMENT`   |
| `Σ allocations > amount`                                                | Rejected with `ALLOCATION_SUM_EXCEEDS_PAYMENT` |
| `Σ allocations === 0`, `parkedAmountMinor === amount`                   | Payment persisted, fully parked (spec §3.4)    |

### `createStorePayment` / `writeStorePaymentWithAllocations` with `requireFullAllocation: false` (regression)

| Scenario                                                                         | Expected                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `addOrderPayment` with no allocations                                            | Payment persisted "on account", unchanged from today's behavior |
| `addOrderPayment` with a partial breakdown                                       | Payment persisted, unaffected by the new equality rule          |
| `createOrder`'s initial payment (`writeStorePaymentWithAllocations` direct call) | Unaffected; the flag does not exist on that call path           |

### `getStoreDebtByCurrency` / `openOrderDebtMinor`

| Scenario                                                                                           | Expected                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Store with one `OPEN` order (100) and one `COMPLETED` order fully paid                             | `openOrderDebtMinor = 100`, `validationCeilingMinor` unaffected by which order is which                                                                      |
| Store with one `COMPLETED` order carrying a balance of 30 (registration gap)                       | `openOrderDebtMinor` excludes the 30; `unrecordedPaymentsMinor = 30`                                                                                         |
| Every order `CANCELLED`                                                                            | `openOrderDebtMinor = 0`                                                                                                                                     |
| Store with one `OPEN` order (180) partially written off by a `StoreAccountAdjustmentLine` of 100   | `openOrderDebtMinor = openBalanceMinor(order) = 80`, not the gross `180`                                                                                     |
| Store with one `OPEN` order (180) fully written off by a `StoreAccountAdjustmentLine` of 180       | `openOrderDebtMinor = 0`; the order still counts toward "Pedidos activos" (`ACTIVE_ORDER_STATUSES`), only the money figure reads zero                        |
| Store with one `COMPLETED` order (180) whose balance was fully written off before it was delivered | `unrecordedPaymentsMinor = 0` (its `openBalanceMinor` is already `0`), not `180`; the write-off is not mistaken for a payment the collector forgot to record |

### `getUnassignedStoreMoneyMinor` (spec §2.3 numeric example)

| Scenario                                                                                             | Expected                                 |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Order A (50) and B (50), one unassigned payment of 30                                                | `unassignedStoreMoneyMinor = 30`         |
| Same state, after A is fully allocated (30) by a subsequent declaration                              | `unassignedStoreMoneyMinor = 0`          |
| A payment `lost` against a cancelled order is excluded from both `paidMinor` and the unassigned pool | Unassigned figure unaffected by the loss |

### `consumeUnassignedStoreMoneyOnOrderClose`

| Scenario                                                                                                                             | Expected                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Order A (remaining 50) closes, unassigned pool has 30                                                                                | `consumedMinor = 30`; A's own remaining balance is now 20; pool is now 0                                                                               |
| Order A (remaining 20) closes, unassigned pool has 30                                                                                | `consumedMinor = 20`; A fully covered; pool still has 10                                                                                               |
| Order A (remaining 50) closes, unassigned pool has 0                                                                                 | No-op; no `PaymentAllocation` written                                                                                                                  |
| Pool spread across two payments (paymentDate D1 then D2), only D1's remainder needed                                                 | Only D1's `PaymentAllocation` is written; D2 untouched                                                                                                 |
| Two orders of the same store/currency close in the same batch, pool covers only the first                                            | Older order (`orderDate ASC, humanReadableId ASC`) is fully covered first, newer gets whatever is left                                                 |
| Spec §2.3's full walkthrough (A=50, B=50, unassigned=30)                                                                             | After A closes: `openOrderDebtMinor = 50` (B alone), not 20                                                                                            |
| Order C (`totalCost` 180) was fully written off by a `StoreAccountAdjustmentLine` of 180 before closing; unassigned pool has 30      | `orderRemainingMinor(C) = openBalanceMinor(C) = 0`; `consumedMinor = 0`; no `PaymentAllocation` is written; the 30 stays in the pool for another order |
| Order D (`totalCost` 180) was partially written off by a `StoreAccountAdjustmentLine` of 100 before closing; unassigned pool has 200 | `orderRemainingMinor(D) = openBalanceMinor(D) = 80`; `consumedMinor = min(80, 200) = 80`; D's `openBalanceMinor` is now `0`; pool is now 120           |

### Concurrency

| Scenario                                                                                                                                                                                                   | Expected                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two deliveries close two different orders (A and B) of the **same** store/currency at the same instant, both racing to consume the **same** unassigned pool of 30, each order's own remaining balance ≥ 30 | Both `consumeUnassignedStoreMoneyOnOrderClose` calls run inside `runSerializableTransaction`; the database's serializable isolation forces one to commit first and the other to retry against the now-smaller pool, so the two consumptions never both read the same pre-consumption 30 and together over-consume past what the store actually holds. The pool's total drawn down never exceeds `min(A's demand + B's demand, 30)` |

## E2E Acceptance Tests

- Opening the store payment sheet, typing an amount, and naming products that add up to less than
  the amount keeps the submit control disabled and shows the "I don't know yet" affordance for the
  remainder; choosing it enables submission and the payment is recorded with the named products plus
  a parked remainder.
- Naming products across two different orders of the same store, with the sum equal to the typed
  amount, submits successfully and both orders' balances drop by their own named share.
- The `OrderInlinePaymentForm` still accepts a payment with no products named at all, unchanged.
- A store with every order delivered and settled shows "Pendiente en pedidos abiertos: 0.00" even if
  an older delivered order still carries an unregistered balance; that balance is visible instead as
  a diagnostic figure, not as debt.
- Marking an order's last product delivered while unassigned money sits in that store's currency
  consumes the unassigned money into that order before the headline recomputes, and the "Pendiente en
  pedidos abiertos" figure for the store's remaining open orders is unaffected by money that was
  never theirs.
- Registering a payment on an order that is already `COMPLETED` and carries a balance still succeeds
  (the validation ceiling stays the full lifetime debt), even though that payment moves nothing on
  the "Pendiente en pedidos abiertos" headline.
- An order fully written off by a store reconciliation, then months later marked delivered while
  unassigned money sits in that store's currency: the order-close consumption is a no-op for it (its
  `openBalanceMinor` is already `0`), the unassigned money stays available for the store's other open
  orders, and `FRD-08 · WO-08`'s settlement checkbox never renders for the arriving order.

## Notes

- This work order and [`WO-10`](./wo-10-order-open-balance-and-store-account-adjustment-model.md) share the same underlying
  machinery (`StorePayment`, `PaymentAllocation`, the active-order ordering, `unassignedStoreMoneyMinor`).
  **The landing order between the two flipped during this change (`ADR 0034`).** Earlier scoping had
  `WO-10` depend on this work order landing first, back when `openOrderDebtMinor` and the close-time
  consumption computed a gross balance (`totalCost - allocatedAmountMinor`) with nothing to borrow from
  `WO-10`. Once the canonical `openBalanceMinor(order)` (`BR-05-32`) became the single required
  definition for both work orders, this work order's own `openOrderDebtMinor`,
  `unrecordedPaymentsMinor`, and `consumeUnassignedStoreMoneyOnOrderClose` all became consumers of a
  helper `WO-10` owns, so `WO-10`'s `StoreAccountAdjustmentLine` model and `openBalanceMinor` helper
  must exist before this work order's own formulas can be implemented correctly. The canonical
  sequencing declaration lives in `FRD-05 · BP-01`'s own implementation plan, not here; this note only
  records that this document's own earlier claim about the direction of that dependency no longer
  holds.
- `FR-05-33` / `FR-05-34` (payment status and delivery status stay independent by default, now with an
  explicit settlement shortcut on arrival) and the store-debt prose in
  [`FRD-05`](../../frd-05-order-payment-shipment.md) carry their own revision markers for this change
  set; this work order does not restate or duplicate that text, only the runtime contract it drives.
