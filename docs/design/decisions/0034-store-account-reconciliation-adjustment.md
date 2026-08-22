---
title: "ADR 0034 - Squaring up with a store is an explicit adjustment dated today, never a rewrite of the past"
date: 2026-08-20
status: accepted
session: saldar al recibir + cuadre de caja (spec approved by the collector 2026-08-20, four red-team passes)
owner: Sergio Minei
trigger: even with debt scoped to open orders (ADR 0033) and settlement riding on delivery (ADR 0032), the app's belief about a store can still disagree with reality, and the collector has no way to say "I actually owe this store nothing". The gap is not recoverable from history: 96.3% of the payment rows are a 1:1 Notion backfill that fused advance and balance into a single row
updates: docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/bp-01-order-domain-foundation.md, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-10-order-open-balance-and-store-account-adjustment-model.md, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-11-store-account-reconciliation-action.md, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-09-store-payment-assignment-and-open-order-debt.md, docs/product/prd-02-collector-app/frd-08-delivery-management/frd-08-delivery-management.md, docs/product/prd-02-collector-app/frd-08-delivery-management/bp-01-delivery-management/bp-01-delivery-management.md, docs/product/prd-02-collector-app/frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md, docs/product/prd-02-collector-app/frd-06-dashboard/frd-06-dashboard.md, docs/product/prd-02-collector-app/frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/bp-01-dashboard-aggregation-and-surface.md, docs/product/prd-02-collector-app/frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md, docs/product/glossary.md
extends: ADR 0033 (store debt scoped to open orders), ADR 0025 (store-level payments with declared allocations)
---

# ADR 0034 - Squaring up with a store is an explicit adjustment dated today, never a rewrite of the past

**Implemented 2026-08-20 (uncommitted, staging), via `FRD-05 · WO-10` and `WO-11`.** It records a
decision the collector approved on 2026-08-20. The requirements live in `FRD-05` (`FR-05-64` …
`FR-05-66`, `FR-05-68`, `FR-05-69`, `BR-05-29`, `BR-05-30`, `BR-05-32`).

## Context

ADR 0032 removes the most common reason a balance goes unrecorded (the balance paid at handover) and
ADR 0033 stops an old error from contaminating a store's figure forever. Neither can make the app's
belief TRUE. What is left is the residue: a store where the app says PEN 180.00 is outstanding and
the collector knows the account is clean.

That residue is not reconstructible from the data, and the reason is specific. **96.3% of all
payment rows come from the 1:1 Notion backfill**, which collapsed advance and balance into one row
per order. Those rows record an amount, not an event sequence, so no query can decide whether a
remaining balance on such an order is a real debt or the half of a payment the backfill never had.
In the native population the shape is different (73.9% carry two payments), but it is **7 orders**.

The rest of the census frames how often this is needed and how cheaply it can be cleared:

- **522 of 565 orders are completed**, so most stores currently have nothing open at all. A "square
  up" pass would seal the majority of the collector's 100+ stores in one sitting.
- Live debt is **PEN 6,389.00** across 24 open orders plus 3 partially delivered ones; **USD 0**.
- **0 orders are delivered with an outstanding balance** today, so the diagnostic figure ADR 0033
  introduces ("pagos que no registraste") currently reads zero. The day it does not, this is the
  tool that closes it.
- **0 money is unassigned across 122 (store, currency) pairs**, so the "did you forget to assign
  something?" step will usually have nothing to show, which is exactly when an adjustment is the
  honest remaining explanation.

Established bookkeeping has a name and a shape for every part of this, and the decision below is
mostly a matter of adopting them rather than inventing:

- A **suspense account** parks money whose imputation is unknown (already adopted by ADR 0033 §5b as
  parked money).
- A **cash over and short** account absorbs the difference between counted cash and expected cash in
  retail, and its real value is as a **pattern detector** across periods, not as a cleanup.
- A **bank reconciliation adjustment** closes the residual gap between a statement and the ledger.
  QuickBooks names its own account for this **"Reconciliation Discrepancies"** and warns in its own
  documentation that forcing one should be a **last resort**, because an adjustment hides the error
  instead of fixing it.
- **Period close** and **prior period adjustment** establish that a discovered error is corrected by
  an entry dated in the current period, never by editing the historical record.
- **Physical inventory counts** in ERPs record the counted quantity against the expected one and
  require a **reason** on the adjustment (Odoo does this explicitly), because an unexplained
  correction is indistinguishable from data loss.
- **Materiality** is what makes any of this acceptable at all: below a threshold, correcting the
  ledger to reality is better bookkeeping than pursuing an unrecoverable explanation.

## Decision

### 1. "Cuadrar cuenta": the app states its belief order by order, the collector states reality

A store-level action, **"Cuadrar cuenta" / "Reconcile account"**.

The app first shows **what it believes is owed, broken down order by order with each order's own
remaining balance, plus any parked money** (ADR 0033 §5b). The list holds every non-cancelled order
of that store and currency that still carries a balance, its **delivered** ones included (§3), in
two clearly separated groups, because a store with nothing open left is precisely where this action
is offered. The collector then walks that list and says which of those orders are in fact settled,
or types a smaller remaining balance for one of them. What they mark is what is written: a **reconciliation adjustment** ("Ajuste de cuadre")
carrying **one line per order it writes off** (§3).

The collector is never asked for a single store-wide number that the app then has to spread across
orders on its own. Spreading is guessing, and this package forbids guessing everywhere else
(`ADR 0025`, `ADR 0028`). The store-level total is a read-out **derived** from the per-order
declaration, never a second input, so the two can never disagree. This is the same interaction the
rest of the package already uses: ask the collector the question they can answer (they recognise
their own orders by date, store and products), never the one the app would have to invent an answer
to.

### 2. The adjustment is its own record, never a payment wearing a costume

It is stored as its own model (`StoreAccountAdjustment`, with its own line table for §3's per-order
lines), not as a `StorePayment` carrying a `reconciliationReason` flag, and its lines are **not**
`PaymentAllocation` rows. An adjustment must be **impossible to mistake for a documented payment**
anywhere it is read: in the store's history, in an order's payment ledger, in any export.
A flag on `StorePayment` would put the burden on every present and future reader to remember to
exclude it, and the first reader that forgets prints a payment that never happened.

The decisive argument is not presentational, it is arithmetic, and it lives outside this domain.
[`FRD-06`](../../product/prd-02-collector-app/frd-06-dashboard/frd-06-dashboard.md)'s `BR-06-04`
defines dashboard spend as **disbursed cash-out**: `PaymentAllocation.amountMinor`, grouped by its
parent `StorePayment.paymentDate`. A flagged `StorePayment` with allocations would therefore be
counted, by construction, in every figure built on that definition: "Desembolsado este mes", "Gasto
por mes", spend by product type, top stores, and, worst of all, **consumed budget**. A PEN 180.00
write-off that never moved a sol would eat PEN 180.00 of the collector's monthly budget. Keeping it
out would require every present and future reader of `PaymentAllocation` to remember the flag, on a
query none of them wrote for this feature. A separate model is outside that query by construction,
and nothing has to remember anything.

The same reasoning is what keeps §3's lines out of `PaymentAllocation` even though a line names an
order and an amount, which is exactly an allocation's shape. An allocation says money arrived at
that order; a line says the collector believes that balance was never really owed, or was paid
through a channel no record survives. Writing lines as allocations would make every write-off spend
money in `BR-06-04`'s figures again, and would also credit the order's own payment ledger with a
payment nobody made. The line lives in the adjustment's own table for the same reason the
adjustment lives in its own model.

### 3. Every adjustment carries a line per order, and a line leaves when its order leaves

An adjustment is not a bare store-level magnitude. It carries **one line per order it writes off**:
each line names one order and one amount, and the amount is capped at that order's own open balance
at the moment the adjustment is written. A line may be **partial** (smaller than the order's
balance), because a store's account can be half wrong.

**A line may name any non-cancelled order, delivered ones included, and that is what makes the
action reachable at all.** An earlier draft of this decision restricted a line to **open** orders,
which collides head-on with §7: the natural moment to square a store is the moment it has nothing
open left, and at that moment an open-orders-only sheet has zero candidates and every declaration is
impossible. It is worse than a dead end at the margin. **522 of the collector's 565 orders are
already `COMPLETED`**, and that back catalogue is exactly what this feature was approved to seal;
under the open rule it would stay out of reach permanently, carrying a residue that ADR 0033's
diagnostic figure ("pagos que no registraste", `FR-06-28`) will keep showing without ever offering a
tool to clear it.

The ceiling does not change with the order's status, because `openBalanceMinor` (§3.1) never reads
the status. What changes is which figure moves, and both readings say the same honest sentence,
"this balance was never really owed":

- a line on an **open** order lowers the debt figure shown to the collector (`FR-05-61`) and the
  ceiling that validates a new payment (`FR-05-63`);
- a line on a **delivered** order lowers the validation ceiling and the diagnostic figure
  (`FR-06-28`), and leaves the displayed debt untouched because a delivered order is already outside
  it (`FR-05-61`, `BR-05-26`). The sheet has to say so, or a collector who squares a delivered order
  and sees the store figure stand still concludes nothing happened.

The one status still refused is `CANCELLED`, with the family's existing `ORDER_CANCELLED`: a
cancelled order's committed total is already outside both figures, so a line against it would write
off a balance nothing was counting, bounded by a total nobody owes.

Two properties follow from the shape itself, not from a rule someone has to remember:

**The adjustment obeys the same law as everything else in this package.** ADR 0033 (`BR-05-26`)
already rules that what reduces an order's debt leaves the store figure when the order leaves it,
its committed total and its payments together, never one without the other. An adjustment line is
now one of those things: when the order is delivered and drops out of the open-order figure, its
line drops out with it.

**Drift becomes impossible by construction, instead of being bounded by a ceiling that slides.** An
earlier draft of this decision stored the adjustment as a single store-level magnitude and tried to
keep it honest with a cap: apply it only up to the balance of the open orders that already existed
on the adjustment's own date (`orderDate <= adjustmentDate`). The cap slides. Worked case: order A
of 180.00 (1 June) and order B of 200.00 (10 June), both open, neither paid, so the store owes
380.00. On 1 September the collector declares they really owe 200.00, a magnitude of 180.00 is
written, and the figure reads 200.00, correct. On 20 September A is delivered and leaves the
open-order set with its own debt. Now the explainable balance is B's 200.00, the cap is 200.00, the
applied magnitude is still 180.00, and the figure reads **20.00** when the truth is **200.00**:
understated by exactly the balance of an order the adjustment never wrote off. The adjustment slid
onto a survivor. That is precisely the failure mode this whole package exists to remove, the
understatement nobody ever notices (`BR-05-28`), reintroduced by the tool meant to close it. With a
line naming A, A leaves carrying its line and the figure reads 200.00.

**The temporal cap disappears with it, and so does any need for a snapshot.** That is a gain beyond
the sliding: `orderDate` is not a system fact, it is **retro-datable by the collector**, and both
the Notion backfill and AI order capture routinely record orders dated in the past. A cap keyed on
`orderDate <= adjustmentDate` therefore never meant what the prose beside it claimed ("orders that
already existed when the adjustment was written"), because an order entered today about a purchase
made in May falls inside a cap written in June. Scope is now stated by the line, so nothing has to
be inferred from a date and no frozen copy of the debt has to be stored.

### 3.1 One canonical open balance, declared here because the third term is born here

§3's line is a **third term** in an order's balance, and five write paths that already existed do
not know it exists. Until this section, two definitions were in use without either document
declaring the difference: the reconciliation write computed a line's ceiling **net** of the lines
already written, while the settle-on-arrival amount, the parked-money consumption, the dashboard's
obligation figures and the per order allocation ceiling all computed a **gross** balance that stops
at the allocations. Two definitions of the same money is how a write-off gets paid a second time, in
real money, months later. So the definition is
stated once, here, and every consumer cites it instead of carrying its own:

```
openBalanceMinor(order) = order.totalCost
                        − Σ PaymentAllocation.amountMinor          (money declared against the order)
                        − Σ StoreAccountAdjustmentLine.amountMinor (balance written off in a reconciliation)
```

The concept is **the order's open balance**, `openBalanceMinor`. It lives in exactly one module of
the data layer, `src/lib/data/orders/orderOpenBalance.ts`, alongside its own complement,
`declaredAgainstOrderMinor(order) = Σ allocations + Σ lines = totalCost − openBalanceMinor`, which
is the half the order-edit guards bound. Both are derived from the same three fields in the same
place, so no caller can read one of them over three terms while its neighbour reads it over two.
Nothing re-derives either of them inline: that inlining is exactly what produced the split this
section closes.

**What it is, and the one figure it deliberately is not.** `openBalanceMinor` is the **writable**
balance: the ceiling on anything new that may still be written against this order, and the term
every aggregate of what a store is owed is built from. It is **not** the balance the order's own
detail prints. An adjustment squares the store's account, it does not pay the order (see the
consequence below), so the order keeps showing `totalCost − Σ allocations` and keeps its "still
owed" chip (`FR-05-35`). The two readings answer different questions: "did anyone pay this?" stays
gross, "may anything still be written against this?" is net. Any surface that bounds a write or
sums what is owed uses the net one.

**The seven mandatory consumers.** Two of them were already net and now stop carrying their own
formula; five become net here:

| Consumer                                                                                                                                                                                                                                                                                                            | Was   | Now                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The settle-on-arrival amount ("Ya pagué el resto", [`FRD-08 · WO-08`](../../product/prd-02-collector-app/frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md))                                                                                                          | gross | net; a written-off order offers zero, so the checkbox does not even appear                                                                                   |
| The parked-money consumption when an order closes ([`FRD-05 · WO-09`](../../product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-09-store-payment-assignment-and-open-order-debt.md), `FR-05-62`)                                                                | gross | net; parked money can never land on a balance that was already written off                                                                                   |
| The dashboard's obligation figures, the diagnostic `FR-06-28` included ([`FRD-06 · WO-07`](../../product/prd-02-collector-app/frd-06-dashboard/bp-01-dashboard-aggregation-and-surface/work-orders/wo-07-open-order-debt-and-unrecorded-payment-figures.md))                                                        | gross | net; the panel and the store detail stop printing different numbers, and a delivered order that was written off stops being flagged as an unrecorded payment |
| The order-edit guards, `TOTAL_BELOW_PAID` / `CURRENCY_CHANGE_BLOCKED` / `STORE_CHANGE_BLOCKED` (`FR-05-68`, applied in [`FRD-05 · WO-11`](../../product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-11-store-account-reconciliation-action.md))                 | gross | net, through the complement `declaredAgainstOrderMinor`                                                                                                      |
| **The per order allocation ceiling `EXCEEDS_BALANCE`** in `src/lib/data/orders/storePaymentMutations.ts`, migrated by [`FRD-05 · WO-10`](../../product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-10-order-open-balance-and-store-account-adjustment-model.md) | gross | net; the last defence against paying a written-off balance a second time, by hand                                                                            |
| The ceiling on each new adjustment line ([`FRD-05 · WO-11`](../../product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-11-store-account-reconciliation-action.md))                                                                                               | net   | unchanged, but it cites this definition instead of holding its own                                                                                           |
| The store debt figure shown to the collector ([`FRD-05 · WO-09`](../../product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-09-store-payment-assignment-and-open-order-debt.md), `FR-05-61`)                                                                     | net   | unchanged; it is this same expression aggregated over the open orders                                                                                        |

**The seventh was found last, and it is the loudest argument for keeping this list explicit.**
`EXCEEDS_BALANCE` compares in gross today: `order.allocatedAmountMinor + pending > order.totalCost`,
with no line term. An order of 180.00 written off in full therefore still accepts a hand-typed
allocation of 180.00, because `0 + 180.00 > 180.00` is false. That is real money spent on a balance
the collector had already declared was not owed, landing in the dashboard's spend and consumed-budget
figures, which is the exact damage §2 built a separate model to prevent. Every other gross consumer
is a figure or an automatically computed amount; this one bounds what the collector types by hand,
which is the likeliest way the failure actually occurs. It is owned by [`FRD-05 · WO-10`](../../product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-10-order-open-balance-and-store-account-adjustment-model.md), the work order that
owns the canonical module, and it is safe to migrate there ahead of everything else because no line
row can exist yet: on the day it lands the comparison is arithmetically identical, and it is already
net by the time the first line is written.

**It cannot go negative, by construction, and if it ever does that is a defect to make visible.**
Each of the three terms is bounded against this same figure before it is written: an allocation is
refused above the order's remaining balance (`EXCEEDS_BALANCE`), a line is refused above
`openBalanceMinor` recomputed net of the lines already written
(`ADJUSTMENT_EXCEEDS_ORDER_BALANCE`), and the order's total can no longer be edited below the two
of them together (`TOTAL_BELOW_PAID`, widened by `FR-05-68`). The subtrahends therefore cannot sum
past `totalCost`. A negative value can only mean one of those ceilings was bypassed, which is a
double count of real money, so it is **rendered, never clamped**: a `Math.max(0, ...)` would turn
the one loud symptom of a double count into silence, and `BR-05-28` is explicit that the
understatement nobody notices is the failure that ruins the books.

**The worked case, and why the settle-on-arrival amount is the sharpest of the seven.** A store with
order A of 180.00 and order B of 200.00, both open and unpaid, so the store shows 380.00. The
collector squares up and writes one line of 180.00 against A; the store reads 200.00, correct.
Months later **A arrives**. Since the store holds no parked money, nothing suppresses the
pre-checked "Ya pagué el resto" box (`FR-08-44`), so what the box offers is the whole
question:

```text
GROSS (the definition this section retires)
  amount = totalCost − Σ allocations = 180.00 − 0 = 180.00
  The box appears, pre-checked, and writes a REAL StorePayment of 180.00.
  (a) That 180.00 is a PaymentAllocation dated today, so BR-06-04 counts it as disbursed cash in
      "Desembolsado este mes", the spend chart and CONSUMED BUDGET. A write-off that moved no sol
      eats 180.00 of the collector's budget: precisely the failure §2 built a whole model to avoid,
      walked back in through the arrival door.
  (b) The store's payment ceiling becomes 380.00 − 180.00(paid) − 180.00(line) = 20.00, so B's
      REAL payment of 200.00 is refused with STORE_DEBT_EXCEEDED.

NET (openBalanceMinor)
  amount = 180.00 − 0 − 180.00 = 0
  Zero is not an amount to offer, so the checkbox never renders. Nothing is written. No phantom
  disbursement, and the ceiling stays 380.00 − 0 − 180.00 = 200.00, which is exactly B's real
  payment.
```

### 4. Mandatory properties

- **Dated TODAY. It never rewrites the past.** This is the period-close principle: an old error is
  corrected with a current entry, not by editing the historical record. Backdating would also
  falsify the very payment dates ADR 0032 §10 refused to falsify with a migration.
- **Labelled as an adjustment**, always, everywhere it renders.
- **A declared reason**, even when the reason is "no identificado". The precedent is the reason
  field ERPs require on a physical inventory adjustment: an unexplained correction and a data loss
  look identical six months later.
- **Deletable, as a whole, and re-declarable afterwards.** If the receipt turns up, the adjustment
  is deleted, its lines go with it, and the real payment is recorded. An adjustment is a statement
  about ignorance, and ignorance is exactly the thing that gets resolved later. There is no editing
  of a single line: a reconciliation is one declaration made at one moment, so correcting it means
  making the declaration again. That last half only works because a line may name a delivered order
  (§3): under the earlier open-orders-only rule, deleting an adjustment written against an order
  that had since been delivered left a residue nothing could ever clear, since the order was no
  longer an eligible target. Deletion was a one-way door pretending to be an undo.
- **No stored total.** The adjustment's magnitude is the sum of its own lines, derived when it is
  read, never persisted (§5). Everything above holds over the lines; the header holds the date, the
  reason and the currency, and nothing that could disagree with them.

### 5. One direction only, and the new model has to say so itself

The adjustment exists **only** in the direction "I owe LESS than the app thinks".

The opposite direction ("I owe more") is not a forgotten payment, it is a cost entered wrongly, and
the fix is to edit the order, where the money stays attached to the thing that caused it.

Because §2 gives the adjustment **its own model**, this restriction is not inherited from anything.
`StorePayment.amount > 0` (ADR 0025) is a guarantee about `StorePayment` rows, and a
`StoreAccountAdjustment` is not one. The one-way rule is therefore a constraint the new model must
**declare explicitly, for itself**, on three levels:

- **Shape.** The only stored amount in the whole record is a line's, and it is an unsigned
  magnitude (§3). No field anywhere on either table can express the opposite direction. There is no
  "adjustment that raises the debt" to write, in the same way there is no negative payment.
- **Database.** The migration adds a `CHECK (amount_minor > 0)` constraint by hand in its SQL, on
  the line table, since the Prisma schema language cannot express a check constraint. This is the
  level `StorePayment` relied on, reproduced deliberately instead of assumed. The header needs no
  such constraint because it stores no amount: its magnitude is a sum of individually constrained
  positive lines, so it is positive whenever a line exists and zero when none does.
- **Mutation.** The write refuses, before its first write per ADR 0022, when no line writes anything
  off (`NO_ADJUSTMENT_NEEDED`), and it refuses a line larger than its own order's `openBalanceMinor`
  (§3.1), which is already net of the lines written against that order by earlier declarations. The
  wrong direction is rejected at the boundary, never encoded as a negative amount that later readers
  have to interpret.

Every amount is derived server-side and never accepted from the client: each line's amount is
computed against that order's own server-side balance and capped by it, and the adjustment's total
is **not stored at all**. That is a correction of an earlier draft, which gave the header its own
`amountMinor` with the invariant "always equal to the sum of its lines". Two ordinary events break
that invariant with no code anywhere that would notice: deleting an order cascades its line away and
leaves a header of 380.00 over lines worth 200.00, and deleting the last one leaves a header
claiming 380.00 over **zero** lines, listed in the store's history as a declaration that squared an
account it now writes nothing off. Defending the stored copy would mean a delete hook on `Order`
whose only job is to re-total every adjustment the cascade touched. Deriving the magnitude removes
the invariant instead of defending it: a cascade lowers it to exactly what is left, an adjustment
whose lines have all gone derives **zero**, subtracts nothing anywhere, and stays readable and
deletable as a harmless husk. Nothing has to clean it up. The direction cannot be inverted by what a
caller sends, and a total that is never stored cannot disagree with the lines it is made of.

### 6. Last resort, not first offer

Before the adjustment is offered, the app **must** show the orders that still carry a balance (open
and delivered alike, §3) and the parked money, in case the difference explains itself. The warning is carried over verbatim from QuickBooks'
documentation of its own "Reconciliation Discrepancies" account: it should be considered a last
resort, because **an adjustment hides the error rather than fixing it**.

The ordering matters more than it looks. Offering the adjustment first would make it the fast path,
and a fast path that erases a discrepancy is a fast path that erases evidence.

**And the ordering is enforced, not merely advised: no adjustment may be written at all while the
store still holds parked money in that currency.** The write refuses with
`STORE_HAS_UNASSIGNED_MONEY` (`FR-05-69`), before its first write per ADR 0022, reading
[`FRD-05 · WO-09`](../../product/prd-02-collector-app/frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-09-store-payment-assignment-and-open-order-debt.md)'s own `getUnassignedStoreMoneyMinor` rather than a second derivation of the pool.
The refusal is not a nag: without it the two subtrahends count the same money twice, and the
arithmetic is short enough to state in full.

```text
Store with order A of 180.00, unpaid, and a payment of 30.00 parked (declared against the store,
attributed to nothing, BR-05-27).

  Store debt today       = Σ totalCost − Σ StorePayment.amount = 180.00 − 30.00 = 150.00.
                           The parked 30.00 already reduces it: paidMinor counts a payment at its
                           face value, not at its allocations.
  A line's own ceiling   = openBalanceMinor(A) = 180.00 − 0 − 0 = 180.00.
                           Parked money is not a PaymentAllocation, so it does not appear here.
  Collector writes off A = a line of 180.00. The same 30.00 has now been subtracted twice.
  Payment ceiling        = 150.00 − 180.00 = −30.00.

The store prints a false "A favor 30", and every new payment is refused by STORE_DEBT_EXCEEDED, so
"Registrar pago" sits disabled with nothing on screen explaining why.
```

The alternative fix, netting the pool out of each line's ceiling, is not available: it would require
deciding **which** open orders the pool belongs to, and that is the attribution this whole package
refuses to guess (`ADR 0025`, `ADR 0028`). Refusing is also the better outcome on its own terms.
Assigning parked money is always better than writing a balance off: assignment records where real
money went, a write-off records that the collector could not say. Offering the write-off while an
honest explanation is still sitting unassigned in the same store would invert §6's entire ordering.
So the app names the amount and offers the assignment first: **es** "Tienes {monto} sin asignar en
{tienda}. Asígnalo antes de cuadrar la cuenta.", **en** "{store} holds {amount} you have not
assigned yet. Assign it before you reconcile the account."

**Known interaction, written down rather than discovered: cancelling an order parks money by
default, and therefore blocks the store's reconciliation.** `cancelOrder`'s `credit` branch is the
**default** choice (`BR-05-15`, chosen because most cancellations free money to cover another order
at the same store): it deletes that order's `PaymentAllocation` rows and resets
`Order.allocatedAmountMinor` to zero while the underlying `StorePayment` survives. That surviving
payment is money declared against the store and attributed to nothing, which is exactly the parked
money this section refuses to reconcile over. So a collector who cancels an order with the default
choice and then tries to square that store meets `STORE_HAS_UNASSIGNED_MONEY`, immediately after an
action that never mentioned the word. It is **not a hard block**: the way out is the assignment the
refusal already names and offers, and the refusal is right on its own terms, since freed credit is
money whose destination the collector knows better than the app does. The cost is one extra step on
a path that is common enough to be worth stating, and the sheet naming the amount is what keeps it
from reading as an unexplained refusal.

### 7. The natural moment is when a store runs out of open orders

Offer it when a store has **nothing open left**: **es** "No te queda nada abierto con {tienda}.
¿Están a mano?", **en** "Nothing left open with {store}. Is everything settled?". With 522 of 565
orders completed, most of the collector's stores would be sealed in a single pass, and each sealed
store is one that can never again accumulate ADR 0033's contamination.

This prompt is only honest because §3 lets a line name a delivered order. On a store with zero open
orders, every candidate the sheet can list is a delivered one, so under the open-orders-only rule
the nudge would have opened an empty sheet: the app would be asking "is everything settled?" and
then refusing to record the answer.

### 8. Keep the history of adjustments, per store

Every adjustment is retained and listed per store. A store that needs squaring up **repeatedly**
indicates a systematic problem (a store whose prices move after the fact, a payment channel the
collector never records), not carelessness. This is the same use a retail business makes of its cash
over and short account: it is read as a **pattern detector across periods**, not as a bin.

### 9. What this ADR does not touch

- **ADR 0025 and ADR 0028 stand.** Derived splits stay forbidden. §3's lines are not a split: the
  app never divides a store-wide figure across orders, neither proportionally nor by an
  oldest-first rule. Each line exists because the collector named that order, which makes the
  breakdown a **declaration** exactly as ADR 0028 requires, and the app's own contribution is
  limited to showing each order's balance and refusing a line larger than it.
- **ADR 0026 stands.** `OrderItem.paidDeclaredAt` still moves no money, and an adjustment is not a
  substitute for it.
- **ADR 0033 stands and is the input, now down to its parts.** What the collector is asked to
  confirm is the open-order figure broken into the orders it is made of, plus the delivered orders
  whose residue that figure no longer counts (§3), with parked money shown beside it, never the
  historical total. `BR-05-26` also now governs the adjustment itself: a line
  leaves the figure with its order (§3).
- **ADR 0022 applies to the write.** Everything the adjustment can refuse (direction, store
  ownership, currency, whether each named order is cancelled and how much of its `openBalanceMinor`
  is left, and whether the store still holds parked money in that currency, §6) is knowable before
  the first write, so the refusals are plain pre-write returns.
- **The order's own edit guards are not left behind.** They are not a figure, so they are easy to
  miss, but `TOTAL_BELOW_PAID`, `CURRENCY_CHANGE_BLOCKED` and `STORE_CHANGE_BLOCKED` all bound an
  order against the money declared on it, and a line is now part of that money (§3.1, `FR-05-68`).
  They are listed here rather than left implicit because they live in another module,
  `src/lib/data/orders/orderMutations.ts`, that nothing in this ADR would otherwise point at.

### Copy (es / en)

| Where              | es               | en                        |
| ------------------ | ---------------- | ------------------------- |
| Action             | Cuadrar cuenta   | Reconcile account         |
| The recorded entry | Ajuste de cuadre | Reconciliation adjustment |

## Alternatives considered

- **Do nothing and live with the mismatch.** The default, and it is what makes the figure die. A
  store number the collector knows is wrong and cannot correct is a number he stops reading, and
  once he stops reading it, ADR 0033's whole containment argument buys nothing. The unrecoverable
  96.3% backfill means "wait for better data" is not a plan: the explanation for those rows does not
  exist anywhere.
- **Record a phantom payment instead.** The obvious shortcut: enter a `StorePayment` for the missing
  amount and the figure goes to zero. Rejected because it fabricates an event. It states a date, an
  amount and an implied transfer that never happened, it lands in the order's payment ledger where
  it is indistinguishable from documented money, and it destroys the ability to answer the one
  question worth answering later ("is this store's account genuinely clean, or did I paper over
  it?"). It also poisons the very forensic reading that made this ADR necessary.
- **A tagged `StorePayment` row (a nullable `reconciliationReason` flag) instead of a new model.**
  The cheapest shape by a wide margin: one nullable column, and the adjustment inherits the debt
  arithmetic, the allocation ceilings, the deletion mutation and the store's payment list for free.
  Rejected because the inheritance is exactly the problem. `BR-06-04` defines dashboard spend as
  `PaymentAllocation.amountMinor` by its parent `StorePayment.paymentDate`, so every adjustment
  would silently become disbursed cash in "Desembolsado este mes", the monthly spend chart and the
  consumed-budget figure: a write-off that moved no money would eat the collector's budget. The flag
  would also have to be remembered by every future reader of a payment, and §4.2 of the approved
  spec asks the adjustment to be "etiquetado como ajuste, nunca disfrazado de un pago documentado",
  which a badge in one list does not deliver. The distinction has to be structural. The price of
  refusing it is real and is recorded in the consequences below.
- **A single store-level magnitude, kept honest by a temporal cap** (the earlier draft of this same
  decision). One row, one amount, no line table, and no per-order question to ask: the adjustment
  applied against whatever open balance existed on its own date (`orderDate <= adjustmentDate`),
  drained oldest adjustment first. Rejected because the cap **slides onto orders the adjustment
  never wrote off**. A of 180.00 (1 June) and B of 200.00 (10 June), both unpaid, debt 380.00; on
  1 September the collector declares 200.00 and a magnitude of 180.00 is stored, reading 200.00,
  correct. Deliver A on 20 September and the explainable balance becomes B's 200.00, the cap is
  200.00, the applied magnitude is still 180.00, and the store reads **20.00** against a truth of
  **200.00**. The figure is understated by the whole balance of the order that motivated the
  adjustment, which is the silent failure `BR-05-28` names as the one that ruins the books. The
  shape also depended on `orderDate` meaning "when the order started existing", and it does not:
  the collector back-dates orders routinely (the Notion backfill and AI order capture both do),
  so the cap and the prose describing it never agreed. Lines make the drift unrepresentable and
  retire both the cap and any snapshot of the debt.
- **Restrict a line to OPEN orders only** (an earlier draft of §3). Tidier on its face: an
  adjustment would only ever touch the figure the collector is looking at, and a delivered order's
  residue would stay untouched as evidence. Rejected because it makes the feature unreachable at its
  own natural moment. §7 offers the action when a store has **nothing open left**, which is exactly
  when the sheet would have no candidates, and 522 of 565 orders are already `COMPLETED`, so the
  back catalogue this feature was approved to seal would be permanently out of scope while
  `FR-06-28` keeps pointing at its residue with no tool attached. It also made deletion a one-way
  door: an adjustment on an order delivered since could be deleted but never re-declared, leaving a
  ghost. The evidence argument does not survive either, because a write-off on a delivered order is
  not the loss of a signal, it is the collector answering the question `FR-06-28` asks.
- **Ask for one store-wide number and spread it across the open orders automatically.** The
  cheapest interaction: one field, and the app decides which orders it wrote off (oldest first,
  largest first, proportionally). Rejected on the same ground as every other split in this package
  (`ADR 0025`, `ADR 0028`): the collector knows which order they settled, so a rule that guesses it
  for them is inventing an attribution that will be wrong in a way nobody can see. The per-order
  question is answerable precisely because an order is recognisable by its date, its store and its
  products (`FR-05-67`), which is why the same interaction already carries the batch-arrival and
  parked-money flows.
- **Let the collector edit or backdate the historical payments until the figure agrees.** It reaches
  the same number and it corrupts the record on the way. Period close exists precisely to forbid
  this: a discovered error is a current-period entry. Backdating would also re-introduce the
  falsified payment dates that ADR 0032 §10 refused when it rejected a retroactive migration.
- **Allow adjustments in both directions.** Symmetric and wrong. "I owe more than the app thinks" is
  not an unrecorded payment, it is a cost that was entered incorrectly, and it has a correct fix
  (edit the order) that keeps the money attached to the thing that caused it. A negative adjustment
  would become a general-purpose way to add debt without naming an order.
- **Auto-zero a store that has no open orders left.** Cheap and silent, and it would zero exactly
  the stores where a real unrecorded payment is most likely to be hiding. It also removes the reason
  field, the history and the collector's own confirmation in one move, converting a declaration into
  a side effect.
- **Make the adjustment permanent (non-deletable), as an append-only ledger would.** Purer as
  bookkeeping and worse here: the adjustment encodes "I could not identify this", and the receipt
  turning up later is the expected happy ending. Deleting it and entering the real payment is the
  correction; a compensating counter-entry would be ceremony over a single-user collection app.
- **A materiality threshold that auto-clears small differences.** Materiality is the principle that
  makes the adjustment defensible, but automating it makes the app decide what is negligible on the
  collector's behalf. The collector declares the real number; the threshold, if one is ever wanted,
  belongs in how prominently the prompt is offered, never in a silent write.

## Consequences

- **The product gains a way to make a money figure agree with reality without evidence.** That is
  its purpose and its danger. §6's ordering (the orders with a balance and the parked money first) and §8's history
  are the only two things standing between "a correction" and "a habit".
- **A second kind of money record now exists**, and every reader of a store's money history has to
  distinguish them: payments, and adjustments. Any figure, export or aggregate that treats them as
  one is wrong by construction, which is why §2 refuses the flag-on-`StorePayment` shape.
- **The adjustment inherits none of `StorePayment`'s arithmetic, and that is precisely what §2
  costs.** A flagged payment row would have been picked up for free by every debt computation, by
  the allocation ceilings, by `deleteStorePayment` and by the store's existing payment list. A
  separate model is picked up by none of them. Every one of those behaviours now has to be written,
  and written correctly, or the adjustment does nothing at all. The cost is accepted because the
  alternative is a wrong number in the dashboard's spend and budget figures, which is silent, while
  a debt figure that ignores adjustments is loud: the collector squares up and the number does not
  move.
- **Store debt has to subtract adjustment lines explicitly, in both of its figures, and the term is
  scoped exactly like the payments term beside it.** Neither of ADR 0033's two numbers sees an
  adjustment on its own, so both get an explicit term, per (store, currency):
  - the figure **shown** to the collector (open orders only, `FR-05-61`) becomes the committed
    total of the open orders, minus the allocations declared against those same orders, minus the
    adjustment lines written against those same orders. Three sums over one and the same set of
    orders, which is the whole point: an order leaves carrying its committed total, its payments
    **and** its adjustment lines, so no term can ever survive the order it belonged to. There is no
    cap, no ordering, no drain and no date comparison, because there is nothing left to bound.
  - the ceiling that **validates** a new payment (`STORE_DEBT_EXCEEDED`, `FR-05-63`) subtracts every
    line written against a **non-cancelled** order, which is the same scope its own base uses (the
    store's lifetime debt), so a written-off balance cannot be paid a second time. When a receipt
    does turn up, the adjustment is deleted first (§4) and the ceiling recovers on its own.
- **A third term means every write path bounded by an order's balance had to be found and changed,
  and five of them predate the line.** §3.1 names the definition, its module and its seven consumers
  precisely because the expensive failure here is not a wrong formula, it is a caller that never
  learned there was a third term: it keeps computing a gross balance, and the money it writes on the
  strength of it is real. Two of the five hurt in that way rather than merely printing a wrong
  figure: the settle-on-arrival amount authors a `StorePayment` that lands in the dashboard's spend
  and budget figures, which is the exact damage §2 refused a flagged payment row to prevent, and the
  `EXCEEDS_BALANCE` allocation ceiling lets the collector type that same payment by hand. The
  seventh was found only on the fourth review pass, after the list had already been written into
  `BR-05-32` as six, which is itself the argument for the list: the standing rule from here on is
  that any new surface bounding money against an order imports `openBalanceMinor` rather than
  writing `totalCost − allocated`, and the seven-consumer list is the checklist a reviewer runs when
  an eighth appears.
- **Reconciling is now blocked, not just discouraged, while parked money sits in that store and
  currency** (§6, `FR-05-69`, `STORE_HAS_UNASSIGNED_MONEY`). The collector pays for it with an extra
  step on exactly the flow that was supposed to be a cleanup: a store holding an unassigned payment
  cannot be squared until that payment is assigned. The step is accepted because the alternative is
  a double subtraction that drives the store's payment ceiling negative, prints a false "a favor"
  and disables "Registrar pago" with no explanation. It also has a real dividend: the assignment the
  collector is pushed into is evidence, and the write-off it replaces is the absence of evidence.
- **A line is scoped to an order's life, so the order's own lifecycle now moves it.** Cancelling an
  order leaves its lines in place, exactly as it leaves its payments (`BR-05-15`), and both figures
  stop counting them because both are scoped to non-cancelled orders. Deleting an order cascades
  its lines away with the rest of its money trail. Neither case needs code that knows about
  adjustments, which is the dividend of scoping the term to the same set of orders as the payments
  term.
- **An adjustment moves the store's figure and never an order's own balance**, even though its
  lines now name orders. A line scopes the write-off to an order so that it dies with it (§3); it
  does not pay it, and it is not a `PaymentAllocation` (§9). An order whose balance was written off
  keeps showing that balance on its own detail, and keeps its "still owed" chip (`FR-05-35`), which
  is the one deliberate place where the gross reading survives §3.1's net one, and it is a
  distinction the reconciliation sheet's own copy has to hold: it squares the account, it does not
  settle the orders. This is the honest reading (nobody paid that order) and it is the reason the
  adjustment is a store-level statement, but it does mean the residue stays visible per order.
- **Reconciling a delivered order DOES clear the diagnostic figure, and that is a deliberate
  reversal.** An earlier draft of this decision concluded that ADR 0033's "pagos que no registraste"
  (`FR-06-28`) would keep counting a written-off balance from the moment its order was delivered,
  and that "reconciling a store does not silence the diagnostic; it was never meant to". That was a
  consequence of restricting a line to open orders, not a decision anybody took. Once a delivered
  order can be named (§3), writing off its balance is exactly the collector answering the question
  that figure asks: "no, this is not a payment I forgot to record". So the diagnostic reads
  `openBalanceMinor` like every other obligation figure (§3.1) and drops by the line. On a store
  with nothing open left, it is the **only** figure a reconciliation moves, which is why the sheet
  has to name it rather than let the collector watch an unchanged debt figure and assume the write
  failed.
- **The adjustment has no total of its own, so there is one fewer invariant to defend.** The
  magnitude is derived from the lines that exist at read time (§5). The order-deletion cascade,
  which would have falsified a stored copy silently, now simply lowers the derived one to what is
  left, and an adjustment whose orders were all deleted derives zero and subtracts nothing. The cost
  is a sum on every read of the history, over a table with one row per written-off order.
- **A store cannot be squared while a cancellation's freed credit sits unassigned** (§6). The
  default `credit` branch of `cancelOrder` (`BR-05-15`) parks money by construction, so the two
  common flows collide: cancel an order, then try to square that store, and the app refuses. The
  refusal is correct and has a stated way out, but it is a real interaction between two features
  that were designed apart, and it is recorded here so it is met as documented behaviour rather than
  as a bug report.
- **The reason field will mostly say "no identificado"**, and that is the honest outcome rather than
  a failure of the field. Its value is comparative: three stores with "no identificado" and one with
  "la tienda ajustó el precio después" is a signal the collector can act on.
- **Most stores can be sealed in one pass** (522 of 565 orders completed), which means the first use
  of this feature will be a bulk cleanup of the collector's back catalogue, not the occasional
  correction the design is otherwise shaped around. This is only true because §3 admits delivered
  orders: those 522 are what the back catalogue is made of, and every one of them is a delivered
  order. The bulk pass is where an over-eager adjustment is most likely, and it happens before
  anyone has seen the feature behave.
- **The evidence base is the same thin one as the rest of the package**: 7 orders of genuine native
  usage, 5 of them from the last week, against 96.3% backfilled payment history. The diagnostic
  figure this action is meant to close currently reads zero.
- **The collector pays for this in interaction, and the bulk pass is where it is felt.** A
  store-wide number would have been one field; the lines make it one decision per order carrying a
  balance. The cost lands hardest on exactly the pass §7 predicts, the back-catalogue cleanup, where
  most of what the sheet lists is delivered orders (522 of 565 orders are completed) and a store can
  hold several at once. The list is still the question the collector can actually answer, it is the
  only version of this feature that stays true after a delivery, and the "todo saldado" affordance
  collapses the common case back to one gesture over the same declaration.
- **Nothing here fixes a store that needs adjusting every month.** §8 makes that visible and stops
  there, deliberately: the underlying cause would be a store-behaviour or channel problem, and
  naming it in the app is a separate decision nobody has taken.
