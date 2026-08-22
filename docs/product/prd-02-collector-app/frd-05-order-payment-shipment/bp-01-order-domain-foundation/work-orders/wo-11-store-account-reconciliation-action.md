---
id: WO-11
type: WORK_ORDER
slug: store-account-reconciliation-action
title: Store Account Reconciliation Action
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-08-20
implementation_status: IMPLEMENTED
---

# WO-11 Store Account Reconciliation Action

## Summary

The store-level **"cuadrar cuenta" (reconcile account)** action: the app shows what it believes is
still owed **broken down order by order**, the collector marks which of those orders are actually
settled (or types a smaller remaining balance for one), and what they marked is written down as a
**reconciliation adjustment**, a last-resort correction, never the first tool reached for.

Everything the collector can reach lives here: the write, its refusals, the read-only preview, the
sheet, the per-store history, the delete mutation, the adjustment term in the payment-validation
ceiling, the three order-edit guards that must stop being blind to a line (`FR-05-68`), and the nudge
that offers the action when a store runs out of open orders.

**The models and the arithmetic are not here.** `StoreAccountAdjustment`,
`StoreAccountAdjustmentLine` and the canonical `openBalanceMinor` all land earlier, in
[`WO-10`](./wo-10-order-open-balance-and-store-account-adjustment-model.md), which depends on
nothing. **Work order numbers are identifiers, not an execution order:** `WO-10` runs before `WO-09`
and this work order runs after both. The sequence is declared once, in
[`BP-01`](../bp-01-order-domain-foundation.md)'s `## Implementation Plan`, and cited from here
rather than restated.

**A line may name any non-cancelled order, delivered ones included** (`ADR 0034` §3, `FR-05-64`).
This is the difference between a feature that works and one that cannot be reached. `ADR 0034` §7
names the natural moment to square a store as the moment it has **nothing open left**, and 522 of
the collector's 565 orders are already `COMPLETED`. Restricting a line to open orders would mean
that at exactly the moment the app offers to reconcile, the sheet has no candidates and the write is
impossible, while the back catalogue that motivated the whole feature stays unreachable forever,
carrying the residue the diagnostic figure (`FR-06-28`) will point at without offering any tool to
clear it. The only status refused is `CANCELLED`.

## Prerequisites

- [`WO-10`](./wo-10-order-open-balance-and-store-account-adjustment-model.md): the two models, their
  migration, and the canonical `openBalanceMinor` / `declaredAgainstOrderMinor` this work order
  writes rows into and bounds every line with.
- [`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md): `getUnassignedStoreMoneyMinor`
  (read for the `STORE_HAS_UNASSIGNED_MONEY` refusal, `FR-05-69`) and the two store debt figures,
  one of which this work order adds an explicit adjustment term to and the other of which already
  inherits it through `openBalanceMinor`.

## In Scope

- **`createStoreAccountAdjustment`**: takes `(storeId, currencyCode, reason, lines)` where each line
  is `{ orderId, amountMinor }` written off on that order. It recomputes every named order's own
  `openBalanceMinor` server-side (`BR-05-32`), refuses any line that exceeds it, refuses an order
  that does not belong to this collector, this store and this currency, refuses a `CANCELLED` order,
  forces `adjustmentDate` to today server-side regardless of client input (`BR-05-29`), and writes
  the header plus its lines in one transaction. The header's magnitude is **derived from its lines
  at read time and never stored** (`WO-10`), so there is no total for a caller to send and none for
  the server to reconcile against the lines. **It never derives the lines itself**: a declaration
  with no line is refused rather than spread across the store's orders (`ADR 0025`, `ADR 0028`)
- **The reconciliation write refuses while the store holds parked money in that currency**
  (`FR-05-69`, `STORE_HAS_UNASSIGNED_MONEY`, `ADR 0034` §6), read from
  [`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md)'s own
  `getUnassignedStoreMoneyMinor` and decided before the first write. The preview surfaces the same
  condition, so the sheet offers the assignment instead of the write rather than letting the
  collector fill the sheet and be refused at submit
- **`deleteStoreAccountAdjustment`**: its own mutation, scoped by `{ id, userId }`. Nothing is
  reused from `deleteStorePayment`, because there are no allocations to reverse and no order caches
  to rewrite; deleting an adjustment removes its header and cascades its lines, and with them every
  per-order term the two debt figures were subtracting (`FR-05-65`, "borrable")
- **`getStoreReconciliationPreview`**: the read-only breakdown shown before the action is offered,
  so a gap that explains itself never needs an adjustment. It lists **every non-cancelled order of
  that (store, currency) whose `openBalanceMinor` is greater than zero**, each with that net balance,
  split into two groups the sheet renders separately: the store's **open** orders, and its
  **delivered** orders that still carry a balance. It also returns the store's parked pool
  (`FR-05-64`, `ADR 0034` §4.4). A balance already written off is never offered a second time,
  because the per order figure it lists is the canonical net one
- **`listStoreAccountAdjustments`**: per-store, per-currency history of adjustments, newest first,
  each with its own derived magnitude (`Σ` of the lines that still exist), its date, its reason and
  the orders it named (`FR-05-66`)
- **The adjustment-line term in the payment-validation ceiling** (`STORE_DEBT_EXCEEDED`,
  `FR-05-43` / `FR-05-63`). The two store debt figures acquire the term by different routes, and
  only one of them needs code here (see Derived Debt Arithmetic):
  - the collector-facing open-order figure (`FR-05-61`) needs **nothing**: it is built order by order
    on the canonical `openBalanceMinor`
    ([`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md)'s `openOrderDebtMinor`), so
    it is already net of lines by construction. A line on a delivered order is correctly absent from
    it, because that order is outside the figure
  - the ceiling is **not** built per order: its base is the store's lifetime debt over non-cancelled
    orders, computed from payments at their face value (`getStoreDebtMinor`, which
    [`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md) leaves unchanged). It
    therefore needs an explicit subtrahend: `Σ` of the lines written against that store's
    **non-cancelled** orders, which is its own base's scope, so a written-off balance cannot be paid
    a second time, before or after delivery
  - the term lands here rather than in `WO-09` because no line can exist until this work order
    ships, so `WO-09`'s ceiling is exactly correct without it in the window between the two
- **The three order-edit guards in `src/lib/data/orders/orderMutations.ts` (`FR-05-68`).** They are
  code changes, not documentation: a line is deliberately not a `PaymentAllocation`, so all three
  are blind to it as written.
  - `TOTAL_BELOW_PAID` compares the submitted total against `declaredAgainstOrderMinor` (`WO-10`),
    not against `order.allocatedAmountMinor` alone. Without this, an order whose balance was written
    off can have its total lowered below the write-off, and its `openBalanceMinor` goes negative with
    no ceiling left to catch it (`BR-05-32` says such a figure is rendered, not clamped, so it
    becomes a visible wrong number in the store)
  - `STORE_CHANGE_BLOCKED` and `CURRENCY_CHANGE_BLOCKED` both hang off one `hasAllocations` read,
    which becomes "carries an allocation **or** an adjustment line". Without this, a written-off
    order can be restated in another currency, so the write-off crosses currencies when a store's
    account is reconciled strictly per currency; or moved to another store, leaving the line
    reducing a store that never declared that order
  - both changes stay inside `editOrder`'s existing transaction and before its first write
    (`ADR 0022`); the second is one extra existence read, not a new query shape
- **UI**: a reconciliation sheet/modal following the canonical Semantic Depth pattern (`ADR 0008`),
  offered from the store detail's payment block, listing the store's orders with their own balances
  in the two labelled groups above so the collector can mark the settled ones or type a smaller
  balance per order, plus the adjustment history rendered as its own distinctly labelled block,
  never interleaved silently into "Pagos a esta tienda"
- **The "nothing left open" nudge** (`ADR 0034` §7): the proactive offer surfaced when a store
  reaches zero open orders, which is precisely the store where the sheet's candidates are all
  delivered orders

## Out of Scope

- The two models, their migration and the canonical open balance
  ([`WO-10`](./wo-10-order-open-balance-and-store-account-adjustment-model.md)). This work order
  writes rows into tables that already exist and reads a figure it does not define.
- The seventh consumer of the canonical balance, the `EXCEEDS_BALANCE` allocation ceiling, also
  [`WO-10`](./wo-10-order-open-balance-and-store-account-adjustment-model.md)'s. It is already net
  by the time the first line is written.
- The believed-debt and unassigned-money derivations themselves
  ([`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md) owns `openOrderDebtMinor` and
  `getUnassignedStoreMoneyMinor`; this work order reads them and adds its own subtrahend to the
  first).
- Editing an adjustment after it is written, including editing or removing a single line. There is
  no edit mutation: correcting one means deleting the whole declaration and, if a real payment is
  now known, recording that payment instead (`FR-05-65`, "borrable").
- Any automatic proposal of **which** orders to write off. The app shows the orders with their
  balances; choosing among them is the collector's declaration, and a suggested selection is a
  derivation wearing a checkbox (`ADR 0025`, `ADR 0028`).
- Any change to the dashboard's **spend** figures. An adjustment is deliberately invisible to every
  `PaymentAllocation` based figure (`BR-06-04`), and that invisibility is the point of the model
  shape, not an omission to fix later. The dashboard's **obligation** figures are a different
  matter and do change, because they are consumers of the canonical open balance (`BR-05-32`); that
  change belongs to
  [`FRD-06 · WO-07`](../../../frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md),
  not here, and without it the panel and the store detail print different numbers after a
  reconciliation and the diagnostic figure keeps flagging a balance the collector already squared.
- Any dashboard surfacing of the adjustment history (not requested by the spec).

## Requirements

- `FR-05-64` through `FR-05-66`
- `FR-05-68`, `FR-05-69`
- `BR-05-29`, `BR-05-30`, `BR-05-32`

## Blueprints

- `BP-01` reconciliation adjustment contract (new, behaviour half)
- `BP-01` order open balance contract (consumed, not owned)
- `BP-01` architecture decision: the reconciliation adjustment is its own model, not a tagged
  `StorePayment` (`ADR 0034`)

## Validation Contract

| Rule                                                                                                                                    | Error code                                    | Enforcement point                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| The store belongs to the caller                                                                                                         | `NOT_FOUND`                                   | `createStoreAccountAdjustment`, before the first write                                                                |
| `currencyCode` is in the allowed set and matches the pair the preview was built for                                                     | `CURRENCY_INVALID` (new)                      | `createStoreAccountAdjustment`, before the first write                                                                |
| The store holds **no** parked money in this currency (`FR-05-69`)                                                                       | `STORE_HAS_UNASSIGNED_MONEY` (new)            | `createStoreAccountAdjustment`, before the first write, from `WO-09`'s `getUnassignedStoreMoneyMinor`                 |
| At least one line is declared, and every line writes something off                                                                      | `NO_ADJUSTMENT_NEEDED` (new)                  | `createStoreAccountAdjustment`, before the first write                                                                |
| Every line's `amountMinor` is a positive integer                                                                                        | `AMOUNT_INVALID`                              | `createStoreAccountAdjustment`, before the first write                                                                |
| Every line's order belongs to the caller, to this store, and to this currency                                                           | `NOT_FOUND`                                   | `createStoreAccountAdjustment`, before the first write                                                                |
| Every line's order is **not cancelled**. `COMPLETED` orders are accepted, deliberately                                                  | `ORDER_CANCELLED` (existing, reused)          | `createStoreAccountAdjustment`, before the first write                                                                |
| Every line is within its own order's canonical `openBalanceMinor` (`BR-05-32`), recomputed server-side and already net of earlier lines | `ADJUSTMENT_EXCEEDS_ORDER_BALANCE` (new)      | `createStoreAccountAdjustment`, before the first write                                                                |
| No order is named twice in the same declaration                                                                                         | `DUPLICATE_ORDER_LINE` (new)                  | `createStoreAccountAdjustment`, before the first write, plus `@@unique([adjustmentId, orderId])`                      |
| `reason` is a non-empty declared string (may literally be "not identified")                                                             | `REASON_REQUIRED` (new)                       | `createStoreAccountAdjustment`, before the first write                                                                |
| `amountMinor > 0` on every line, declared by the model rather than inherited from `StorePayment`                                        | `AMOUNT_INVALID`                              | hand-written `CHECK (amount_minor > 0)` on the line table (`WO-10`) + the mutation's own pre-write checks             |
| The adjustment's magnitude is the sum of its lines, derived at read time, never stored and never accepted from the client               | none (field absent by design)                 | the model itself (`WO-10`): there is no total column to send, inflate or disagree with                                |
| `adjustmentDate` is always today; never accepted from the client                                                                        | none (input ignored, not a refusal)           | `createStoreAccountAdjustment`                                                                                        |
| Deleting an adjustment that is not the caller's own                                                                                     | `NOT_FOUND`                                   | `deleteStoreAccountAdjustment` (new)                                                                                  |
| An order's total may not drop below `Σ allocations + Σ adjustment lines` (`FR-05-68`)                                                   | `TOTAL_BELOW_PAID` (existing, widened)        | `editOrder`, before the first write: compares against `declaredAgainstOrderMinor`, never `allocatedAmountMinor` alone |
| An order carrying an adjustment line may not change currency (`FR-05-68`)                                                               | `CURRENCY_CHANGE_BLOCKED` (existing, widened) | `editOrder`, before the first write: the condition becomes "carries an allocation OR an adjustment line"              |
| An order carrying an adjustment line may not change store (`FR-05-68`)                                                                  | `STORE_CHANGE_BLOCKED` (existing, widened)    | `editOrder`, before the first write: same widened condition, beside its existing delivery-link and status checks      |

**On `ORDER_CANCELLED` rather than a new code.** An earlier draft refused any order that was not
open, with a new `ORDER_NOT_OPEN`. That refusal made the feature unreachable at exactly the moment
it is meant to be offered (see Summary), so it is gone. What remains is the one status that must
still be refused, and the family already has its name: `ORDER_CANCELLED` is what
`createStorePayment` returns for the same situation, on the same reasoning. A cancelled order's
committed total is already outside both debt figures, so a line against it would write off a
balance no figure was counting, and the ceiling that bounds the line would be computed over a total
nobody owes.

The last three rows are the only ones this work order adds to a mutation it does not own. They are
`editOrder`'s, they keep their existing error codes, and none of them is a new refusal: each one
already exists and simply stops being blind to the third term (`BR-05-32`). They are listed in this
contract rather than left to the reader of `ADR 0034` because the line is not a `PaymentAllocation`
by design, so nothing in `editOrder` would ever encounter one by accident.

Every refusal above is decided before `createStoreAccountAdjustment`'s first write, inside its own
`runSerializableTransaction`, per `ADR 0022`: each line's ceiling is a read, so the whole declaration
is accepted or rejected before the header row exists. None of these rules is inherited: the models
are new, so `StorePayment`'s schema constraint and `createStorePayment`'s checks say nothing about
them. In particular the one-way direction of `BR-05-30` is enforced on three levels at once
(unsigned line amounts with no field able to express the opposite direction, a database `CHECK` on
the line table, and the pre-write refusals above), which is what `ADR 0034` §5 requires now that the
guarantee no longer comes from `StorePayment.amount > 0`.

Note what is **not** in this table: there is no `declaredActualDebtMinor` input and therefore no
rule about it. The collector's store-level statement ("I really owe 200") is a read-out of the
per-order declaration, computed for display as the open-order debt minus the lines being written,
never a second number the server has to reconcile against the first. Two inputs that must agree is
a validation rule waiting to be forgotten; one input and a derived read-out cannot disagree.

## Derived Debt Arithmetic

The canonical definition is [`WO-10`](./wo-10-order-open-balance-and-store-account-adjustment-model.md)'s
and is cited, not restated:

```ts
// From src/lib/data/orders/orderOpenBalance.ts (WO-10). One definition, one module, seven consumers.
openBalanceMinor(o)           = o.totalCost - Σ allocations(o) - Σ adjustment lines(o);
declaredAgainstOrderMinor(o)  = o.totalCost - openBalanceMinor(o);
```

What this work order writes:

```ts
// The declaration. One line per order the collector marked, each capped by that order's own
// openBalanceMinor, recomputed server-side. Nothing is derived, spread or ordered by the app.
lines = [{ orderId, amountMinor }, ...];   // amountMinor > 0, <= openBalanceMinor(order)

// The written rows: { storeId, userId, currencyCode, adjustmentDate: server today, reason }
//                 + one StoreAccountAdjustmentLine per entry of `lines`.
// NO stored total on the header: its magnitude is Σ of the lines that exist, read when read.
// No PaymentAllocation rows. No order's own remaining balance moves.
```

An adjustment reduces what the STORE is shown to owe. It never touches an order's own balance, so
each of the two store figures has to account for its lines, over **exactly the set of orders it
already sums over**, which is the whole design. They differ in how much code that costs:

```ts
// 1. The figure SHOWN to the collector (open orders only, FR-05-61). NOTHING to write here:
// WO-09 builds it order by order on the canonical open balance, so the line term is inherited.
displayedStoreDebtMinor = Σ openBalanceMinor(order) for the open orders of this store and currency;
                        // = Σ totalCost − Σ allocations − Σ lines, over that same set of orders

// 2. The ceiling that VALIDATES a new payment (STORE_DEBT_EXCEEDED, FR-05-43 / FR-05-63).
// This one DOES need an explicit term: its base is not built per order, it counts the store's
// payments at face value over its lifetime debt, so no openBalanceMinor call is hiding inside it.
// The term uses that base's own scope: a written-off balance stays written off after delivery and
// cannot be paid twice, and a cancelled order drops its committed total and its lines together.
validationCeilingMinor = lifetimeStoreDebtMinor(storeId, currencyCode)
                       - Σ StoreAccountAdjustmentLine.amountMinor
                           written against non-cancelled orders of this store in this currency;
```

**A line on a delivered order moves the second figure and not the first, and that is correct.** The
displayed figure counts open orders only (`FR-05-61`), so a delivered order and everything attached
to it, its committed total, its payments and now its lines, are already outside it (`BR-05-26`).
Writing off a delivered order therefore changes two other things instead: the payment ceiling above
(so the balance cannot be paid twice) and the diagnostic figure "pagos que no registraste"
(`FR-06-28`), which reads the same canonical `openBalanceMinor` and therefore drops by the line. The
sheet has to say so, because a collector who squares a delivered order and watches the store figure
not move will reasonably conclude nothing happened (see UX Notes).

There is **no cap, no drain order and no date comparison** in either figure, and that is the
correction this feature carries. An earlier draft stored one store-level magnitude and bounded it:
applied only up to the balance of the open orders that already existed on the adjustment's own date
(`orderDate <= adjustmentDate`), drained oldest adjustment first. The bound **slides**:

```text
Store with A = 180.00 (orderDate 1 Jun) and B = 200.00 (orderDate 10 Jun), both open, no payments.
Believed debt: 380.00.

1 Sep   The collector says the account really stands at 200.00.
        OLD: one magnitude of 180.00. Explainable = 380.00, applied = 180.00, shown = 200.00. OK.
        NEW: one line { order A, 180.00 }.  380.00 - 0 - 180.00 = 200.00. OK.

20 Sep  A is delivered and leaves the open-order set with its own debt.
        OLD: explainable = B's 200.00, cap = 200.00, applied is STILL 180.00,
             shown = 200.00 - 180.00 = 20.00, against a truth of 200.00. Understated by 180.00,
             on an order the adjustment never wrote off.
        NEW: A leaves carrying its line. Open orders = { B }. 200.00 - 0 - 0 = 200.00. Correct.
```

## Technical Notes

**Why a delivered order is a legitimate target, in arithmetic rather than in intent.** A line's
ceiling is `openBalanceMinor`, and that definition never reads the order's status (`WO-10`). A
delivered order with a residue of 200 has an `openBalanceMinor` of 200 exactly like an open one, so
the same ceiling bounds the same declaration. Nothing about the write changes; what changes is
which figures were counting that balance in the first place. The collector's sentence is identical
in both cases and it is the honest one: this balance was never really owed.

The census is what makes it necessary rather than merely permitted. 522 of 565 orders are
`COMPLETED`, and `ADR 0034` §7 offers the action when a store has nothing open left. Under an
open-orders-only rule those two facts collide: the moment the app proposes the cleanup is the moment
it has nothing to propose it on.

**The good side effect: deleting an adjustment stops being a one-way door.** Under the open-orders
rule, an adjustment written against an order that was later delivered could be deleted (the header
and its lines go), but the balance it had written off could never be written off again, because the
order was no longer open. Deleting left a residue nothing could clear: a ghost. With delivered
orders in scope, deletion is fully reversible in both directions, which is what `FR-05-65`'s
"borrable" promised all along and what makes "the receipt turned up, delete the adjustment and
record the real payment" safe to offer.

**Known interaction: `cancelOrder` with `credit` parks money and therefore blocks reconciliation.**
`credit` is the **default** branch of the cancel choice (`BR-05-15`): it deletes that order's
`PaymentAllocation` rows and resets `Order.allocatedAmountMinor` to 0, while the underlying
`StorePayment` survives. That payment is now declared against the store and attributed to nothing,
which is exactly the parked money `FR-05-69` refuses to reconcile over. Concretely: a collector who
cancels an order with the default choice and then tries to square that store is refused with
`STORE_HAS_UNASSIGNED_MONEY` until they re-declare that money against another order or park it
deliberately. This is a real cost on a common path and it is written down rather than discovered.
It is **not a hard block**: the way out is the assignment the refusal already names and offers, and
the refusal is right on its own terms, since freed credit is money whose destination the collector
genuinely knows better than the app does. The sheet must therefore name the amount (UX Notes), or
the collector meets a refusal with no visible cause immediately after an unrelated cancel.

**Form decision: reconciling is refused while the store holds parked money, rather than netted
against it** (`ADR 0034` §6, `FR-05-69`). Without the refusal the same money is subtracted twice,
and the arithmetic is short enough to state in full:

```text
Store with one open order A of 180.00, unpaid, and a payment of 30.00 parked against the store
(declared, attributed to nothing, BR-05-27).

  Store debt today      = Σ totalCost − Σ StorePayment.amount = 180.00 − 30.00 = 150.00
                          The pool already reduces it: paidMinor counts a payment at its FACE VALUE,
                          not at its allocations, so parked money is inside the store figure today.
  A line's own ceiling  = openBalanceMinor(A) = 180.00 − 0 − 0 = 180.00
                          The pool is invisible here: a line's ceiling reads allocations, and parked
                          money is not one.
  Write off all of A    = a line of 180.00. The same 30.00 is now subtracted twice.
  Payment ceiling       = 150.00 − 180.00 = −30.00

Result on screen: a false "A favor 30" (FR-05-43 reads a negative store figure as an overpayment),
and STORE_DEBT_EXCEEDED refuses every new payment, so "Registrar pago" sits disabled with nothing
explaining why.
```

The two alternatives were weighed and both lose to refusing:

- **Net the pool out of each line's ceiling** (rejected). It requires deciding **which** orders the
  pool belongs to, and there is no honest answer: that attribution is the guess `ADR 0025` and
  `ADR 0028` forbid everywhere else in this package. Spreading it proportionally, oldest-first or
  onto the largest order would produce a per-order ceiling the collector never declared, inside the
  one feature whose entire premise is that the collector declares.
- **Subtract the pool from the store-level read-out only** (rejected). It removes the false "a
  favor" from the screen and leaves the double subtraction inside the payment ceiling, which is the
  half that actually blocks the collector. It fixes the symptom that is visible and keeps the one
  that is not.
- **Refuse** (chosen). The store must be assigned before it can be squared. It costs one extra step
  on a cleanup flow, and it pays for itself twice: assignment is evidence while a write-off is the
  absence of evidence, so pushing the collector toward it is the same ordering `ADR 0034` §6 already
  demands, and the refusal makes the pool impossible to double-count instead of merely unlikely to.

**Form decision: the order-edit guards count lines, and this is where that lands** (`FR-05-68`).
The three guards in `src/lib/data/orders/orderMutations.ts` are the only consumers of the canonical
balance that live outside a money figure, which is exactly why they were missed: `TOTAL_BELOW_PAID`
reads `order.allocatedAmountMinor`, and `STORE_CHANGE_BLOCKED` / `CURRENCY_CHANGE_BLOCKED` share
one `hasAllocations` existence read against `paymentAllocation`. A line is deliberately neither, so
all three pass an order that has been written off. What that permits, concretely: lowering a
written-off order's total below its line drives `openBalanceMinor` negative with nothing left to
refuse it; changing its currency carries the write-off across currencies when a store's account is
reconciled strictly per currency; changing its store hands the order to a store that never declared
it while the line keeps reducing the store that did. The fix is two reads, both cheap and both
inside the transaction `editOrder` already opens: swap the compared figure for
`declaredAgainstOrderMinor`, and widen the one existence read to "allocation OR line".

Other notes:

- **`adjustmentDate` is never taken from the client**, mirroring the same "the amount never comes
  from the client" discipline
  [`FRD-08 · WO-08`](../../../frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md)'s
  settle-on-arrival flow uses for its own server-computed amount: the adjustment date is always the
  write's own today, so a stale client clock or a delayed retry can never backdate a correction
  (`BR-05-29`, "never rewrites the past"). Each line's amount is bounded server-side for the same
  reason, and the declaration's magnitude is not a field at all.
- **The lines are declared, never derived, and that distinction is the whole rule.** The app never
  divides a store-level figure across orders, neither proportionally (`ADR 0025` forbids that
  outright) nor by a deterministic oldest-first rule, because a split the collector did not declare
  is a derivation (`ADR 0028`). A line exists only because the collector marked that order. The
  app's entire contribution is showing each order with its own balance and refusing a line larger
  than it, which is the same division of labour the batch-arrival and parked-money flows already
  use: ask the question the collector can answer, never guess it for them. With the cap gone, this
  feature uses **no ordering at all**.
- **The preview (`getStoreReconciliationPreview`) is read-only and idempotent.** Calling it never
  changes anything; it exists purely so the UI can show "before you adjust, here is what explains
  the gap" per `ADR 0034` §4.4.
- **Deletion is still trivial by design.** With no allocations and no order caches to touch,
  deleting an adjustment is one row delete, its lines cascading with it, plus a recomputation of the
  store's derived figures, which are derived at read time anyway. `Order.allocatedAmountMinor` is
  never rewritten by this work order, in either direction: a line is not an allocation, so the
  order's own cache has nothing to do with it.
- **An order's own lifecycle moves its lines, and no code has to know that.** Both figures scope
  their line term to the same set of orders they already sum over, so a delivered order drops its
  line from the displayed figure and a cancelled order drops it from both, without a single
  adjustment-aware branch in the delivery or cancel paths. `onDelete: Cascade` on `orderId` covers
  physical order deletion the same way, and because the header stores no total (`WO-10`), that
  cascade leaves nothing inconsistent behind.

## UX Notes

- **Last resort, not first.** Before the action is offered as a write, the sheet shows the per order
  breakdown and the unassigned-money figure (`WO-09`'s `getUnassignedStoreMoneyMinor`), so a
  collector who forgot to assign a payment can fix that instead of writing an adjustment over it
  (`ADR 0034` §4.4, echoing QuickBooks' own reconciliation-discrepancies guidance that an adjustment
  "hides the error instead of fixing it").
- **Parked money blocks the write, and the sheet says so instead of failing at submit.** When the
  store holds unassigned money in the currency being reconciled, the sheet shows the amount and
  offers the assignment as the action, with the adjustment unreachable behind it (`FR-05-69`):
  **es** "Tienes {monto} sin asignar en {tienda}. Asígnalo antes de cuadrar la cuenta.", **en**
  "{store} holds {amount} you have not assigned yet. Assign it before you reconcile the account."
  This is the strongest form of the "last resort, not first" ordering above: the one explanation
  that is still available is offered as the only way forward, and the refusal exists on the server
  as well (`STORE_HAS_UNASSIGNED_MONEY`) so a stale sheet cannot get around it. The copy names the
  amount because the collector has to recognise the payment to assign it, and because the most
  common way to arrive here is an unrelated cancel taken with its default `credit` choice
  (Technical Notes), which leaves money parked without ever saying the word.
- **The sheet has two groups, and they do different things.** Open orders come first, under a
  heading that says so (**es** "Pedidos abiertos", **en** "Open orders"); delivered orders that
  still carry a balance come second (**es** "Pedidos ya entregados con saldo", **en** "Delivered
  orders with a balance"). Marking one in the first group lowers the store's debt figure; marking
  one in the second does not, because a delivered order is already outside that figure. The second
  group therefore carries its own one-line explanation of what it does change (**es** "Ya no cuentan
  en la deuda de {tienda}. Marcarlos limpia el aviso de pagos sin registrar.", **en** "These no
  longer count toward {store}'s debt. Marking them clears the unrecorded-payments notice.") A group
  with no rows is not rendered at all.
- **The collector marks orders, they do not type a store total.** The sheet lists each order with
  its own remaining balance and lets the collector either mark it as already settled (which writes a
  line for its whole balance) or type a smaller balance for it (which writes the difference as a
  partial line). The store-level "so you really owe {amount}" figure updates as they mark, as a
  **read-out** of what they marked in the open-order group, never as a field of its own: one input
  and a derived total cannot disagree, two inputs eventually do. Each order is named by its date and
  store, never by its `ORD-YYYYMMDD-NN` code (`FR-05-67`), because recognising the order is the
  entire skill the question relies on.
- **Marking everything settled is the common case and must be one gesture.** With most stores
  holding one or two live orders, and the natural moment being a store with nothing left open at
  all, the sheet should not make a full write-off feel like data entry. A "todo saldado" affordance
  that marks the listed orders at once is a UI convenience over the same declaration, not a
  different one: it still produces one line per order, and it is chosen, never defaulted. On a store
  whose only rows are delivered orders, this is the entire back-catalogue cleanup in one tap.
- **Natural offer point.** A store reaching zero open orders is the moment this action is surfaced
  proactively (**es** "No te queda nada abierto con {tienda}. ¿Están a mano?", **en** "Nothing left
  open with {store}. Is everything settled?"), and it is reachable anytime from the store detail's
  payment block, since a genuine data-entry drift can surface with orders still standing. The nudge
  is only honest because a delivered order can be written off: on a store with zero open orders,
  every candidate the sheet can list is a delivered one, so under an open-orders-only rule this
  prompt would open a sheet with nothing in it.
- **The reason field is always required**, defaulting to nothing pre-filled; "no identificado" / "not
  identified" is a legitimate, explicit answer, not a placeholder the field starts with.
- **History reads like an audit trail**, in its own labelled block rather than mixed into the
  payments list, so an adjustment can never be skimmed as a transfer. Each entry shows its own
  magnitude, which is the sum of the lines that still exist: if an order was deleted afterwards, the
  entry shows the smaller figure, because that is what it still writes off. A store that needs
  repeated adjustments is a signal worth surfacing on its own (`ADR 0034` §8), though this work
  order stops at storing and listing the history, not at building a pattern detector.
- **An adjusted order still shows its own balance, even though a line now names it.** The line
  scopes the write-off so it dies with the order; it does not pay it. The order detail therefore
  keeps its balance and its "still owed" chip (`FR-05-35`), and the reconciliation sheet must not
  imply otherwise: its confirmation copy talks about the store's account being square, never about
  the orders having been paid. The one place the line does show is the reconciliation sheet itself,
  where an order already written off is listed with the write-off visible, so the same balance is
  never offered for adjustment twice.

## Security Notes

- `createStoreAccountAdjustment`, `deleteStoreAccountAdjustment`, `getStoreReconciliationPreview`,
  and `listStoreAccountAdjustments` are all scoped by `userId`, the same discipline every other
  store-money function in this domain carries.
- **Every `orderId` a client sends is re-resolved against `{ userId, storeId, currencyCode }` before
  it becomes a line.** An order id is the one identifier this feature accepts from outside, so it is
  also the one place a caller could try to write off somebody else's order or an order of another
  store. An order that does not resolve is `NOT_FOUND`, indistinguishable from one that does not
  exist, and the per-line ceiling is always the balance the server computed, never one the client
  claimed. Widening the accepted statuses to include `COMPLETED` does not widen this: status is
  checked after ownership, and a cancelled or foreign order is still refused.
- Deletion uses its own `{ id, userId }` lookup; an adjustment from another account is
  indistinguishable from "not found", exactly as for any other money record here.
- `reason` is free text declared by the collector; it is rendered, never interpreted, and carries no
  special trust beyond any other user-authored note field in this domain.

## Assumptions

- [`WO-10`](./wo-10-order-open-balance-and-store-account-adjustment-model.md) and
  [`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md) have both landed. This work
  order adds no Prisma model and no migration of its own.
- `writeStorePaymentWithAllocations`, `validateAllocations` and `deleteStorePayment` are **not**
  reused and **not** modified here. This work order writes no `StorePayment` and no
  `PaymentAllocation` row at all, and it never touches `Order.allocatedAmountMinor`.
  `validateAllocations` does change in this package, but in
  [`WO-10`](./wo-10-order-open-balance-and-store-account-adjustment-model.md), for the
  `EXCEEDS_BALANCE` ceiling.
- The store detail's payment block exists and can host both the reconciliation trigger and a new
  adjustment-history block; the adjustments are not merged into the existing "Pagos a esta tienda"
  query.
- The dashboard's obligation figures, including the diagnostic `FR-06-28`, read the canonical
  `openBalanceMinor`
  ([`FRD-06 · WO-07`](../../../frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md)).
  Without that, a line written against a delivered order changes nothing the collector can see and
  the second group of the sheet is a lie.

## Module Structure

| Path                                                                               | Responsibility                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/data/orders/storeAccountAdjustmentMutations.ts`                           | `createStoreAccountAdjustment` (header plus its per-order lines, one transaction), `deleteStoreAccountAdjustment` (new module)                                                                                                                                            |
| `src/lib/data/orders/storeAccountAdjustmentQueries.ts`                             | `getStoreReconciliationPreview`, `listStoreAccountAdjustments`, including each adjustment's derived magnitude (new module)                                                                                                                                                |
| `src/lib/data/orders/orderMutations.ts`                                            | Extended: `editOrder`'s three guards count adjustment lines (`TOTAL_BELOW_PAID` against `declaredAgainstOrderMinor`, `STORE_CHANGE_BLOCKED` / `CURRENCY_CHANGE_BLOCKED` on "allocation OR line"), still decided before the first write (`FR-05-68`)                       |
| `src/lib/data/orders/storePaymentQueries.ts`                                       | Extended: the payment-validation ceiling (`getStoreDebtMinor` / `getStoreDebtByCurrency`) subtracts the adjustment-line term over its own base's scope. The collector-facing figure needs no change: `WO-09` built it on `openBalanceMinor` (see Derived Debt Arithmetic) |
| `src/components/modules/StoreReconciliationSheet/StoreReconciliationOrderList.tsx` | The per-order list the collector marks: one row per order, its own balance, settled / partial amount, in the two labelled groups                                                                                                                                          |
| `src/components/modules/StoreReconciliationSheet/**`                               | The reconciliation modal/sheet (new module, follows `modal-canonical-pattern.mdc`)                                                                                                                                                                                        |
| `src/app/[locale]/(app)/stores/[slug]/_components/StorePaymentsSection.tsx`        | Hosts the adjustment-history block, kept visually separate from the payments list                                                                                                                                                                                         |
| `src/app/[locale]/(app)/stores/[slug]/_components/StorePaymentProgressRows.tsx`    | Entry point / trigger surfaced at zero open orders, and elsewhere in the payment block                                                                                                                                                                                    |

Module paths must be validated against `.agents/rules/project-structure.mdc` and
`.agents/rules/prisma-data-layer.mdc` at implementation time.

## Unit Tests

### `createStoreAccountAdjustment`

| Scenario                                                                                 | Expected                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One open order of 100 unpaid, one line writing off its whole balance                     | One `StoreAccountAdjustment` with one line of 100 against that order, the declared reason, `adjustmentDate` = server today, zero allocation rows; the adjustment's read magnitude is 100                                                                                                                    |
| Same order, one line of 60 (a partial write-off)                                         | One line of 60, read magnitude 60; the order's `allocatedAmountMinor` cache does not change                                                                                                                                                                                                                 |
| Two open orders of 180 and 200, one line of 180 against the first                        | One line naming the first order only, read magnitude 180; the second order carries no line                                                                                                                                                                                                                  |
| **A `COMPLETED` order of 200 with a residue of 200, one line of 200 against it**         | **Accepted.** This is the back-catalogue case the whole feature exists for; the earlier `ORDER_NOT_OPEN` refusal made it impossible. The displayed store debt does not move (that order was already outside it), the payment ceiling drops by 200, and the diagnostic `FR-06-28` drops by 200               |
| A mixed declaration: one line on an open order, one on a delivered one                   | Both accepted in one transaction, one adjustment, two lines                                                                                                                                                                                                                                                 |
| A line against a `CANCELLED` order                                                       | Rejected with `ORDER_CANCELLED`, nothing written                                                                                                                                                                                                                                                            |
| No lines at all                                                                          | Rejected with `NO_ADJUSTMENT_NEEDED`, nothing written; the store's orders are **not** written off automatically                                                                                                                                                                                             |
| A line of 0                                                                              | Rejected with `AMOUNT_INVALID`                                                                                                                                                                                                                                                                              |
| A line larger than its own order's `openBalanceMinor`                                    | Rejected with `ADJUSTMENT_EXCEEDS_ORDER_BALANCE`, nothing written, including the lines that were valid                                                                                                                                                                                                      |
| A line against an order that already carries an earlier adjustment line                  | The ceiling is the balance **net of that earlier line**, so the same balance cannot be written off twice across two declarations                                                                                                                                                                            |
| A line against an order of another store, another currency, or another user              | Rejected with `NOT_FOUND`                                                                                                                                                                                                                                                                                   |
| The same order named by two lines of one declaration                                     | Rejected with `DUPLICATE_ORDER_LINE`; the `@@unique([adjustmentId, orderId])` constraint refuses it at the database level too                                                                                                                                                                               |
| `reason` omitted or empty string                                                         | Rejected with `REASON_REQUIRED`                                                                                                                                                                                                                                                                             |
| Client supplies an `adjustmentDate` other than today, or any total field                 | The date is ignored and the server's own today is written. There is no total field on the model to accept (`WO-10`), so a client that sends one cannot affect anything                                                                                                                                      |
| Store belongs to another user                                                            | Rejected with `NOT_FOUND`, nothing written                                                                                                                                                                                                                                                                  |
| Currency outside the allowed set                                                         | Rejected with `CURRENCY_INVALID`                                                                                                                                                                                                                                                                            |
| **The store holds 30 of parked money in this currency, and one open order of 180**       | Rejected with `STORE_HAS_UNASSIGNED_MONEY`, nothing written, even though the line of 180 is within its own order's ceiling. Reverting the refusal must reproduce the defect: the store's payment ceiling reads −30, the store prints "A favor 30", and the next payment is refused by `STORE_DEBT_EXCEEDED` |
| Parked money exists in **another** currency of the same store                            | Accepted: the refusal is scoped to the (store, currency) pair being reconciled, exactly like every other figure here                                                                                                                                                                                        |
| The parked money is assigned, then the same declaration is retried                       | Accepted, and the store's figures land where the assignment left them: the refusal is a precondition, never a permanent block on that store                                                                                                                                                                 |
| **An order is cancelled with the default `credit` choice, then the store is reconciled** | Rejected with `STORE_HAS_UNASSIGNED_MONEY`: `credit` deleted that order's allocations and left its `StorePayment` parked (`BR-05-15`). Re-declaring that money against another order and retrying is accepted. This is the documented cost of the default cancel branch, not a defect                       |

### Store debt with adjustments

| Scenario                                                                                                                                                       | Expected                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One open order of 100, unpaid, a line of 100 against it                                                                                                        | Displayed open-order debt is 0; the order's own remaining balance is still 100 and it keeps its "still owed" chip                                                                                                                                                                    |
| Same store, that order is then delivered (leaves the open-order figure)                                                                                        | Displayed open-order debt is 0, not −100: the line leaves with its order (`BR-05-26`)                                                                                                                                                                                                |
| **Two orders, one delivered after the adjustment (the sliding case).** A = 180 and B = 200, both open and unpaid; a line of 180 against A; then A is delivered | Before the delivery the figure is 200. **After the delivery it is still 200**, not 20: A left carrying its own debt and its own line, so the write-off can never move onto B. This is the case a single capped magnitude got wrong, and the only one where the failure is observable |
| Same pair, but the line is written against B instead, and A is delivered                                                                                       | Figure is 0 after the delivery: B is still open and still carries its line, so the write-off survives exactly as long as what it wrote off                                                                                                                                           |
| **A delivered order of 200 with a residue, written off after delivery**                                                                                        | The displayed open-order figure does not move (correct: that order is outside it), the payment ceiling drops by 200, and `FR-06-28` drops by 200. All three at once, from one line                                                                                                   |
| A line written today against an order created tomorrow                                                                                                         | Impossible by construction: a line names an existing order, so there is nothing to test beyond the `NOT_FOUND` refusal. No date comparison exists in either figure                                                                                                                   |
| An order with a back-dated `orderDate` (a Notion backfill or AI-captured order entered today, dated in May) is written off                                     | Behaves identically to any other order: `orderDate` takes no part in either figure                                                                                                                                                                                                   |
| Two declarations of 60 each against the same order of 100 of open balance                                                                                      | The second is refused at 60 and accepted at 40, because its ceiling is the balance net of the first line; the figure never goes negative from adjustments alone                                                                                                                      |
| Same store with a genuine overpayment                                                                                                                          | The negative "a favor" reading still comes through from payments, unchanged (`FR-05-43`)                                                                                                                                                                                             |
| A new payment is validated on a store with an adjustment                                                                                                       | The `STORE_DEBT_EXCEEDED` ceiling subtracts every line against a non-cancelled order, so written-off money cannot be paid twice, before **and** after the order is delivered                                                                                                         |
| The written-off order is cancelled                                                                                                                             | Its committed total and its line leave both figures together; neither is left behind (`BR-05-15` keeps the row, the scoping keeps it uncounted)                                                                                                                                      |
| The adjustment is deleted                                                                                                                                      | Its lines cascade away and both figures return exactly to their pre-adjustment values                                                                                                                                                                                                |
| **The adjustment on a delivered order is deleted, then written again**                                                                                         | Both work. The second declaration is accepted because a delivered order is still a legal target, which is what makes deletion reversible rather than a one-way door                                                                                                                  |

### The order-edit guards (`FR-05-68`)

Every case below must be red before the change and green after it. A guard that already passes with
the line term removed is testing nothing, because a line is not a `PaymentAllocation`.

| Scenario                                                                      | Expected                                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editing an order of 180 (allocation 50, line 100) down to a total of 120      | Rejected with `TOTAL_BELOW_PAID`: the comparison is against 150 (`50 + 100`), not against the 50 of `allocatedAmountMinor`. With the old comparison the edit passes and `openBalanceMinor` becomes −30 |
| Editing an order that carries **only** an adjustment line to another currency | Rejected with `CURRENCY_CHANGE_BLOCKED`. With the old `hasAllocations`-only condition the edit passes and the write-off crosses currencies                                                             |
| Editing an order that carries **only** an adjustment line to another store    | Rejected with `STORE_CHANGE_BLOCKED`. With the old condition the order moves and the line keeps reducing the store it left                                                                             |
| Editing an order that carries neither an allocation nor a line                | Unchanged in every respect: none of the three guards fires, so the widening costs an untouched order nothing                                                                                           |
| A refusal raised by any of the three                                          | Nothing is persisted: all three are decided before `editOrder`'s first write, so the transaction never carries a partial edit (`ADR 0022`)                                                             |
| The order's total is edited down to exactly `Σ allocations + Σ lines`         | Accepted, and `openBalanceMinor` lands on 0, never below it                                                                                                                                            |

### Concurrency

| Scenario                                                                                                           | Expected                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Two reconciliation declarations submitted simultaneously, both naming the same order of 100 with a line of 100** | Exactly one commits. The other is refused with `ADJUSTMENT_EXCEEDS_ORDER_BALANCE`, because the loser recomputes `openBalanceMinor` and finds 0. `@@unique([adjustmentId, orderId])` does **not** cover this: it only forbids naming an order twice inside ONE declaration, so two declarations would each write a legal line and the order would end up written off twice, for 200 against a balance of 100 |
| Two simultaneous declarations naming the same order for 60 each, against a balance of 100                          | One commits at 60; the other is refused rather than trimmed to 40. A reconciliation is a declaration the collector made against figures they were shown, so a silently reduced write-off is a number nobody declared: they re-open the sheet and see 40 left                                                                                                                                                |
| Two simultaneous declarations naming **different** orders of the same store                                        | Both commit: the per-order ceiling is the only contended resource, and they do not contend for it                                                                                                                                                                                                                                                                                                           |
| A reconciliation and a payment against the same order, submitted simultaneously                                    | Both are serialized by `runSerializableTransaction`, and whichever lands second sees the first in its own ceiling: the pair can never sum past the order's `totalCost`                                                                                                                                                                                                                                      |
| A reconciliation and a store payment being parked, submitted simultaneously                                        | Whichever reconciliation reads the pool after the parking is refused with `STORE_HAS_UNASSIGNED_MONEY`; one that read it before commits, and the parked money then sits against a store whose figure already dropped. The pair is serialized, so the refusal is deterministic per ordering, not per race                                                                                                    |

### `getStoreReconciliationPreview`

| Scenario                                                                  | Expected                                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two open orders and some unassigned money                                 | Preview lists both orders with their own remaining balance, plus the unassigned figure, and changes nothing                                       |
| **A store with zero open orders and three delivered ones with a residue** | All three are listed, in the delivered group. This is the store `ADR 0034` §7 nudges about; an empty preview here would make the nudge a dead end |
| An order already carrying an earlier line                                 | Its listed balance is net of that line, so the collector is never offered the same balance to write off twice                                     |
| A cancelled order with a balance                                          | Not listed at all: it is outside both figures, so there is nothing to square                                                                      |
| An order whose `openBalanceMinor` is already 0                            | Not listed: nothing to write off                                                                                                                  |
| Called twice in a row with no writes between                              | Identical result both times (read-only, idempotent)                                                                                               |

### `deleteStoreAccountAdjustment`

| Scenario                                             | Expected                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Delete an existing adjustment                        | Header and its lines removed; no `StorePayment` or `PaymentAllocation` row is touched |
| Delete an adjustment belonging to another user       | `NOT_FOUND`, nothing removed                                                          |
| Delete an adjustment, then the real payment surfaces | Recording the real payment afterward behaves exactly like any other payment           |

### Dashboard isolation (regression guard)

| Scenario                                                 | Expected                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A store carries an adjustment dated in the current month | Every `BR-06-04` figure (disbursed this month, spend by month, spend by type, top stores, consumed budget) is unchanged |
| The same adjustment's lines are read as allocations      | They are not: no `PaymentAllocation` row exists, and the order's own payment ledger shows nothing                       |

## E2E Acceptance Tests

- With a store fully settled and no order carrying a balance, the reconciliation sheet is offered
  from the payment block, the preview shows nothing left to explain, and the sheet says there is
  nothing to adjust rather than offering a write.
- A store with two open orders and a genuine data-entry gap shows both orders' own balances in the
  preview before the adjustment control is reachable; marking only the first order as settled and
  submitting with reason "not identified" succeeds, the store's debt figure drops to the second
  order's balance, and each order keeps showing its own balance on its own detail.
- Continuing from that same store: delivering the order that was written off leaves the store's
  figure on the second order's balance, unchanged. The write-off does not move onto the survivor,
  which is the behaviour the per-order lines exist for.
- **The back-catalogue pass, end to end.** A store with **zero open orders** and three delivered
  orders still carrying balances is nudged to reconcile; the sheet lists all three under the
  delivered group, "todo saldado" marks them at once, and the submit succeeds with one adjustment
  carrying three lines. The store's displayed debt was already zero and stays zero, the dashboard's
  "pagos que no registraste" figure drops by the three balances, and a payment against any of those
  orders is now refused. Under the earlier open-orders-only rule this entire flow was impossible:
  the sheet had no rows.
- Submitting the sheet without marking anything is refused with no write, and the sheet explains
  there is nothing to adjust.
- An adjustment appears in the store's own adjustment history, labelled as an adjustment and never
  inside the payments list; deleting it restores the store's debt figure to what it was immediately
  before it was written, and the same declaration can be made again afterwards.
- After writing an adjustment, the dashboard's "Desembolsado este mes" and consumed-budget figures
  are unchanged, which is the whole reason the adjustment is not a payment.
- The reconciliation action is never offered as the first control on the payment block; the
  breakdown of orders and unassigned money is always shown first.
- A store holding an unassigned payment cannot be reconciled at all: the sheet names the amount and
  offers the assignment instead of the write (`FR-05-69`), and a submit forced past the UI is
  refused with `STORE_HAS_UNASSIGNED_MONEY`. Assigning that payment and reopening the sheet makes
  the reconciliation available, on figures that now count the assignment.
- Cancelling an order with the default `credit` choice and immediately trying to square that store
  reaches the same refusal, with the freed amount named in the sheet, and re-declaring that money
  unblocks it.
- Continuing the two-order store: after the written-off order is delivered, a real payment for the
  full balance of the surviving order is **accepted**. This is the other half of the sliding case,
  and the one that costs real money if the ceiling double-counts: with the store at A = 180 written
  off and B = 200 open, the payment ceiling reads 200 and B's payment of 200 goes through.
- An order carrying an adjustment line cannot have its total lowered below the write-off, cannot be
  moved to another store, and cannot be restated in another currency: all three are refused from the
  order's own edit form with its existing copy (`FR-05-68`).

## Notes

- **Two simultaneous declarations against the same order are not covered by the unique constraint,
  and the test suite must say so.** `@@unique([adjustmentId, orderId])` forbids naming an order
  twice inside ONE declaration; it says nothing about two declarations racing, where each writes a
  legal single line and the order ends up written off twice. What holds the invariant there is the
  serializable transaction plus the per-order ceiling recomputed inside it, which is a different
  mechanism, so it needs its own case (see Concurrency).
- The two-order test is the one this feature most needs, and it is the one an earlier draft did not
  have: with a single order, a write-off that outlives its order and one that dies with it produce
  the same number, so the sliding failure is invisible. Any future test suite that covers
  reconciliation with one order only is not covering it.
- **An adjustment is invisible to the dashboard's spend figures on purpose (`BR-06-04`), and
  deliberately visible to its diagnostic one.** An earlier draft of this work order stated that a
  reconciliation "does not silence the diagnostic; it was never meant to", on the reasoning that
  nobody ever paid that order. That was a consequence of restricting lines to open orders, not a
  decision: once a delivered order can be named, writing off its balance is precisely the collector
  saying "this is not a payment I forgot to record", which is the sentence `FR-06-28` is asking. The
  diagnostic therefore drops by the line, and it is the only figure a back-catalogue pass moves.
