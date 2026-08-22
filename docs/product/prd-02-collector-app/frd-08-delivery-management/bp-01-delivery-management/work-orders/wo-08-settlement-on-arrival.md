---
id: WO-08
type: WORK_ORDER
slug: settlement-on-arrival
title: Settlement on Arrival
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0015
last_updated: 2026-08-20
implementation_status: IMPLEMENTED
---

# WO-08 Settlement on Arrival

## Summary

Add an "I already paid the rest" checkbox to the arrival flow so marking a delivery `DELIVERED` can, in the
same collector action, also record the store payment that settled it. The product's market axiom is that a
store never releases goods before being paid in full (`BR-08-14`): delivery is evidence of payment, not a hint
of it. The checkbox is pre-marked because that is the normal case, computes the amount server-side whenever it
safely can, and asks the collector only when it genuinely cannot. Recording the arrival and recording the
payment are two separate transactions, not one, because delivery must never block on a payment write
(`ADR 0032`). Implemented 2026-08-20 (uncommitted, staging).

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — lifecycle helpers, `deriveOrderStatus` wrapper
- [`WO-04`](wo-04-delivery-detail-actions.md) — `markDeliveryDelivered` and `reopenDelivery`, extended here with
  the settlement step and its reversal
- [`FRD-05 · BP-01 · WO-03`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-03-order-payments-balances-and-payment-mutation-rules.md)
  — establishes the payment-mutation contract this slice writes through. **Note:** `WO-03`'s own body still
  describes the retired `OrderPayment` / `addPayment` model; the writer this slice actually calls is
  `createStorePayment` in `src/lib/data/orders/storePaymentMutations.ts` (store-level payments, `ADR 0025`),
  verified directly against the current codebase rather than against that document's prose.
- [`FRD-05 · BP-01 · WO-09`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-09-store-payment-assignment-and-open-order-debt.md)
  — sole owner of `getUnassignedStoreMoneyMinor` and `consumeUnassignedStoreMoneyOnOrderClose`; this slice
  consumes both as the canonical helpers rather than deriving either a second time (`FR-08-46`).
- [`FRD-05 · BP-01 · WO-10`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-10-order-open-balance-and-store-account-adjustment-model.md)
  — sole owner of `StoreAccountAdjustmentLine` and the canonical `openBalanceMinor(order)` helper (`ADR 0034`)
  this slice's settlement resolver and its `EXCEEDS_BALANCE` ceiling both consume rather than re-deriving a
  second, gross, adjustment-blind balance.
- **Canonical build order (round-4 arbitration, `FRD-05 · BP-01`'s own implementation plan is the single
  declaration; this bullet only cites it):** `WO-01 → WO-02 → WO-03 → WO-10 → WO-09 → WO-11 → {WO-08, WO-07}`.
  `WO-10` (the model: `StoreAccountAdjustment`, `StoreAccountAdjustmentLine`, `openBalanceMinor`) now lands
  before `WO-09` (the assignment/consumption surface that reads it), and `WO-11` (new: _Store account
  reconciliation action_, the "cuadrar cuenta" write path split out of the former `WO-10`) lands after `WO-09`
  and before this slice. This slice calls nothing `WO-11` defines directly — its own dependency is on `WO-09`'s
  `getUnassignedStoreMoneyMinor` / `consumeUnassignedStoreMoneyOnOrderClose` and `WO-10`'s `openBalanceMinor`
  — but the global order still places `WO-11` ahead of it, so a build that follows work-order numbers in
  numeric order rather than this declared sequence would implement this slice too early. Work-order numbers
  are identifiers, not an execution order.

## In Scope

- The "Ya pagué el resto" checkbox in `QuickArrivalModal`, pre-marked by default, placed directly under
  "¿Cuándo llegó?" and above the cost/shipping-date disclosure, per `FR-08-39`
- Server-side settlement-amount resolution with two branches (`FR-08-40`):
  - **Full-order branch**: the delivery leaves every product of the order delivered. Amount is always
    `openBalanceMinor(order)` (`FRD-05 · BR-05-32`, `ADR 0034`'s canonical order balance, `totalCost` minus its
    `PaymentAllocation`s minus its `StoreAccountAdjustmentLine`s) for that order; no per-item price data is
    required. **An order whose `openBalanceMinor` is already `0`, because a store reconciliation
    (`FRD-05 · WO-10`) wrote off its balance before this delivery, offers nothing to settle: the checkbox
    does not render at all**, rather than rendering pre-marked and offering to write a payment for a debt
    the collector no longer owes. Without this, a written-off order that later arrives would re-offer its
    old, already-forgiven balance as a fresh settlement, entering it as disbursed spend against the current
    budget period, exactly the fabrication `ADR 0034` exists to prevent.
  - **Partial branch**: the delivery leaves the order partially delivered. Amount is only auto-computed when
    **both** hold: every delivered item has a non-null `unitPrice`, **and** the order carries no allocation
    with `orderItemId IS NULL` (undetailed money). When both hold, the computed sum (per delivered item, its
    base minus what is already allocated to it) is **capped at `min(that sum, openBalanceMinor(order))`**
    (round-4 arbitration): the per-item formula sums across product-level `PaymentAllocation`s, which cannot
    see a `StoreAccountAdjustmentLine`, since a line is written per ORDER, never per item. Without the cap, an
    order carrying a reconciliation write-off (e.g. `totalCost` 500, a 300 adjustment line, real balance 200)
    would have its uncapped per-item sum still add up to 300, offering and writing 100 more than the order
    actually owes. **When the cap actually reduces the sum below what the per-item formula computed, the write
    drops the per-item breakdown and is written as one undetailed allocation** (`orderItemId: null`) for the
    capped amount, per `BR-08-15`/`BR-08-16`: scaling the per-item lines down to fit the cap would be a
    proportional estimate over money the app did not compute per item, exactly what `BR-08-16` forbids in
    every branch, with no exception for this one. When either of the two auto-compute conditions fails, the
    amount field starts blank, the collector types it, and the ceiling stays `openBalanceMinor(order)`. The
    app states which condition failed instead of guessing.
- An editable settlement date, defaulted to the delivery's received date (`FR-08-41`)
- Splitting the write into two transactions: **the delivery transaction is whichever one of the two
  order-closing mutations actually ran** (`createDelivery`, born `DELIVERED` when `receivedDate` is set,
  covering all five approved launchers per `ADR 0032` §1; or `markDeliveryDelivered`, covered by `WO-04`, the
  formal flow's "mark delivered" action), both of which already re-derive every affected order's `OrderStatus`
  via `persistDerivedOrderStatuses`, including a flip to `COMPLETED` — it commits first and unconditionally; a
  second, independent **money transaction** is attempted right after, only once that delivery transaction has
  committed (`FR-08-42`, `ADR 0032`). No money is written, consumed, or read for a write decision inside the
  delivery transaction itself. **Round-4 correction:** `wo-08`'s `## Module Structure` and `FR-08-46` had
  named only `markDeliveryDelivered` as the call site, but the five approved launchers (`quickArrivalAction.ts`,
  `storeArrivalAction.ts`) verifiably call `createDelivery`, not `markDeliveryDelivered`
  (`src/lib/data/deliveries/deliveryMutations.ts:83`); as written, the slice would have built the money-write
  path onto a mutation none of its five in-scope launchers ever call. The correct hookup is the **transition**
  every order-closing mutation shares (`persistDerivedOrderStatuses` reporting which orders it just flipped to
  `COMPLETED`), not one specific mutation's name
- **The money transaction's internal order is load-bearing** (`FR-08-46`, `ADR 0033`): for every order the
  delivery transaction just closed to `COMPLETED`, it first calls `FRD-05 · WO-09`'s `consumeUnassignedStoreMoneyOnOrderClose`
  against that order, and only afterward computes and, if applicable, writes this slice's own settlement
  (`FR-08-40`) from the order's now-current `openBalanceMinor` (`ADR 0034`: `totalCost` minus allocations
  minus adjustment lines, re-read after the consumption above has applied). Consuming first is what makes the
  settlement amount correct: skipping or reordering this would let the settlement overstate what the order
  still owes. The consumption half runs **unconditionally** whenever an order closes with unassigned money to
  consume, whether or not the collector left "Ya pagué el resto" checked; unchecking the box only skips the
  settlement half. **This half also runs behind `markDeliveryDelivered`**, i.e. the formal flow's "Marcar como
  llegada" action (`markDeliveredAction` in `deliveryLifecycleActions.ts`), even though that flow does not gain
  the settlement checkbox itself (`FR-08-45` leaves the checkbox there as an open question): the consumption is
  a general order-close invariant (`FR-08-46` says "the moment an order's derived `OrderStatus` becomes
  `COMPLETED`", not "the moment this slice's checkbox flow closes it"), so a collector who marks an order
  delivered through the formal flow must not leave unassigned store money stranded either. This is the one
  place this slice **does** touch `deliveryLifecycleActions.ts`; see `## Out of Scope` for what it still does
  not touch
- A `Retry` affordance when the money transaction fails after the delivery already committed, which
  re-attempts both its consumption and settlement halves from the server's current state rather than
  resubmitting a client-held figure. **Retry carries one precondition: the targeted delivery must still read
  `DELIVERED`.** If the collector reopened the delivery in the window between the failed attempt and the
  retry, the delivery is back to `IN_TRANSIT` and there is no closed order left to settle against; retrying
  anyway would write a settlement `StorePayment` whose `settledByDeliveryId` points at a delivery that is no
  longer `DELIVERED`, an orphan no UI path deletes and one the `onDelete: Restrict` FK then blocks from ever
  being cleaned up by deleting that delivery. The precondition is re-read fresh at the moment `Retry` runs,
  never trusted from the state that rendered the button; when it fails, `Retry` reports the money as no
  longer pending instead of attempting the write
- Writing exactly one `StorePayment` per order this delivery completed or partially completed, never one
  `StorePayment` spanning several orders (`BR-08-17`)
- The new `StorePayment.settledByDeliveryId` column (`onDelete: Restrict`) recording provenance
- Writing computed per-product allocations only when the app itself computed them; a collector-typed or
  collector-corrected amount is written as one undetailed allocation (`orderItemId: null`) instead (`BR-08-15`)
- Marking delivered products covered by a settlement via the existing `declarePaidItemIds` parameter of
  `createStorePayment`
- The unassigned-money guard, revised into **two branches by whether this arrival closes the order**
  (round-4 arbitration): a settlement can only ever apply to an order this same delivery just closed to
  `COMPLETED` (the full-order branch of `FR-08-40`), so whether the guard's warning is load-bearing or purely
  informative depends on that same fact.
  - **The arrival closes the order.** The consumption half of `FR-08-46` runs automatically, unconditionally,
    and _before_ the settlement amount is computed, so any unassigned money in that store and currency is
    already folded into the order's `openBalanceMinor` by the time the settlement branch reads it. There is no
    double-count left to guard against: the checkbox pre-marks exactly as it would with no unassigned money at
    all, and the modal's copy is purely **informative**, naming that some or all of the settlement amount comes
    from money the collector already paid earlier rather than from a fresh payment being written now.
  - **The arrival does not close the order** (a partial delivery, or the last item was already covered by an
    earlier settlement). No consumption runs for an order that stays open, so unassigned money in that store
    and currency is never folded in automatically. The guard stays exactly as it reads today: the checkbox
    opens **unmarked**, and the modal offers to assign that money to the order first instead of the flow
    creating a second, overlapping payment (`FR-08-44`)
- Reversal on reopen: `reopenDelivery` deletes every `StorePayment` whose `settledByDeliveryId` is the
  reopened delivery, recalculates the affected orders' allocation caches, and reports the reverted amount
  (`FR-08-43`). **This reversal is scoped to the settlement half only.** If the money transaction's
  consumption half (`FR-08-46`) also ran when this delivery closed the order, it consumed pre-existing
  unassigned money into that order by writing a `PaymentAllocation` on some _other_, earlier `StorePayment`,
  one that carries no `settledByDeliveryId` pointing at this delivery. Reopen's delete-by-`settledByDeliveryId`
  query cannot see that allocation and must not try to: the money it moved was already paid to the store
  before this delivery ever existed, and it still belongs to this order, which is simply open again and still
  owes the rest. Reverting it would manufacture debt the collector does not have. The confirmation copy states
  both facts when both apply, naming the settlement amount that was reverted and, separately, the amount that
  was already-paid money staying applied to the reopened order, so a consumption the collector cannot see
  reversed is never mistaken for one that silently vanished (see `## UX Notes`)
- The reopen "Deshacer" (Undo) path restoring the exact deleted payment(s) verbatim rather than recomputing a
  new settlement, gated by a required parameter with no default value, so an omission cannot silently skip the
  restore
- Deterministic settlement order inside a batch (store-scoped arrival): `orderDate ASC, humanReadableId ASC`
- Idempotent behavior for an order already settled inside the same batch: it contributes no settlement line
- **The order-close call site for `consumeUnassignedStoreMoneyOnOrderClose`** (`FR-08-46`, `ADR 0033`): the
  **money transaction**, not the delivery transaction, is the call site. `persistDerivedOrderStatuses` /
  `markDeliveryDelivered` still re-derives each affected order's status to `COMPLETED` inside the delivery
  transaction, exactly as `WO-04` already does, but that transaction never calls
  `consumeUnassignedStoreMoneyOnOrderClose` itself. Once the delivery transaction has committed, the mutation
  orchestrating it opens the money transaction and, for every order that transition just closed, invokes
  `FRD-05 · WO-09`'s consumption function before computing that same order's own settlement, so a delivered
  order never leaves debt understated in its own store's unassigned pool (spec §2.3). This runs regardless of
  whether the collector also settled a balance through this slice's own checkbox: an order can close with
  nothing left to settle and still have unassigned money elsewhere in the store that needs consuming, and
  unchecking the box only skips the settlement half of that same transaction, never the consumption half. In a
  store-scoped batch, the consumption also follows `orderDate ASC, humanReadableId ASC`, the same order the
  settlement writes already use, so a batch that closes several orders drains one shared pool deterministically,
  consuming then settling one order at a time before moving to the next.
- Applying this checkbox to all five quick-arrival launchers enumerated in the spec: desktop order detail,
  mobile order detail, orders list row action, dashboard arrival row, and the store-scoped batch launcher
  (`FR-08-45`)
- Copy from spec §6 (checkbox label, detail line, reference line, help line, confirmation, reopen-reversion
  line, unassigned-money line), in `es` and `en`, no em dash

## Out of Scope

- The **settlement checkbox itself** on the formal shipment flow: whether it belongs there too is an explicit
  **open decision**, not resolved here (`FR-08-45`, spec §9). **Nothing in this slice touches
  `createDeliveryAction.ts`** (the create wizard's own Server Action): verified against
  `src/app/[locale]/(app)/deliveries/new/_actions/createDeliveryAction.ts`, it never passes `receivedDate` to
  `createDelivery`, so it can never itself flip an order to `COMPLETED` and there is nothing for this slice's
  money transaction to hook onto there. **Round-4 correction:** the wizard's "Marcar como llegada" action
  (`markDeliveredAction` in `deliveryLifecycleActions.ts`, wrapping `markDeliveryDelivered`) is **not** fully
  out of scope any more. It still does not gain the settlement checkbox UI (that remains the open decision
  above), but it now gains the order-close consumption call site of `FR-08-46` (see `## In Scope`), because
  that consumption is a general order-close invariant, not something scoped only to the five checkbox
  launchers. Skipping it there would leave a store's unassigned money stranded every time a collector closes
  an order through the formal flow instead of a quick arrival.
- Retroactive settlement for already-delivered orders: forward-only, no migration (`BR-08-18`)
- Store-level debt scoped to open orders, mandatory product-level allocation on the store payment sheet, and
  the "cuadrar cuenta" reconciliation adjustment: CAMBIOS 2, 3, and 4 of the spec, covered respectively by
  `FRD-05 · WO-09`, `FRD-05 · WO-09`, and `FRD-05 · WO-11` (the reconciliation action, split out of the former
  `WO-10` in the round-4 arbitration; the model it writes through, `StoreAccountAdjustmentLine` and
  `openBalanceMinor`, is `FRD-05 · WO-10`). This slice reuses `createStorePayment` exactly as it exists today;
  it does not change its validation surface. There are two exceptions, both calls into an already-defined
  helper at its owner's contract rather than a redefinition of CAMBIOS 2, 3, or 4 themselves: the call site of
  `FR-08-46`, invoking `WO-09`'s `consumeUnassignedStoreMoneyOnOrderClose` from this slice's own money
  transaction once the order-close mutation's delivery transaction has committed; and the settlement resolver
  and `EXCEEDS_BALANCE` ceiling reading `WO-10`'s `openBalanceMinor(order)` (`ADR 0034`) instead of the older,
  adjustment-blind `totalCost - allocatedAmountMinor`.
- Building a dedicated "assign this unassigned money" mini-flow inside `QuickArrivalModal`. The guard in this
  slice only decides the checkbox's default state and points the collector at the existing store payment
  surface; it does not add a new assignment UI.
- Delivery cost tracking or its effect on store debt (spec §8, decided against)
- Proportional/estimated splitting of any kind (`BR-08-16`, `ADR 0025`)

## Requirements

- `FR-08-39`, `FR-08-40`, `FR-08-41`, `FR-08-42`, `FR-08-43`, `FR-08-44`, `FR-08-45`, `FR-08-46`
- `BR-08-14`, `BR-08-15`, `BR-08-16`, `BR-08-17`, `BR-08-18`
- `FR-05-17` (the store-payment write this slice reuses: a payment pre-assigned to one order), `FR-05-50`
  (product payment-state precedence; the partial branch's `declarePaidItemIds` call feeds its case 2, "it
  carries the mark"), `FR-05-62` (the order-close consumption rule this slice's call site fulfills), `FR-05-64`
  (the "cuadrar cuenta" reconciliation adjustment this slice's `openBalanceMinor(order) === 0` no-checkbox
  signal and `EXCEEDS_BALANCE` ceiling both react to, once an order has been through it; owned by
  `FRD-05 · WO-11`)
- `BR-05-28` (`min(order's remaining balance, unassigned store money)`, oldest order first in a batch: the
  function `FRD-05 · WO-09` owns and this slice calls at close time), `BR-05-32` (the canonical
  `openBalanceMinor(order)` definition this slice's settlement amount, `EXCEEDS_BALANCE` ceiling, and
  no-checkbox signal all read rather than deriving their own gross balance; owned by `FRD-05 · WO-10`)

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — lifecycle contract, the two-transaction settlement decision, and
  the `settledByDeliveryId` provenance field

## Validation Contract

| Rule                                                                                                                                                                                                                       | Error code                                                                        | Enforcement point                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual or corrected amount must not exceed `openBalanceMinor(order)` (`ADR 0034`)                                                                                                                                          | `EXCEEDS_BALANCE`                                                                 | Inside `createStorePayment`'s transaction, reused unmodified (`ADR 0022`: decided before its first write)                                                                                         |
| Declared allocations must not sum past the payment amount                                                                                                                                                                  | `ALLOCATION_SUM_EXCEEDS_PAYMENT`                                                  | Inside `createStorePayment`'s transaction, reused unmodified (`ADR 0022`)                                                                                                                         |
| A per-product allocation must not exceed that product's own price base, when the base is known                                                                                                                             | `EXCEEDS_ITEM_BASE`                                                               | Inside `createStorePayment`'s transaction, reused unmodified (`ADR 0022`)                                                                                                                         |
| The written amount must not push the store's full debt (including delivered orders) past its ceiling                                                                                                                       | `STORE_DEBT_EXCEEDED`                                                             | Inside `createStorePayment`'s transaction, reused unmodified (`ADR 0022`); expected to be inert here since a settlement amount is bounded by that same order's own remaining balance              |
| Settlement date must be `>= order.orderDate`                                                                                                                                                                               | `DATE_BEFORE_ORDER`                                                               | Inside `createStorePayment`'s transaction, reused unmodified (`ADR 0022`)                                                                                                                         |
| A cancelled order refuses a settlement write                                                                                                                                                                               | `ORDER_CANCELLED`                                                                 | Inside `createStorePayment`'s transaction, reused unmodified (`ADR 0022`); belt-and-suspenders, since the delivery transaction already refuses a cancelled order's products before this step runs |
| Partial-branch auto-calc requires every delivered item priced **and** no undetailed allocation on the order                                                                                                                | none (UX fallback, not a refusal)                                                 | Settlement-plan resolver, before the amount field renders; falls back to a blank, collector-entered amount instead of blocking the flow                                                           |
| Partial-branch auto-computed sum is capped at `min(computed sum, openBalanceMinor(order))` (round-4 arbitration): the per-item formula cannot see a `StoreAccountAdjustmentLine`, which is written per order, not per item | none (defensive cap, applied before the amount ever reaches `createStorePayment`) | Settlement-plan resolver, before the computed amount is returned; `EXCEEDS_BALANCE` inside `createStorePayment` remains the belt-and-suspenders check behind it                                   |
| When the cap above actually reduces the computed sum, the write drops the per-item breakdown and becomes one undetailed allocation (`BR-08-15`/`BR-08-16`: no proportional scaling of the per-item lines to fit the cap)   | none (write-shape rule, not a refusal)                                            | Settlement-plan resolver, deciding the allocation shape before `createStorePayment` is called                                                                                                     |
| The settlement amount is never accepted from the client; every attempt (including `Retry`) recomputes it server-side                                                                                                       | none (structural)                                                                 | Settlement Server Action, on every invocation                                                                                                                                                     |
| The delivery transaction and the money transaction are independent; the delivery commit never waits on or rolls back for the money transaction's outcome                                                                   | none (structural)                                                                 | Two separate `prisma.$transaction` / `runSerializableTransaction` calls in sequence inside the Server Action, never nested (`ADR 0032`)                                                           |
| Inside the money transaction, `consumeUnassignedStoreMoneyOnOrderClose` for a closing order is always attempted before that order's own settlement is computed or written                                                  | none (structural)                                                                 | Money-transaction entry point (`storePaymentMutations.ts`), fixed call order (`FR-08-46`); no path computes the settlement first                                                                  |
| The consumption half of the money transaction runs whenever an order closes with unassigned money to consume, independent of the checkbox state                                                                            | none (structural)                                                                 | Money-transaction entry point; unchecking "Ya pagué el resto" only omits the settlement half of the same transaction                                                                              |
| A `Delivery` cannot be physically removed while a `StorePayment.settledByDeliveryId` still points at it                                                                                                                    | Prisma FK violation (`P2003`)                                                     | Schema (`onDelete: Restrict`); reachable only if `reopenDelivery`'s payment-cleanup step were skipped, which it must never do                                                                     |
| Reopen's "Deshacer" restores the exact reverted payment snapshot; it takes no default for whether to restore                                                                                                               | none (typed contract; missing argument is a compile error, not a runtime default) | Undo handler passed to the reopen toast, called with an explicit, required restoration payload                                                                                                    |
| The checkbox does not render when `openBalanceMinor(order)` is already `0`                                                                                                                                                 | none (UX fallback, not a refusal)                                                 | Settlement-plan resolver / `QuickArrivalModal`, before the checkbox renders                                                                                                                       |
| `Retry` only re-attempts the money transaction while the targeted delivery still reads `DELIVERED`                                                                                                                         | none (structural; a stale `Retry` is a no-op, not a refusal surfaced to the user) | Settlement Server Action, re-reading the delivery's current status before opening the money transaction, on every `Retry` invocation                                                              |

The `EXCEEDS_BALANCE`, `ALLOCATION_SUM_EXCEEDS_PAYMENT`, `EXCEEDS_ITEM_BASE`, `STORE_DEBT_EXCEEDED`,
`DATE_BEFORE_ORDER`, and `ORDER_CANCELLED` refusals must all still be decided before `createStorePayment`'s
first write, per `ADR 0022`. This slice does not reimplement them: it calls the existing writer, which already
satisfies that contract, and must not add any check of its own after that call that could leave a write
half-committed. `ADR 0022` applies **within** each of the two transactions separately, not across both: the
delivery transaction's own refusals are decided before its own writes (unchanged from `WO-04`), and the
money transaction's own refusals, for both its consumption half and its settlement half, are decided before
its own writes. The two transactions are not atomic with each other by design (`FR-08-42`); that gap is
exactly what the `Retry` affordance exists to cover.

`runOrderCloseMoneyTransaction` reports a refused settlement (status `"refused"`) AFTER its consumption half
has already written, and this is deliberate rather than a violation of the rule above: `FR-08-46` orders the
consumption before the settlement inside the same per-order transaction, and a settlement refusal is
returned, not thrown, so per `ADR 0022` that `return` commits the transaction with the consumption's write
intact. The refusal is surfaced per order with `consumedMinor` reported alongside it, never silently, so the
caller can tell the two halves apart instead of assuming the whole order's money transaction rolled back.

## Technical Notes

- The settlement-plan resolver is a new function, not a UI-side calculation: it reads `order.totalCost`,
  `order.allocatedAmountMinor`, the order's `StoreAccountAdjustmentLine` total (together, `ADR 0034`'s
  `openBalanceMinor`), the delivered items' `unitPrice`, and whether the order has any `orderItemId IS NULL`
  allocation, and returns either a computed amount plus the per-item lines it can attribute, a signal that the
  amount must be collector-entered together with which condition failed, or, when `openBalanceMinor(order)` is
  already `0`, a signal that there is nothing to settle at all, which is what tells `QuickArrivalModal` to
  render no checkbox for this order.
- **Whichever order-closing mutation actually ran** (`createDelivery` with `receivedDate` set, for the five
  approved launchers; or `markDeliveryDelivered`, for the formal flow's "mark delivered" action) must expose,
  on success, exactly what the money transaction needs: the affected order ids, which of them
  `persistDerivedOrderStatuses` just re-derived to `COMPLETED` (the consumption's own trigger set, `FR-08-46`),
  and for each, its current `totalCost`, `allocatedAmountMinor`, and adjustment-line total as of that same
  transaction's commit. This is new surface area on both mutations, not only on `markDeliveryDelivered`
  (round-4 correction: `createDelivery` is the mutation the five in-scope launchers actually call, verified
  against `quickArrivalAction.ts` and `storeArrivalAction.ts`). The money transaction re-reads fresh state
  itself before writing anything (it does not trust the delivery transaction's snapshot), because time can
  pass between the two, especially on `Retry`.
- `editDelivery` is **not** a producer of this trigger set and needs no equivalent snapshot, verified against
  its own guard (`src/lib/data/deliveries/deliveryMutations.ts`, `if (delivery.status !== IN_TRANSIT) return
{ error: "INVALID_STATUS" }`) and against `getNextItemDeliveryState` (`edit-add` moves an item to
  `IN_TRANSIT`, `edit-remove` to `ARRIVED_AT_STORE`; neither ever writes `DELIVERED`). `FR-08-24` /
  `BR-08-07` already require a `DELIVERED` delivery to be reopened before it can be edited, so `editDelivery`
  can only ever touch orders that are not yet `COMPLETED` and can never itself flip one to `COMPLETED`, nor,
  by the same argument, ever touch an already-`COMPLETED` order's items at all (every item of a `COMPLETED`
  order already reads `DELIVERED`, which is outside `editDelivery`'s eligible-state set in both directions).
  It therefore cannot close an order and cannot reopen one either; both closing and reopening stay exclusively
  the province of `createDelivery` / `markDeliveryDelivered` (closing) and `reopenDelivery` (reopening).
- **`Retry`'s precondition (hardens `FR-08-42`'s Retry contract, spec §10 risk 4).** Before opening the money transaction, `Retry`
  re-reads the targeted delivery's current status and proceeds only when it still reads `DELIVERED`. A
  reopen that happened in the gap between the original failure and the retry attempt returns the delivery to
  `IN_TRANSIT`, at which point there is no closed order left for a settlement to attach to: writing one anyway
  would create a `StorePayment.settledByDeliveryId` pointing at a delivery no longer `DELIVERED`, which nothing
  in the product ever deletes and which the `onDelete: Restrict` FK then refuses to let that delivery's own
  deletion clean up either. When the precondition fails, `Retry` clears the pending-money affordance from the
  UI instead of attempting the write; the collector already reopened the delivery, which is itself the signal
  that the original settlement no longer applies.
- The unassigned-money guard reads whatever unassigned money currently exists for `(storeId, currencyCode)` at
  the moment the modal opens, via `getUnassignedStoreMoneyMinor`, the single canonical helper
  `FRD-05 · WO-09` owns. This slice consumes that helper directly rather than deriving a second read of the
  same figure, so the guard and the close-time consumption of `FR-08-46` can never disagree about what
  "unassigned" means for a given store and currency. Because the consumption always runs first when this
  arrival closes the order (see `## In Scope`), the guard's warning is informative, not load-bearing, on the
  branch where the arrival closes the order, and stays load-bearing on the branch where it does not.
- The order-close call site of `FR-08-46` invokes `FRD-05 · WO-09`'s `consumeUnassignedStoreMoneyOnOrderClose`
  unconditionally, but **not** inside the delivery transaction that re-derives the order's status
  (`persistDerivedOrderStatuses`, called by both `createDelivery` and `markDeliveryDelivered`), and **not** in
  the same transaction that runs it. It is called from inside the money transaction (`ADR 0032`), attempted
  only once the delivery transaction has committed, and it runs before that same transaction computes this
  slice's own settlement amount for the order in question: consuming first is what keeps the settlement amount
  from overstating what the order still owes. Folding this call into the delivery transaction would put a
  money write behind the same commit as the fulfillment change it is supposed to never gate on, which is
  exactly what `FR-05-33` and `ADR 0032` forbid. This slice owns the call site, on both order-closing
  mutations; it does not own, redefine, or duplicate the function's contract, its `min(remaining, unassigned)`
  arithmetic, or its `(storeId, currencyCode)` scope, all of which stay `WO-09`'s.
- `reopenDelivery` must, in the same transaction that already deletes and recalculates, capture a full snapshot
  of every deleted `StorePayment` (its fields and its `PaymentAllocation` rows) and return it to the caller.
  The "Deshacer" toast action holds that snapshot and, if invoked, restores it row-for-row: same amount, same
  date, same allocations, same `settledByDeliveryId`. It must not call the settlement resolver again, because
  the order's balance may have changed since the reopen (for example, another payment landed in the meantime),
  and recomputing at that point could invent or lose money relative to what was actually reverted.
- **Reopen does not, and must not, revert `FR-08-46`'s consumption.** The consumption half of the money
  transaction writes its `PaymentAllocation` onto some earlier `StorePayment` that already existed in the
  store's own history, one that carries no `settledByDeliveryId` at all, let alone this delivery's. That money
  was paid to the store before this delivery ever existed and it belongs to the order it was consumed into,
  independent of that order's current lifecycle state; reopening the order does not undo the fact that the
  money was already sitting in the store's account and was already, correctly, applied against this order's
  balance. Deleting or reversing it on reopen would manufacture debt on an order that never lost that payment,
  the same silent-understatement failure `ADR 0033 §4` exists to close, just triggered from the other
  direction. The delete-by-`settledByDeliveryId` query `reopenDelivery` already runs is therefore correct as
  written: it structurally cannot reach the consumption's allocation, and it must never be widened to try.
- The store-scoped batch launcher (`StoreGroupedView.tsx`) settles one order at a time in
  `orderDate ASC, humanReadableId ASC` order, matching the tie-break already required for the 38 pairs sharing
  an `orderDate` in the collector's own data (spec §1.7). Each order gets its own `StorePayment`; an order
  already fully settled earlier in the same batch is skipped and contributes no line.
- The mark applied via `declarePaidItemIds` (`ADR 0026`, invariant I1) never substitutes for the money write;
  it is applied to the same set of delivered, covered products the computed allocations name, and it moves no
  figure on its own.

## UX Notes

- Checkbox copy, detail line, reference line, help line, confirmation toast, reopen-reversion line, and the
  unassigned-money line all come from spec §6, `es` and `en`, with no em dash anywhere in the rendered text.
- The reference amount shown when the amount cannot be auto-computed ("Del pedido entero faltan {amount}") is
  always labelled as a reference, never pre-filled into the input as if it were the answer.
- Unchecking the box only changes what gets written; it never changes the received-date flow already covered
  by `WO-04`.
- The confirmation toast states both facts in one sentence when a settlement was written ("Llegada anotada y
  {amount} registrados como pago"), and states only the arrival when the box was unchecked or a `Retry` is
  still pending.
- A settlement write that fails after the delivery already committed must be visible on the delivery detail
  view without the collector needing to navigate away and back: the `DELIVERED` state is already correct and
  persists across navigation, and a `Retry` control for the pending settlement must not be lost on a route
  change (spec §10 risk 4).
- **Reopen-reversion copy names both amounts when both apply (`FR-08-43`, extends spec §6's "Al reabrir" row).**
  Spec §6 gives one sentence, "Entrega reabierta y {monto} devueltos al saldo pendiente" / "Delivery reopened,
  and {amount} went back to the outstanding balance", which describes only the settlement half being deleted.
  That sentence alone is enough whenever no consumption happened on close. Whenever this order's close-time
  consumption (`FR-08-46`) also ran, and therefore survives the reopen (see the Technical Notes entry above),
  the toast must additionally name that surviving amount, so the collector is never told less than the whole
  truth about their own money: "Entrega reabierta. {monto} de la liquidación volvieron al saldo pendiente.
  {monto} pagados antes siguen aplicados a este pedido." / "Delivery reopened. {amount} from the settlement
  went back to the outstanding balance. {amount} paid earlier stays applied to this order." When only
  consumption happened and no settlement was ever written (checkbox left unchecked on close), the toast drops
  the first sentence and states only the second. This copy is new, not lifted verbatim from spec §6, because
  the spec's own single-amount sentence predates `ADR 0033`'s close-time consumption and does not yet
  distinguish the two amounts; it needs the same `es`/`en`, no-em-dash treatment as the rest of this table
  before it ships.
- **Gap closed (implementation, 2026-08-21).** The reopen toast now names both amounts when both apply.
  `PaymentAllocation.consumedByDeliveryId` gives `consumeUnassignedStoreMoneyOnOrderClose`'s write a
  provenance link back to the closing delivery, so `reopenDelivery` can read `SUM(amountMinor) WHERE
consumedByDeliveryId = deliveryId` as the surviving figure without deleting or modifying those rows.

## Security Notes

- `userId` scoping for both the delivery write and the settlement write comes exclusively from the
  authenticated session, inherited unchanged from `WO-04` and `FRD-05 · WO-03`.
- The settlement amount, the computed per-item lines, and the date are never accepted verbatim from the
  client on a `Retry`; the server recomputes from its own read of current state on every attempt.
- The settlement-plan resolver reads only orders and items already scoped to `{ userId, orderId }` by the
  delivery mutation it runs after; it does not introduce a new unscoped read path.

## Assumptions

- `FRD-08`'s own file gains `FR-08-39` through `FR-08-46` and `BR-08-14` through `BR-08-18` in a parallel
  change to this one; this document cites them by id and does not restate their text.
- `StorePayment`, `PaymentAllocation`, and `createStorePayment` already exist in the codebase
  (`src/lib/data/orders/storePaymentMutations.ts`, `prisma/schema.prisma`) as store-level payments per
  `ADR 0025`, independently of the fact that `FRD-05 · WO-03`'s own document body still describes the retired
  `OrderPayment` model. This slice was scoped against the actual code, not against that stale document.
- The CAMBIO 2/3/4 requirements reserved for `FRD-05 · WO-09`, `FRD-05 · WO-10`, and `FRD-05 · WO-11`
  (open-order debt scope, mandatory store-payment assignment, the `openBalanceMinor` model, and the "cuadrar
  cuenta" reconciliation action) are out of scope here. This slice's guard (`FR-08-44`) only reads whatever
  unassigned money already exists under today's rules, via `WO-09`'s own `getUnassignedStoreMoneyMinor`. This
  slice does call `WO-09`'s `consumeUnassignedStoreMoneyOnOrderClose`, from the money transaction rather than
  from the delivery/order-close transaction itself (`FR-08-46`), but it does so at that function's existing
  contract; it does not redefine what unassigned money is, how it is computed, or how the consumption
  arithmetic works, all of which stay owned by `WO-09`.
- **The order-closing producer is whichever of `createDelivery` (with `receivedDate`) or `markDeliveryDelivered`
  actually ran, never `editDelivery`.** Verified against the codebase (round-4 arbitration): `editDelivery`
  refuses any delivery whose status is not `IN_TRANSIT` (`INVALID_STATUS`, matching `FR-08-24` / `BR-08-07`,
  which already require reopening a `DELIVERED` delivery before it can be edited), and its own transitions
  (`getNextItemDeliveryState("edit-add" | "edit-remove")`) only ever move an item to `IN_TRANSIT` or
  `ARRIVED_AT_STORE`, never to `DELIVERED`. It therefore cannot flip an order to `COMPLETED` and cannot touch
  an already-`COMPLETED` order's items either, so it needs no money-transaction hookup and is not one of this
  slice's producers.
- The open question in spec §9 (whether this checkbox also belongs in the formal shipment flow) stays
  undecided. `FR-08-45` records it as open rather than assuming either answer.

## Module Structure

| Path                                                                          | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/data/deliveries/deliveryMutations.ts`                                | **Round-4 correction: two producers, not one.** `createDelivery`, when called with `receivedDate` set (the five approved launchers, `quickArrivalAction.ts` / `storeArrivalAction.ts`), and `markDeliveryDelivered` (the formal flow's `markDeliveredAction`) both write their own delivery transaction only: each calls `persistDerivedOrderStatuses`, which re-derives every affected order's `OrderStatus` (including a flip to `COMPLETED`) and touches no money, and each must return the per-order `totalCost` / `allocatedAmountMinor` / adjustment-line-total snapshot plus which orders just closed, both consumed by the money transaction below; `reopenDelivery` deletes `StorePayment` rows by `settledByDeliveryId`, recalculates affected orders, and returns a full snapshot of what it deleted, re-reading the delivery's own status so `Retry`'s precondition has something fresh to check. `editDelivery` is untouched: it cannot produce a `COMPLETED` transition (see `## Assumptions`) |
| `src/lib/data/orders/storePaymentMutations.ts`                                | New settlement-plan resolver (branch A/B, the two partial-branch conditions each capped at `openBalanceMinor(order)`, and the `openBalanceMinor(order) === 0` no-checkbox signal) and a **money-transaction entry point** that, for every order the delivery transaction just closed, first calls `FRD-05 · WO-09`'s `consumeUnassignedStoreMoneyOnOrderClose` unconditionally (`FR-08-46`), then computes the settlement from that order's now-current `openBalanceMinor` (`ADR 0034`) and, if applicable, calls `createStorePayment` once per order with `settledByDeliveryId` and `declarePaidItemIds` set                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/app/[locale]/(app)/_actions/quickArrivalAction.ts`                       | Accepts the checkbox state, editable date, and optional manual amount; sequences the delivery transaction (`createDelivery`) then, once it has committed, the money transaction (consumption then settlement); surfaces a retryable outcome when only the second fails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/app/[locale]/(app)/_actions/storeArrivalAction.ts`                       | Same sequencing, on `createDelivery`, applied per affected order across the batch selection, in `orderDate ASC, humanReadableId ASC` order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/app/[locale]/(app)/deliveries/[id]/_actions/deliveryLifecycleActions.ts` | **New surface area for this slice (round-4 correction).** `markDeliveredAction` sequences the same two-transaction shape as the checkbox launchers: its `markDeliveryDelivered` call is the delivery transaction, and once it commits, this action opens the money transaction and runs the consumption half (`FR-08-46`) unconditionally for every order it just closed. It does **not** gain the settlement checkbox, the settlement half, or any new UI: `FR-08-45` leaves that decision open. **Open implementation question, not resolved here:** a consumption-only money transaction can still fail after the delivery already committed (the same gap `FR-08-42`'s `Retry` covers for the checkbox launchers), and this action currently has no equivalent recovery affordance on the delivery detail view; whether it needs its own `Retry` surface or can share the one this slice adds to `QuickArrivalModal`/detail is left to implementation                                                    |
| `src/components/modules/QuickArrival/QuickArrivalModal.tsx`                   | Adds the pre-marked checkbox under "¿Cuándo llegó?", the editable settlement date, the computed-or-manual amount field, the reference/help copy, and the unassigned-money notice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/lib/deliveries/deliveryValidation.ts`                                    | Extends `deliveryQuickArrivalSchema` / `deliveryStoreArrivalSchema` with the checkbox state, optional manual amount, and settlement date fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `prisma/schema.prisma` + a new migration                                      | Adds `StorePayment.settledByDeliveryId String?` with `onDelete: Restrict` FK to `Delivery`, plus a supporting index                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Unit Tests

### Settlement-plan resolver

| Scenario                                                                                                                                                                                                                                                                | Expected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full-order branch, order not yet fully allocated                                                                                                                                                                                                                        | `amount = openBalanceMinor(order)`, computed, no per-item lines required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Full-order branch, order already fully allocated (no adjustment line involved)                                                                                                                                                                                          | `amount = 0`; no `StorePayment` is written; the arrival still records normally; checkbox does not render (`openBalanceMinor` is `0`)                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Full-order branch, order's balance was fully written off in an earlier store reconciliation (`StoreAccountAdjustmentLine` covers the whole remaining `totalCost - allocatedAmountMinor`)                                                                                | `openBalanceMinor(order) = 0`; the checkbox does not render at all; the arrival records normally with no `StorePayment` written                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Full-order branch, order's balance was partially written off (adjustment line smaller than the remaining balance)                                                                                                                                                       | `amount = openBalanceMinor(order)`, the post-write-off remainder, not the pre-write-off `totalCost - allocatedAmountMinor`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Partial branch, both conditions hold, multi-product order                                                                                                                                                                                                               | `amount` = sum over delivered items of `(unitPrice * quantity) - already allocated to that item`, with per-item lines returned                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Partial branch, both conditions hold, single-product order                                                                                                                                                                                                              | Base uses `totalCost` for that one product rather than `unitPrice * quantity`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Partial branch, a delivered item has a null `unitPrice`                                                                                                                                                                                                                 | Resolver returns "not computable", reason names the missing price condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Partial branch, all delivered items priced but the order has an `orderItemId IS NULL` allocation                                                                                                                                                                        | Resolver returns "not computable", reason names the undetailed-money condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Not computable                                                                                                                                                                                                                                                          | Reference amount (`openBalanceMinor(order)`) is still returned as reference-only, never as the write value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Partial branch, both conditions hold, order also carries a `StoreAccountAdjustmentLine` whose per-item sum would otherwise exceed the order's real remaining balance (e.g. `totalCost` 500, adjustment line 300, three delivered items of base 100 each summing to 300) | `amount = min(300, openBalanceMinor(order))` = `200`, not the uncapped per-item sum of `300`; **the cap forces an undetailed write** (`orderItemId: null` for the full `200`, not the per-item lines the uncapped sum would have returned), because scaling the per-item lines down proportionally to fit the cap would be exactly the estimation `BR-08-16` forbids in every branch, and the app can no longer honestly say which item's 100 shrank and by how much once an order-level line, invisible to the per-item formula, is what forced the cap (round-4 arbitration, `FR-08-40`) |

### Write path

| Scenario                                              | Expected                                                                                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Computed amount (either branch), submitted unedited   | `StorePayment` written with per-item `PaymentAllocation` rows matching the computed lines                                                    |
| Collector types or edits the proposed amount          | `StorePayment` written with one `orderItemId: null` allocation for the full amount, never the computed per-item split                        |
| Manual amount greater than `openBalanceMinor(order)`  | Rejected `EXCEEDS_BALANCE`, nothing written                                                                                                  |
| Settlement date left as the delivery's received date  | `StorePayment.paymentDate` equals it exactly                                                                                                 |
| Settlement date edited earlier than `order.orderDate` | Rejected `DATE_BEFORE_ORDER`, nothing written                                                                                                |
| Delivered products covered by the settlement          | `declarePaidItemIds` includes exactly those product ids                                                                                      |
| Store-scoped batch settling two orders                | Exactly two `StorePayment` rows written, each `settledByDeliveryId` pointing at the one delivery, each with only its own order's allocations |
| `settledByDeliveryId` on the written row              | Equals the delivery id that triggered the write                                                                                              |

### Double-counting guard (spec §10 risk 1, dedicated coverage required)

| Scenario                                                                                                                                          | Expected                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store already holds unassigned money in the settlement currency when the modal opens                                                              | Checkbox default state is unmarked; the unassigned-money notice is shown                                                                                                                                                                                                                                  |
| Store holds no unassigned money in that currency                                                                                                  | Checkbox default state is marked                                                                                                                                                                                                                                                                          |
| Collector proceeds with the box marked despite unassigned money existing (does not assign it first)                                               | Settlement re-reads the order's CURRENT `openBalanceMinor` at write time; it does not add a second amount on top of money that was never actually attributed to this order                                                                                                                                |
| Collector assigns the pre-existing unassigned money to this order first, then marks the delivery arrived                                          | The settlement amount computed afterward reflects the now-lower `openBalanceMinor`, so no double credit results                                                                                                                                                                                           |
| Store already holds unassigned money in the settlement currency AND this arrival closes the order (round-4 arbitration)                           | Consumption runs first and folds the unassigned money into the order before the settlement amount is read; the checkbox pre-marks exactly as if no unassigned money existed, and the guard's copy is informative only ("part of this settlement is money you already paid"), never disabling the checkbox |
| Store already holds unassigned money in the settlement currency AND this arrival does NOT close the order (partial delivery, round-4 arbitration) | No consumption runs (nothing closed); the checkbox opens unmarked and the guard behaves exactly as it does today, unchanged                                                                                                                                                                               |

### Two-transaction sequencing and retry

| Scenario                                                                                                        | Expected                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivery transaction succeeds, money transaction fails                                                          | Delivery persists as `DELIVERED`; caller receives a retryable money-transaction failure, not a rolled-back delivery                                                                                                                                                                                   |
| `Retry` invoked after a failed money transaction                                                                | Both halves (consumption then settlement) are recomputed from current server state, never replayed from the original client payload                                                                                                                                                                   |
| Money transaction fails after consuming but before writing the settlement                                       | `Retry` re-attempts the whole money transaction; the consumption half is idempotent against an order with nothing left to consume, so re-running it cannot double-consume                                                                                                                             |
| Delivery transaction itself fails                                                                               | No money-transaction attempt is made at all: neither consumption nor settlement                                                                                                                                                                                                                       |
| An order closes but the collector left "Ya pagué el resto" unchecked                                            | The money transaction still runs for that order; it consumes any unassigned money but writes no settlement `StorePayment`                                                                                                                                                                             |
| Money transaction fails, the collector reopens the delivery, then `Retry` is invoked on the stale pending state | `Retry` re-reads the delivery's status, finds it is no longer `DELIVERED`, and refuses the write; no `StorePayment` is created and no `settledByDeliveryId` ever points at the now-reopened delivery                                                                                                  |
| Money transaction fails, `Retry` is invoked while the delivery is still `DELIVERED` (no reopen in between)      | The precondition passes; the money transaction proceeds exactly as before this change                                                                                                                                                                                                                 |
| A quick-arrival or store-scoped-batch launcher closes an order (round-4 arbitration)                            | The delivery transaction is `createDelivery` called with `receivedDate` set; the money transaction hooks onto its closed-order set, not onto `markDeliveryDelivered`'s                                                                                                                                |
| The formal "Marcar como llegada" action closes an order (round-4 arbitration)                                   | The delivery transaction is `markDeliveryDelivered`; the money transaction still runs its consumption half (`FR-08-46`), even though this launcher renders no settlement checkbox                                                                                                                     |
| `editDelivery` is called against an `IN_TRANSIT` delivery, adding or removing products (round-4 arbitration)    | No money transaction is attempted: `editDelivery` never writes `DELIVERED` on any item (`getNextItemDeliveryState("edit-add"\|"edit-remove")` only ever produces `IN_TRANSIT` or `ARRIVED_AT_STORE`), so it can never be part of an order's closing trigger set, structurally, not by a runtime check |

### Reopen and its reversal

| Scenario                                                                                                                                                                      | Expected                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reopening a delivery with a settlement payment attached                                                                                                                       | The `StorePayment` (and its allocations) whose `settledByDeliveryId` matches is deleted; unrelated `StorePayment` rows for the same store are untouched                                                                    |
| Reopen return value                                                                                                                                                           | Reports the reverted amount and returns a full snapshot of the deleted row(s)                                                                                                                                              |
| "Deshacer" invoked on that reopen                                                                                                                                             | Restores the exact deleted `StorePayment` row(s) verbatim (same amount, date, allocations); does not call the settlement resolver again                                                                                    |
| Reopen followed by re-marking the same delivery as delivered again                                                                                                            | Settlement recomputes from the now-lower `openBalanceMinor`; no double charge results                                                                                                                                      |
| Marking a product delivered twice                                                                                                                                             | Structurally impossible: a product belongs to at most one active delivery (`BR-08-08`), so this path cannot be exercised twice for the same product without a reopen in between                                            |
| Reopening a delivery whose close-time consumption (`FR-08-46`) applied unassigned money to the order, with no settlement `StorePayment` ever written (checkbox was unchecked) | No `StorePayment` is deleted (none carries this delivery's `settledByDeliveryId`); the order's `allocatedAmountMinor` is unchanged by the reopen; the reopen toast names the surviving consumed amount, not a reverted one |
| Reopening a delivery that both consumed pre-existing unassigned money AND wrote its own settlement on close                                                                   | Reopen deletes only the settlement `StorePayment`; the consumption's `PaymentAllocation` on the earlier, unrelated `StorePayment` is untouched; the reopen toast names both amounts separately                             |

### Batch determinism and idempotence

| Scenario                                                                         | Expected                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Store-scoped batch with two orders sharing the same `orderDate`                  | Settlement order breaks the tie by `humanReadableId ASC` |
| Store-scoped batch including an order already fully settled before the batch ran | That order contributes no settlement line                |

### Order-close consumption call site (`FR-08-46`, spec §2.3)

| Scenario                                                                                                                                                                                                    | Expected                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store with orders A (50) and B (50), one unassigned payment of 30, no allocations                                                                                                                           | Marking A's delivery delivered commits the delivery transaction, closing A; the money transaction that follows calls `consumeUnassignedStoreMoneyOnOrderClose` before anything else: A's remaining balance becomes 20, the pool becomes 0                                                                         |
| Same setup, closing order B instead of A                                                                                                                                                                    | Same call site fires for B in its own money transaction; whichever order closes first drains the shared pool                                                                                                                                                                                                      |
| An order closes with no unassigned money sitting in its store/currency                                                                                                                                      | The call is still attempted and is a no-op: no `PaymentAllocation` is written                                                                                                                                                                                                                                     |
| An order closes via the full-order settlement branch (checkbox checked) AND the store also holds unassigned money in the same currency                                                                      | Consumption runs first inside the money transaction and raises the order's `allocatedAmountMinor`; the settlement amount computed immediately afterward is `openBalanceMinor(order)` at that post-consumption value, so the two writes never double-count the same money                                          |
| An order with a pre-existing `StoreAccountAdjustmentLine` closes via the full-order branch, and the store also holds unassigned money in the same currency                                                  | Consumption still runs first and raises `allocatedAmountMinor`; the settlement amount computed afterward is `totalCost - allocatedAmountMinor - adjustmentLineTotal`, never a figure that ignores the write-off                                                                                                   |
| An order closes with the checkbox left unchecked, and the store holds unassigned money in the same currency                                                                                                 | The money transaction still runs and still consumes the unassigned money into the order; only the settlement write is skipped                                                                                                                                                                                     |
| Store-scoped batch closing two orders in the same delivery                                                                                                                                                  | Consumption for both orders follows `orderDate ASC, humanReadableId ASC`, matching the settlement write order: each order is consumed, then settled, before the next order in the batch starts                                                                                                                    |
| An order closes through the formal "Marcar como llegada" action (`markDeliveryDelivered`, no settlement checkbox rendered), and the store holds unassigned money in the same currency (round-4 arbitration) | The money transaction still runs and still calls `consumeUnassignedStoreMoneyOnOrderClose` for the closing order; the order's `allocatedAmountMinor` rises exactly as it would through a quick-arrival launcher, confirming the consumption call site is not gated by which of the two producers closed the order |

## E2E Acceptance Tests

- Opening "Ya me llegó" for an order whose delivery would complete it shows the settlement checkbox pre-marked,
  under "¿Cuándo llegó?"; submitting records both the arrival and a payment for the full remaining balance, and
  the confirmation states both.
- Unchecking the box before submit records only the arrival; no payment appears in the store's payment
  history.
- A partial delivery on a multi-product order where a delivered item has no recorded price shows the amount
  field blank with an explanation naming the missing price, plus the reference figure for the whole order; the
  collector types an amount and submits, and only that amount is written, undetailed.
- A partial delivery on an order where every delivered item is priced but the order still carries undetailed
  money from an earlier payment behaves the same way: blank field, explanation naming the undetailed money.
- The settlement date starts equal to the arrival date and can be edited to an earlier date within the order's
  own date, or refuses a date before the order was placed.
- A store-scoped batch arrival across two orders of the same store writes one `StorePayment` per order, and
  the store's payment history lists both, dated identically unless the collector edited the date.
- Simulating a settlement failure right after a successful delivery write leaves the delivery detail showing
  `DELIVERED` immediately, with a visible `Retry` action for the pending settlement that survives a page
  navigation and back.
- Reopening a settled delivery shows the reopen-reversion copy naming the reverted amount, and the payment
  disappears from the store's payment history.
- Choosing "Deshacer" on that reopen restores the exact original payment, not a freshly recomputed one.
- A store that already holds unassigned money shows the checkbox unmarked by default when the collector opens
  quick arrival for one of that store's orders, with copy pointing at the unassigned amount.
- An order that ends up with both a computed per-product allocation and a pre-existing undetailed allocation
  (the first order in the collector's history to mix the two) renders its payment breakdown without visual
  overlap or a duplicated total (spec §10 risk 3; there is no prior fixture for this shape, so this scenario
  needs a purpose-built one).
- A store with an existing unassigned payment and two open orders (`FR-08-46`, spec §2.3): marking the older
  order's delivery delivered commits the delivery and closes it, and the money transaction that follows
  consumes the unassigned money into it up to its own balance; the store's "Pendiente en pedidos abiertos"
  figure afterward reflects only the remaining order's own balance, never a figure understated by money that
  was never assigned to it.
- A store with an existing unassigned payment and one order whose delivery completes it, submitted with "Ya
  pagué el resto" unchecked: the arrival still closes the order, the money transaction still consumes the
  unassigned money into it, and no settlement `StorePayment` is written, confirming the consumption is not
  gated by the checkbox.
- An order whose entire remaining balance was written off in an earlier store reconciliation (`FRD-05 · WO-10`)
  shows no settlement checkbox at all when the collector later marks its delivery delivered; the arrival still
  records normally, `openBalanceMinor(order)` reads `0`, and no `StorePayment` is created, confirming a
  written-off order can never be re-offered as a fresh settlement.
- Failing the money transaction, then reopening the delivery before invoking `Retry`: `Retry` refuses the
  write instead of creating an orphaned settlement `StorePayment` against the now-reopened delivery, and the
  delivery detail no longer shows a pending-settlement affordance for it.
- Reopening a delivery that both consumed pre-existing unassigned money on close and wrote its own settlement:
  the reopen-reversion copy names both the reverted settlement amount and the surviving consumed amount in one
  message, and the store's payment history still shows the earlier (consumption-source) `StorePayment` with
  its allocation to this order intact.
- A partial delivery on an order carrying a `StoreAccountAdjustmentLine` (round-4 arbitration, `FR-08-40`):
  the delivered items are all priced and the order has no undetailed allocation, so the amount would auto-compute
  under the naive per-item formula, but that sum exceeds `openBalanceMinor(order)`; the amount field shows the
  capped figure, not the naive per-item sum, and the resulting `StorePayment` carries one undetailed allocation
  rather than a per-item breakdown.
- Using the formal "Marcar como llegada" action on an order whose store holds unassigned money in the settlement
  currency (round-4 arbitration): the arrival closes the order exactly as it does today, no settlement checkbox
  or amount field appears anywhere on that screen, and the store's "Pendiente en pedidos abiertos" / unassigned
  figures afterward reflect the consumption having run, confirming the fix for the store's stranded money does
  not depend on which of the two order-closing flows the collector used.

## Analytics

- The existing `POSTHOG_EVENTS.DELIVERY.QUICK_ARRIVAL_LOGGED` and `STORE_ARRIVAL_LOGGED` events gain
  properties for this slice: `settled` (boolean), `settlement_branch` (`"full" | "partial_computed" |
"manual" | "not_settled"`), `settlement_amount_minor`, and `settlement_date_edited` (boolean, whether the
  collector changed the proposed date). No new top-level event is introduced for the happy path.
- `reopenDelivery`'s existing analytics gain a `settlement_reverted_amount_minor` property when a settlement
  payment was deleted as part of the reopen.
- **Round-4 addition:** the existing `POSTHOG_EVENTS.DELIVERY.MARKED_DELIVERED` event (fired by
  `markDeliveredAction`) gains a `consumed_unassigned_minor` property, populated only when the formal flow's
  order-close consumption (`FR-08-46`) actually moved money; this is the one property this slice adds to that
  event, since the formal flow gains no settlement UI and so no `settled` / `settlement_branch` properties.
- No free-text field (note, adjustment reason) is ever included in event properties, matching the existing
  rule for delivery events.

## Notes

- **This slice does not touch the formal shipment flow's settlement UI** (the create-delivery wizard,
  `createDeliveryAction.ts`, and `DeliveryDetailClient.tsx`'s "Marcar como llegada" screen render no checkbox,
  no amount field, no reference copy). Extending the settlement UI there is an open decision (spec §9) that
  would likely need different defaults (checkbox not pre-marked, date asked rather than proposed) given the
  longer typical gap between payment and that flow's own arrival confirmation; it is intentionally left
  undecided here rather than folded in. **Round-4 correction:** this slice's earlier text claimed the slice
  touches neither `createDeliveryAction.ts` nor "the wizard's mark-delivered action" at all. That still holds
  for `createDeliveryAction.ts` (verified: the wizard's create action never passes `receivedDate`, so it can
  never itself close an order), but not for the mark-delivered action's own Server Action
  (`markDeliveredAction` in `deliveryLifecycleActions.ts`): its underlying mutation, `markDeliveryDelivered`,
  is one of the two real order-closing producers alongside `createDelivery`, so it now gains the money
  transaction's consumption half (`FR-08-46`) even while its UI stays exactly as it is today. The UI question
  and the consumption question turned out to be two different questions, not one; only the first stays open.
- The two-transaction split (`ADR 0032`) is the same shape as every other "recompute, then retry" money path in
  this codebase (`runSerializableTransaction`'s own contract): a caller may re-enter the write step any number
  of times, and each entry re-derives its verdict from fresh data rather than trusting anything held across the
  gap.
- `Delivery.cost` remains untouched by this slice, per the spec's explicit decision against wiring it into
  store debt (spec §8).
