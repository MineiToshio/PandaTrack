---
id: WO-10
type: WORK_ORDER
slug: order-open-balance-and-store-account-adjustment-model
title: Order Open Balance and Store Account Adjustment Model
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-08-20
implementation_status: IMPLEMENTED
---

# WO-10 Order Open Balance and Store Account Adjustment Model

## Summary

The persistence and the arithmetic the store reconciliation feature stands on, and nothing the
collector can see. Two things ship here:

1. **The two models a reconciliation adjustment is made of**, `StoreAccountAdjustment` and its per
   order line table `StoreAccountAdjustmentLine`, plus their migration (`ADR 0034` §2, §3). Nothing
   writes a row into them in this work order.
2. **The canonical open balance of an order**, `src/lib/data/orders/orderOpenBalance.ts`, because
   the line those models introduce is a **third term** in that balance and every path that bounds
   money against an order predates it (`BR-05-32`, `ADR 0034` §3.1). The seventh and last consumer,
   the per order allocation ceiling `EXCEEDS_BALANCE`, is migrated to it here, in the same work
   order that owns the module.

**Work order numbers are identifiers, not an execution order.** This work order is `WO-10` and it
lands **before** `WO-09` on purpose: it depends on nothing else in the 2026-08-20 package, while
`WO-09` and `WO-11` both need the models and the module it introduces. The sequence is declared once,
in [`BP-01`](../bp-01-order-domain-foundation.md)'s `## Implementation Plan`, and every work order
in the package cites it rather than restating it.

**What was split out of this work order, and why.** An earlier draft carried the whole
reconciliation feature, and it declared that `WO-09` had to land first while `WO-09` declared the
opposite. The dependency was real in both directions but never between the same pieces: the action
needs `WO-09`'s `getUnassignedStoreMoneyMinor` for one refusal, and `WO-09`'s figures need this
work order's models and canonical balance. Splitting the artefact splits the cycle: the model and
the arithmetic here (dependency free), the action and its surface in
[`WO-11`](./wo-11-store-account-reconciliation-action.md) (after `WO-09`).

**Form decision A (taken by `ADR 0034` §3, recorded here, not owned here): the adjustment carries
one line per order it writes off.** Each line names an order and an amount, capped at that order's
own open balance. The line is what makes the adjustment obey the rule the rest of this package
already obeys (`BR-05-26`): what reduces an order's debt leaves the store figure **when the order
leaves it**. A store-level magnitude bounded by a temporal cap (`orderDate <= adjustmentDate`), the
earlier draft of this work order, slides onto the orders that survive the delivery of the one it
wrote off, and understates the store by exactly that order's balance. See Technical Notes for the
worked case and for why the cap could never have been fixed.

**Form decision B (taken by `ADR 0034` §2, recorded here, not owned here): the adjustment is its own
model, with its own line table. It is never a `StorePayment` carrying a `reconciliationReason` flag,
and its lines are never `PaymentAllocation` rows.** The decisive reason is arithmetic and it comes
from another domain: [`FRD-06`](../../../frd-06-dashboard/frd-06-dashboard.md)'s `BR-06-04` defines
dashboard spend as `PaymentAllocation.amountMinor` grouped by its parent `StorePayment.paymentDate`,
so a flagged payment row would enter "Desembolsado este mes", the monthly spend chart, spend by type,
top stores and **consumed budget** as disbursed cash. A PEN 180.00 write-off that moved no money
would eat PEN 180.00 of the collector's monthly budget. A separate model is outside that query by
construction, and a line in the adjustment's own table is outside it for the same reason: a line
scopes a write-off to an order so it dies with it, it never credits that order with a payment
nobody made.

**Form decision C (taken by `ADR 0034` §3.1, and the reason this work order reaches outside its own
feature): one canonical open balance, in one module, with seven mandatory consumers.**
`openBalanceMinor(order) = totalCost − Σ allocations − Σ adjustment lines` (`BR-05-32`). Two
consumers were already net; five were computing a gross balance that stops at the allocations. A
gross consumer does not merely print a wrong number: the settle-on-arrival one authors a real
`StorePayment` for a balance that was already written off, and the allocation ceiling migrated here
lets that same balance be paid a second time by hand.

## Prerequisites

- None inside the 2026-08-20 package. This work order reads no figure introduced by `ADR 0032`,
  `ADR 0033` or `ADR 0034`, and it is the first of the four to land.
- It does depend on what is already in the repository: the order model and totals
  ([`WO-02`](./wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)) and the
  store-level payment machinery that succeeded
  [`WO-03`](./wo-03-order-payments-balances-and-payment-mutation-rules.md) (`StorePayment` +
  `PaymentAllocation`, migration `20260808215744`), both implemented.

## In Scope

- Two new Prisma models, `StoreAccountAdjustment` and `StoreAccountAdjustmentLine`, plus their
  migration (`FR-05-64`, `FR-05-65`, `BR-05-29`, `BR-05-30`):
  - `StoreAccountAdjustment` (the declaration, one per reconciliation):
    - `id`, `storeId` (FK `Store`, `onDelete: Cascade`), `userId` (FK `User`, `onDelete: Cascade`,
      duplicated per `.agents/rules/data-layer-user-id-duplication.mdc`)
    - `currencyCode String`: the currency the adjustment squares, validated against the same
      `ALLOWED_COLLECTOR_BASE_CURRENCY_CODES` allowlist every other money field in this domain uses.
      A store's account is reconciled per currency, never across currencies
    - `adjustmentDate DateTime`: always the server's own today, never taken from the client
      (`BR-05-29`)
    - `reason String`: required and non-empty, "no identificado" included (`FR-05-65`)
    - `createdAt`, `updatedAt`
    - **no stored total.** The adjustment's magnitude is `Σ` of its own lines, **derived at read
      time and never persisted** (see Technical Notes: a stored copy is an invariant the order
      deletion cascade breaks on its own)
    - indexes `@@index([userId])`, `@@index([storeId])`, `@@index([userId, storeId, currencyCode])`
      (the reconciliation read is always store plus currency), `@@index([userId, adjustmentDate])`
      (the per-store history list, newest first); `@@map("store_account_adjustment")`
  - `StoreAccountAdjustmentLine` (what the adjustment writes off, per order, `ADR 0034` §3):
    - `id`, `adjustmentId` (FK `StoreAccountAdjustment`, `onDelete: Cascade`: deleting the
      declaration deletes what it declared), `orderId` (FK `Order`, `onDelete: Cascade`: a deleted
      order takes its whole money trail with it), `userId` (duplicated, same rule as above)
    - `amountMinor Int`: what this adjustment writes off **on that order**, always `> 0` and never
      greater than that order's own `openBalanceMinor` at write time. May be **partial**
    - `createdAt`
    - `@@unique([adjustmentId, orderId])` (one line per order per declaration, so a magnitude can
      never be reached by stacking two lines on the same order), `@@index([userId, orderId])` (the
      debt figures read lines by order), `@@index([adjustmentId])`;
      `@@map("store_account_adjustment_line")`
  - a hand-written `CHECK (amount_minor > 0)` in the migration SQL **on the line table**, since the
    Prisma schema language cannot express a check constraint. This is the guarantee
    `StorePayment.amount` gave for free and that this model has to state for itself (`ADR 0034` §5).
    The header needs no such constraint because it stores no amount: its magnitude is the sum of
    lines that are each individually constrained positive, so it is positive whenever a line exists
    and zero when none does
  - **no relation to `PaymentAllocation`** on either table: a line records that a balance was
    written off, not that money arrived, so it must stay outside every allocation-based figure
    (`BR-06-04`) and outside the order's own payment ledger (`ADR 0025`, `ADR 0034` §9)
- **`src/lib/data/orders/orderOpenBalance.ts`, the canonical open balance** (`BR-05-32`,
  `ADR 0034` §3.1). This work order introduces the third term, so it owns the definition:
  - `openBalanceMinor(order)` = `totalCost − Σ PaymentAllocation.amountMinor − Σ StoreAccountAdjustmentLine.amountMinor`,
    the ceiling on anything new that may still be written against that order
  - its complement `declaredAgainstOrderMinor(order)` = `Σ allocations + Σ lines` =
    `totalCost − openBalanceMinor(order)`, what the order-edit guards bound (`FR-05-68`, applied in
    [`WO-11`](./wo-11-store-account-reconciliation-action.md))
  - the allocations term reads the order's existing `allocatedAmountMinor` cache, the same source
    every current ceiling already uses, so the only thing the migration of a caller changes is the
    **new** subtrahend
  - both accept a `Prisma.TransactionClient`, so a caller inside an open transaction (`editOrder`,
    `createStorePayment`, the settlement write) reads the same figure the read paths do
  - a batch form for the callers that hold several orders at once (the reconciliation preview, the
    dashboard rollups, a multi-line payment), so migrating a caller never turns one query into N
- **The seventh consumer: `EXCEEDS_BALANCE`, migrated to the canonical module here** (`BR-05-32`,
  `ADR 0034` §3.1). In `src/lib/data/orders/storePaymentMutations.ts` the per order allocation
  ceiling compares in **gross**: `order.allocatedAmountMinor + pendingForOrder > order.totalCost`.
  It becomes `pendingForOrder > openBalanceMinor(order)`, which is the same comparison with the
  third term restored. This is the last defence against paying a written-off balance a second time
  **by hand**, from the order form or the store payment sheet, and an earlier draft of this work
  order listed that file as "Untouched". It is owned here rather than by
  [`WO-11`](./wo-11-store-account-reconciliation-action.md) because this work order owns the
  canonical module, and migrating the ceiling is what proves the module is the single definition
  rather than a fourth copy of it. It is safe to land this early precisely because no line row can
  exist yet: on the day it ships the migration is behaviour-preserving, and the ceiling is already
  net by the time the first line is written
- Unit coverage for the module and for the migrated ceiling (see Unit Tests), including the red
  case that proves the ceiling was gross before

## Out of Scope

- **Everything the collector can reach.** The reconciliation action, its preview, its sheet, its
  per-store history, the delete mutation and the "nothing left open" nudge all belong to
  [`WO-11`](./wo-11-store-account-reconciliation-action.md). This work order creates two tables that
  stay empty until `WO-11` ships.
- The three order-edit guards (`FR-05-68`). They are the fourth gross consumer, and they matter only
  once a line can exist, so they land with the write that creates one, in
  [`WO-11`](./wo-11-store-account-reconciliation-action.md).
- The adjustment-line term in the two store debt figures. Both figures belong to
  [`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md), which lands after this work
  order and before `WO-11`; the term itself is added by
  [`WO-11`](./wo-11-store-account-reconciliation-action.md), which is when the first line can exist.
- The settle-on-arrival amount
  ([`FRD-08 · WO-08`](../../../frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md)),
  the parked-money consumption on order close
  ([`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md), `FR-05-62`) and the
  dashboard's obligation figures
  ([`FRD-06 · WO-07`](../../../frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md)).
  Three of the five gross consumers live in other work orders; each imports this module rather than
  re-deriving the balance.
- Any change to the dashboard's **spend** figures. An adjustment is deliberately invisible to every
  `PaymentAllocation` based figure (`BR-06-04`), and that invisibility is the point of the model
  shape, not an omission to fix later.

## Requirements

- `BR-05-30`, `BR-05-32` (owned in full here)
- `FR-05-64`, `FR-05-65`, `BR-05-29` (the record's **shape** only; the behaviour that writes it is
  [`WO-11`](./wo-11-store-account-reconciliation-action.md)'s)

## Blueprints

- `BP-01` order open balance contract (new)
- `BP-01` reconciliation adjustment contract (new, model half)
- `BP-01` architecture decision: the reconciliation adjustment is its own model, not a tagged
  `StorePayment` (`ADR 0034`)

## Validation Contract

| Rule                                                                                            | Error code                            | Enforcement point                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A line's `amountMinor` is strictly positive, declared by this model rather than inherited       | none (database level)                 | hand-written `CHECK (amount_minor > 0)` on `store_account_adjustment_line`                                               |
| One order may be named at most once inside one declaration                                      | none (database level)                 | `@@unique([adjustmentId, orderId])`                                                                                      |
| A new allocation may not exceed its order's canonical open balance, lines included (`BR-05-32`) | `EXCEEDS_BALANCE` (existing, widened) | `validateAllocations` in `storePaymentMutations.ts`, before the first write: `pendingForOrder > openBalanceMinor(order)` |

Only the third row is a behaviour change, and it changes what an existing code compares, never its
name or its copy. Every refusal that belongs to writing an adjustment (direction, store ownership,
currency, the per line ceiling, the parked-money precondition, the reason) lives in
[`WO-11`](./wo-11-store-account-reconciliation-action.md), with the mutation that raises it.

## Technical Notes

**The header stores no total, and that is a correction, not a simplification.** An earlier draft
gave `StoreAccountAdjustment` an `amountMinor` column with the invariant "always equal to the sum of
its own lines". Two ordinary events break it, and neither has any code that would notice:

```text
Adjustment of 380.00, two lines: A = 180.00, B = 200.00.

Collector deletes order A (deleteOrder, permitted: no live delivery links).
  A's line cascades away with the rest of A's money trail.
  Stored header = 380.00. Σ lines = 200.00. The invariant is now false, silently.

Collector deletes order B as well.
  Stored header = 380.00. Σ lines = 0.00. A declaration that writes nothing off, carrying a
  positive magnitude, listed in the store's history as if it had squared 380.00.
```

Keeping the stored copy honest would need a delete hook on `Order` that re-totals every adjustment
touched by the cascade, which is new code whose only job is to maintain a number that can be
computed. Deriving it removes the invariant instead of defending it: an adjustment's magnitude is
`Σ` of the lines that exist right now, so a cascade lowers it to exactly what is left and an
adjustment whose lines have all gone derives **zero**. That husk is harmless: it subtracts nothing
from any figure (there are no lines to subtract), it stays readable in the store's history with its
own date and reason, and it is deletable like any other. Nothing has to clean it up.

The derivation also closes the direction hole the same draft left open: with no stored total there
is no field for a caller to inflate, so the "the total cannot disagree with its lines" half of
`BR-05-30` stops being a rule someone enforces and becomes a property of the shape.

**A line may name any non-cancelled order, delivered ones included** (`ADR 0034` §3, `FR-05-64`).
This is the difference between a feature that works and one that cannot be reached. The natural
moment to square a store is when it has **nothing open left** (`ADR 0034` §7), and 522 of the
collector's 565 orders are already `COMPLETED`. An open-orders-only rule would mean that at exactly
the moment the app offers to reconcile, the sheet has no candidates and the write is impossible,
while the back catalogue that motivated the whole feature stays unreachable forever. The model
therefore constrains nothing beyond the FK: which orders a line may name is the mutation's rule
(`WO-11`), and the only status it refuses is `CANCELLED`.

What a line means does not change with the order's status, and neither does its ceiling. What
changes is which figure moves:

| The line names        | `openBalanceMinor` ceiling | Displayed store debt (`FR-05-61`) | Payment ceiling (`FR-05-63`) | Diagnostic (`FR-06-28`) |
| --------------------- | -------------------------- | --------------------------------- | ---------------------------- | ----------------------- |
| an **open** order     | same definition            | drops by the line                 | drops by the line            | unaffected              |
| a **completed** order | same definition            | unaffected (already outside it)   | drops by the line            | drops by the line       |

Both readings are honest and they say the same sentence: this balance was never really owed.

**Why `EXCEEDS_BALANCE` is the seventh consumer and not a nice-to-have.** The other four gross
consumers are figures or automatic amounts. This one is the ceiling on money the collector types by
hand, which is the most likely way a written-off balance gets paid twice:

```text
Order A of 180.00, unpaid, written off by a line of 180.00. openBalanceMinor(A) = 0.

GROSS ceiling (today)  order.allocatedAmountMinor + pending > order.totalCost
                       0 + 180.00 > 180.00 is false, so a hand-typed allocation of 180.00 against A
                       is ACCEPTED. Real money, on a balance the collector already declared was not
                       owed, and it lands in the dashboard's spend and consumed-budget figures.

NET ceiling            pending > openBalanceMinor(A)
                       180.00 > 0 is true, so it is refused with EXCEEDS_BALANCE, the code and copy
                       the collector already knows.
```

**Non-negative by construction, and never clamped** (`BR-05-32`). Each of the three terms is bounded
against this same figure before it is written: an allocation by `EXCEEDS_BALANCE` (migrated here), a
line by `ADJUSTMENT_EXCEEDS_ORDER_BALANCE` (`WO-11`), and the order's total by `TOTAL_BELOW_PAID`
(widened in `WO-11`). The subtrahends therefore cannot sum past `totalCost`. If the figure is ever
negative, a ceiling was bypassed and real money was counted twice, so it is **rendered, never
clamped**: a `Math.max(0, ...)` would turn the one loud symptom of a double count into silence, and
`BR-05-28` names the understatement nobody notices as the failure that ruins the books. No surface
in this work order, and none in `WO-11`, clamps this figure.

**Two readings of one order, and only one of them bounds a write.** `openBalanceMinor` is the
**writable** balance and the term every aggregate of what a store is owed is built from. It is
deliberately **not** the balance an order's own detail prints: an adjustment squares the store's
account, it does not pay the order, so the order keeps showing `totalCost − Σ allocations` and keeps
its "still owed" chip (`FR-05-35`). "Did anyone pay this?" stays gross; "may anything still be
written against this?" is net.

**Form decision: lines per order, not a store-level magnitude with a cap.** `ADR 0034` §3 chose the
lines. The rejected shape and why it cannot be patched:

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

The old figure was wrong in the direction `BR-05-28` calls the one that ruins the books quietly: it
understated. The temporal half of the bound could not have been repaired either, because `orderDate`
is not a system fact. It is retro-datable by the collector, and both the Notion backfill and AI
order capture routinely record orders dated in the past, so an order entered in September about a
May purchase falls inside a cap written in June. The prose ("orders that already existed when the
adjustment was written") and the formula (`orderDate <= adjustmentDate`) never described the same
set. Scoping by line retires the cap, the drain order and any snapshot of the debt at once.

**Form decision: a new model, not a tagged `StorePayment` row.** A tagged row needed exactly one new
nullable column and inherited every debt computation, the allocation ceilings, `deleteStorePayment`
and the store's existing payment list. That inheritance is the defect, not the benefit:
`BR-06-04` reads `PaymentAllocation.amountMinor` by its parent `StorePayment.paymentDate` as
**disbursed cash**, so every adjustment would arrive in the dashboard's spend figures and in consumed
budget as money the collector spent. Excluding it would mean every present and future reader of a
payment remembering the flag, and the first one that forgets prints money that never left. The price
of the separate model is that the pair inherits nothing: its own delete mutation, its own history
query, its own positivity constraint, and an explicit subtrahend in both store debt figures. Every
one of those is written in [`WO-11`](./wo-11-store-account-reconciliation-action.md). The trade is
accepted because a debt figure that forgets to subtract lines fails loudly (the collector squares up
and the number does not move), while a budget figure inflated by phantom disbursements fails
silently.

**Nothing in this work order is reachable, and that is deliberate.** Landing the models and the
canonical balance ahead of `WO-09` means the figures `WO-09` builds are net from their first line of
code, instead of being written gross and migrated a work order later. The tables stay empty until
`WO-11`, so the only observable change on the day this lands is the widened `EXCEEDS_BALANCE`
comparison, which is arithmetically identical while no line exists.

## UX Notes

None. This work order adds no surface, no copy and no user-visible behaviour. The one code path a
collector can reach through it, the `EXCEEDS_BALANCE` ceiling, keeps its existing error code and its
existing copy on purpose: the ceiling is being told about a third term, not being replaced, so the
message the collector already knows stays correct.

## Security Notes

- `StoreAccountAdjustment.userId` and `StoreAccountAdjustmentLine.userId` are both duplicated onto
  the row (`.agents/rules/data-layer-user-id-duplication.mdc`). The line carries its own copy
  because the debt figures read lines **by order**, without joining back through the header.
- `orderOpenBalance.ts` derives a figure from rows the caller already resolved; it performs no
  authorization of its own and must never be used as one. Every caller resolves the order against
  `{ userId, ... }` first, exactly as it does today.
- The models ship with no mutation, so no client input reaches them in this work order. The
  ownership checks that guard the write live with the write, in
  [`WO-11`](./wo-11-store-account-reconciliation-action.md).

## Assumptions

- `writeStorePaymentWithAllocations` and `deleteStorePayment` are **not** reused. This work order
  writes no `StorePayment` and no `PaymentAllocation` row, and it never touches
  `Order.allocatedAmountMinor`. It does modify `validateAllocations`, inside
  `storePaymentMutations.ts`, for the seventh consumer above; that file is **not** untouched by this
  package, and an earlier draft that said so was wrong.
- **The delivery and cancel paths need no change for the two debt FIGURES, and that is as far as
  that statement goes.** Both figures scope their line term to the orders they already sum over, so
  a delivered or cancelled order takes its line out of the sum without any figure-level code that
  knows adjustments exist. The sentence is **false of the amounts**: the line is a third term
  (`BR-05-32`), and every path that computes an amount **to write** against an order must subtract
  it. The real list is the seven consumers of the canonical `openBalanceMinor`, five of which were
  computing a gross balance before this package:
  1. the settle-on-arrival amount, on the delivery path
     ([`FRD-08 · WO-08`](../../../frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md)),
     which becomes net, so an order already written off offers zero and its checkbox never renders;
  2. the parked-money consumption when an order closes
     ([`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md), `FR-05-62`), also on the
     delivery path, which becomes net so parked money never lands on a balance already written off;
  3. the dashboard's obligation figures
     ([`FRD-06 · WO-07`](../../../frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md)),
     which become net so the panel and the store detail stop printing different numbers after a
     reconciliation, and so a line written against a delivered order clears the diagnostic figure it
     was written to explain (`FR-06-28`);
  4. the three order-edit guards in `src/lib/data/orders/orderMutations.ts` (`FR-05-68`), applied in
     [`WO-11`](./wo-11-store-account-reconciliation-action.md);
  5. **the per order allocation ceiling `EXCEEDS_BALANCE`, migrated in this work order**, which is
     the only one of the five that bounds money the collector types by hand;
  6. the ceiling on each new adjustment line ([`WO-11`](./wo-11-store-account-reconciliation-action.md)),
     already net, which now cites `BR-05-32` instead of carrying its own formula;
  7. the collector-facing store debt figure
     ([`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md), `FR-05-61`), already net,
     same.

  If a future change ever reads the line term over a different set of orders than the payments term
  beside it, the sliding failure this package removed comes straight back; and if an eighth consumer
  appears that bounds money against an order without importing `openBalanceMinor`, the
  double-payment failure comes back with it.

## Module Structure

| Path                                           | Responsibility                                                                                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma` + migration             | New `StoreAccountAdjustment` and `StoreAccountAdjustmentLine` models, their indexes and unique constraint, and the hand-written `CHECK (amount_minor > 0)` on the line table. The header stores no amount      |
| `src/lib/data/orders/orderOpenBalance.ts`      | New: the canonical `openBalanceMinor`, its complement `declaredAgainstOrderMinor`, and a batch form, all accepting a `Prisma.TransactionClient` so an in-transaction caller reads the same figure (`BR-05-32`) |
| `src/lib/data/orders/storePaymentMutations.ts` | Extended, **not untouched**: `validateAllocations`' per order ceiling compares `pendingForOrder` against `openBalanceMinor(order)` instead of `allocatedAmountMinor + pending > totalCost` (`EXCEEDS_BALANCE`) |

Module paths must be validated against `.agents/rules/project-structure.mdc` and
`.agents/rules/prisma-data-layer.mdc` at implementation time.

## Unit Tests

### `openBalanceMinor` and `declaredAgainstOrderMinor`

| Scenario                                                       | Expected                                                                                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order of 180, no allocations, no lines                         | `openBalanceMinor` is 180, `declaredAgainstOrderMinor` is 0                                                                                                 |
| Order of 180, one adjustment line of 180                       | `openBalanceMinor` is 0 and `declaredAgainstOrderMinor` is 180, while the order's own detail balance stays 180 and keeps its "still owed" chip (`FR-05-35`) |
| Order of 180 with an allocation of 50 and a line of 100        | `openBalanceMinor` is 30: all three terms, one definition, one module                                                                                       |
| A `COMPLETED` order of 200 with a line of 200                  | `openBalanceMinor` is 0. The definition does not read the order's status, which is what lets a delivered order be written off at all (`FR-05-64`)           |
| The same order read inside a transaction and outside it        | Identical result: the transaction client form and the plain form share one implementation                                                                   |
| A batch read of ten orders                                     | Same per order results as ten single reads, in a bounded number of queries                                                                                  |
| An order whose terms would sum past its total (forced fixture) | The negative figure is returned as computed, **not** clamped to zero (`BR-05-32`); a test asserting `>= 0` here would be asserting the bug                  |

### `EXCEEDS_BALANCE`, the seventh consumer

Every case below must be **red before the change and green after it**. A case that already passes
with the line term removed is testing nothing, because a line is not a `PaymentAllocation`.

| Scenario                                                                         | Expected                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Order of 180, unpaid, one line of 180, an allocation of 180 declared against it  | Refused with `EXCEEDS_BALANCE`. With the gross comparison the allocation is **accepted**, and real money is spent on a balance the collector declared was not owed |
| Same order, one line of 100, an allocation of 80                                 | Accepted: 80 is exactly `openBalanceMinor`                                                                                                                         |
| Same order, one line of 100, an allocation of 81                                 | Refused with `EXCEEDS_BALANCE`                                                                                                                                     |
| Order with allocations only, no lines anywhere                                   | Behaves exactly as before the change, code and copy included: the migration is behaviour-preserving while no line exists                                           |
| Two allocation lines in one payment against the same written-off order           | The accumulated `pendingForOrder` is compared against the same net ceiling, so the pair cannot slip past it one line at a time                                     |
| A `COMPLETED` order carrying a line, receiving a late payment above what is left | Refused with `EXCEEDS_BALANCE`; a late payment **within** the remaining net balance is still accepted (`FR-05-63` keeps late payments possible)                    |

### Model constraints

| Scenario                                                      | Expected                                                                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A raw insert attempts a line of 0 or a negative amount        | The database `CHECK` refuses it, proving the constraint is not merely application-level                                                 |
| A raw insert names the same order twice inside one adjustment | Refused by `@@unique([adjustmentId, orderId])`                                                                                          |
| An order carrying a line is physically deleted                | Its line cascades away; the adjustment header survives and its derived magnitude drops by exactly that line                             |
| Every order of an adjustment is deleted                       | The header survives with zero lines and a derived magnitude of **0**; it subtracts nothing anywhere and is still readable and deletable |
| The adjustment header is deleted                              | Its lines cascade away with it                                                                                                          |
| The store is deleted                                          | Its adjustments and their lines cascade away with it                                                                                    |

## E2E Acceptance Tests

None. This work order adds no reachable surface, so there is no flow to drive. The one behaviour a
collector could observe, the widened `EXCEEDS_BALANCE` ceiling, is arithmetically identical until a
line exists, and no line can exist until
[`WO-11`](./wo-11-store-account-reconciliation-action.md) ships. The end-to-end coverage of the
reconciliation flow, including the payment that must be refused on a written-off order, lives there.

## Notes

- **This work order depends on nothing else in the package, and that is the point of splitting it
  out.** Its predecessor declared `WO-09` as a prerequisite while `WO-09` declared the opposite, a
  cycle that blocked implementation of either. The pieces were never mutually dependent: what the
  action needs from `WO-09` is one figure for one refusal, and that need moved to
  [`WO-11`](./wo-11-store-account-reconciliation-action.md) with the action itself.
- The migration here is the **only** schema change in the 2026-08-20 package on this blueprint's
  side; [`WO-09`](./wo-09-store-payment-assignment-and-open-order-debt.md) needs none, and
  [`WO-11`](./wo-11-store-account-reconciliation-action.md) needs none either.
- The seventh consumer was found late, after the six-consumer list was already written into
  `BR-05-32` and `ADR 0034` §3.1. That is the argument for keeping the list explicit rather than
  trusting a reviewer to notice: the checklist is what makes an eighth one findable.
