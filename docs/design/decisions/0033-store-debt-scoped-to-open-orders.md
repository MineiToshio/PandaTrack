---
title: "ADR 0033 - Store debt counts only open orders, and no payment may leave money unattached"
date: 2026-08-20
status: accepted
session: saldar al recibir + cuadre de caja (spec approved by the collector 2026-08-20, four red-team passes)
owner: Sergio Minei
trigger: today an unrecorded payment contaminates a store's debt figure PERMANENTLY and cumulatively, because the debt sums every non-cancelled order the store ever took. The collector then found the failure that the naive fix opens: a delivered order leaves with its debt but leaves its unassigned payment behind, understating the remainder in silence
updates: docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md, docs/product/prd-02-collector-app/frd-06-dashboard/frd-06-dashboard.md, docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md, docs/product/glossary.md
extends: ADR 0025 (store-level payments with declared allocations), ADR 0027 (allocation list figures partition, never replicate), ADR 0028 (order-scoped payment breakdown)
---

# ADR 0033 - Store debt counts only open orders, and no payment may leave money unattached

**Implemented 2026-08-20 (uncommitted, staging), via `FRD-05 · WO-09` and `FRD-06 · WO-07`.** It
records a decision the collector approved on 2026-08-20. The two halves are deliberately one
record: the second exists to close a money leak the first one opens, and shipping either alone is
worse than shipping neither. The requirements live in `FRD-05`
(`FR-05-58` … `FR-05-63`, `BR-05-26` … `BR-05-28`, `BR-05-31`) and `FRD-06` (`FR-06-27`,
`FR-06-28`, `BR-06-13`).

## Context

ADR 0025 defined store debt as `Σ committed (non-cancelled orders) − Σ paid`, per store and per
currency. That definition has one property nobody chose: **it never forgets**. A payment the
collector made in the real world and never entered into the app inflates that store's debt forever,
and every later order piles onto the same running error. There is no moment at which the figure
self-corrects, and no way to tell a real debt from an accumulated recording gap.

The census says the gap is not hypothetical but it is also not yet visible:

- 565 orders, 522 of them completed, and live debt of **PEN 6,389.00** across 24 open orders plus 3
  partially delivered ones. **USD 0.**
- **0 orders are delivered with an outstanding balance.** In this market that is structural, not
  discipline (ADR 0032's axiom: the store does not hand over the goods until it has been paid).
- So **the scoping change is a no-op today**: debt would still read PEN 6,389.00. It is a ratchet
  that only acts going forward.

On the assignment side:

- **0 money is unassigned across all 122 (store, currency) combinations.** The collector already
  assigns everything he pays; the rule below closes a door he has stopped using rather than changing
  his habits.
- **338 allocations already name a product, 293 do not, and 0 orders mix both forms.**
- Only **2 of 9** live multi-product orders can have a partial balance computed (ADR 0032 §2), i.e.
  **0.7%** of the history, and the blocking condition is undetailed money on the order.

## Decision

### 1. The debt figure counts open orders only, and an order leaves with its payments

The per (store, currency) debt figure **excludes fully delivered orders**. A delivered order leaves
the calculation **with its committed total AND with its payments, together, as one unit**. Removing
the total while leaving the payments behind is not a smaller version of this rule, it is a different
and broken one (§ Alternatives).

Partially delivered orders **stay in**: not all their products have been delivered, so they are
still in flight.

The point is error containment. Today a missed payment is permanent and cumulative; under this rule
it contaminates only while the order is in flight and is flushed when the order is delivered.

### 2. The displayed figure and the validation ceiling are different numbers

- The **displayed** figure is open orders only.
- The **ceiling that validates a new payment** (`STORE_DEBT_EXCEEDED`, ADR 0025 decision 3) remains
  the **complete** debt, delivered orders included.

Otherwise a late payment against an already-closed order would be refused, and the collector
explicitly wants to keep recording those. They simply stop adding to the store's headline figure.
At ORDER level the outstanding balance is still shown exactly as today.

The label changes with the meaning: from "Debes {monto}" to **"Pendiente en pedidos abiertos" /
"Outstanding on open orders"**.

### 3. The diagnostic figure: "pagos que no registraste"

A new figure, `Σ outstanding balance of delivered orders`, surfaced as **"Pagos que no registraste"
/ "Payments you never recorded"**.

**It is not debt. It is a thermometer** of how current the bookkeeping is. Since nobody in this
market extends credit, a delivered order with a balance is by definition a payment that was made and
never entered.

The precedent is inside the product: the dashboard already excludes cancelled orders from its totals
while printing a dedicated "perdido en cancelados" figure (`BR-06-10` / `FR-06-23`). Same shape,
same reason: a number removed from an aggregate is not a number deleted from the world.

### 4. An order may not close leaving orphaned money behind

This is the collector's own find, and without it §1 is a money leak:

> A store holds orders A (total 50) and B (total 50). Debt 100. A direct payment of 30 arrives with
> no assignment, so debt reads 70, correctly. A is delivered. A leaves with its 50 of debt and with
> its payments, which are **zero**, because the 30 was never assigned to it. What remains is B (50)
> minus the 30 still sitting in the pot, so debt reads **20**. B actually owes 50.
> **Understated by 30.** In one sentence: the order takes its debt with it and leaves its payment
> behind.

The rule: **an order cannot be closed while its store still holds unassigned money in that
currency.** On marking it delivered, that money is applied to the order up to its balance,
`min(order balance, unassigned money)`. The order leaves taking it.

The collector is asked ("you have {amount} unassigned, was it for this order?"), and **if they skip
the question, it is applied anyway.**

**The direction of the error is the whole argument.** If the money actually belonged to a DIFFERENT
order, that other order now reads as owing MORE than it really does, and an inflated debt is
something the collector sees and fixes. Leaving the money in the pot makes the remainder read LOWER
than reality, and nobody ever notices a number that is too small.
**Overstating is a visible error. Understating is the one that ruins the books in silence.**

Valuable side effect: consuming first also corrects the amount ADR 0032's checkbox proposes. Without
it, the checkbox would offer the full balance on an order that was already partly paid.

In a batch, this runs **order by order, oldest first** (`orderDate ASC, humanReadableId ASC`, the
same deterministic order ADR 0032 §9 fixes because 38 pairs tie on `orderDate`), with the
distribution **visible before confirming**. Never a proportional split.

### 5. The real rule about assignment: no payment may hold money that belongs to no order

The principle is **not** "you must name products". It is that **no payment may end up holding money
that belongs to no order**. How that is achieved differs per surface, and the difference is
deliberate.

#### 5a. A STORE-level payment must be assigned in full, by choosing PRODUCTS

In `StorePaymentSheet`, assignment becomes **mandatory**: the sum of the allocations must **equal**
the payment amount. Today only `Σ allocations ≤ amount` is enforced
(`ALLOCATION_SUM_EXCEEDS_PAYMENT`, invariant 2 of ADR 0025), and that remainder is exactly the money
that goes orphan in §4's scenario.

Assignment is done by **picking PRODUCTS, not orders**, and `orderId` is filled in from the chosen
product. Two reasons, in the collector's own order of importance:

1. **A product implies its order** (a product belongs to exactly one order), so naming the product
   is strictly more informative than naming the order. Nothing is lost.
2. **Usability, and this is the decisive one.** The collector remembers "el manga de One Piece". He
   does not remember `ORD-20260506-01`, which is an autogenerated code that means nothing to a human
   being. Asking him for the order code is asking him to act as the database's index. The code is a
   join key that leaked into the interface.

**Naming a product does not require the product to have a price.** Naming is not pricing. For an
unpriced product in a multi-product order there is simply no per-item ceiling
(`resolveItemAllocationBase` returns null), only the order's own.

Distributing the amount among the chosen products:

- **Priced products:** the app **proposes** the split and the collector confirms or adjusts it,
  through the machinery that already exists (the allocation sheet's "Máx." control and ADR 0028's
  breakdown panel). It stays a declaration, per ADR 0028 §1.
- **Unpriced products all in the SAME order:** the whole amount goes to that order, unsplit. The
  chosen products are marked as covered.
- **Unpriced products across DIFFERENT orders:** the collector is asked how much went to each,
  **pointing at products**, never at order codes.

ADR 0027's I-1 and I-1b still hold over this list: what a control writes is what its accessible name
promises, and a figure printed in the list partitions the payment rather than replicating it.

#### 5b. Parked money: a deliberate "no sé todavía" that reduces nobody's debt

There must be an escape hatch, and it must be **chosen on purpose**.

- **Practical reason.** A mandatory field with no exit manufactures false data. The collector would
  pick any order to get past the screen, and a wrong attribution silently distorts a specific order,
  which is worse than not attributing at all.
- **Accounting reason.** The **suspense account** exists for exactly this: money you know moved but
  cannot yet impute. The standard treatment is unambiguous that **parking it is better than not
  recording it**, and the textbook illustration of a suspense entry is literally a customer payment
  that does not say which invoices it covers.

**The hard rule on parked money: it reduces NOBODY's debt until it is assigned.** It is displayed
separately as money pending imputation. With that, §4's failure dies twice over: the pot cannot
silently offset a remainder, and an order cannot close while the pot is non-empty.

Standard suspense-account discipline also applies: it may not stay open indefinitely. Each order
closing drains it (§4), and it should be reviewed periodically. ADR 0034 is the periodic review.

#### 5c. A payment raised from INSIDE an order stays optional

In `OrderInlinePaymentForm`, choosing products remains **optional, exactly as today**. The order is
already known from context, the money is attributed by construction, and there is no way for it to
end up orphaned. The panel for splitting across that order's products **already exists** (ADR 0028);
nothing is built here.

This is "reward, not toll": naming products unlocks automatic computation of that order's partial
deliveries (ADR 0032 §2 condition b). The app offers it and never demands it.

### 6. Compound effect, stated because it is the reason the shape is worth it

If store-level payments start naming products by default, the share of orders where a partial
delivery is computable (today 2 of 9 live, 0.7% of history) **grows on its own**, with no extra
effort from the collector, while making the screen EASIER than it is now. The comfortable path
turned out to be the one that leaves better data.

### 7. What this ADR does not touch

- **ADR 0025's ban on derived splits stands whole.** Nothing here infers an allocation. §4's
  consumption is `min(balance, unassigned)` against ONE order, an exhaustion rule, not a
  distribution; a proportional spread across several orders is forbidden here as everywhere.
- **ADR 0026 stands whole.** `OrderItem.paidDeclaredAt` still moves no money (invariant I1), and
  none of the figures redefined here read it.
- **ADR 0025's store-debt ceiling stands**, and §2 keeps it computed over the complete debt
  precisely so it keeps meaning what it meant.
- **ADR 0022 governs any refusal added here.** The new equality check on a store payment and the
  consumption at close are both decidable before the first write, so they are plain pre-write
  returns, not sentinels.

## Alternatives considered

- **Exclude the delivered order but leave its payments in the store's pool.** The naive version of
  §1, and it is arithmetically broken, not merely imprecise. Concretely: a store with A (100 total,
  50 paid) that delivers A leaves 50 of payment in the pool discounting OTHER orders' debt, so those
  orders read as 50 cheaper than they are. The collector's own worked example makes the same point
  from the unassigned side (§4): the order leaves with its debt and abandons its payment,
  understating the remainder by exactly the unassigned amount. Both are the same defect: debt and
  payment are one unit and cannot be scoped separately.
- **Leave debt as it is and live with the permanent contamination.** It is the status quo and it is
  what the collector asked to fix. A figure that can only ever drift upward stops being consulted,
  and once it stops being consulted the app's central money number is decorative.
- **Clamp the debt at zero, or hide it once it looks wrong.** Rejected on the same grounds ADR 0025
  refused to clamp negative debt: clamping deletes the only signal that something is off.
- **Assign by ORDER instead of by product.** Simpler UI, one less join, and it asks the human for
  the one identifier that means nothing to him. `ORD-20260506-01` is autogenerated; "the One Piece
  manga" is what he remembers. Since a product implies its order, picking products loses no
  information and gains the per-product coverage that unlocks partial-delivery computation. This is
  also why the package carries a cross-cutting change away from naming orders by their code at all,
  in favour of "the order from 6 May, Pop Dealer Store" (`FR-05-67`).
- **Require a price before a product may be named in an allocation.** Would make the mandatory
  assignment unsatisfiable on precisely the orders that need it most (unpriced products in
  multi-product orders). Naming is not pricing; the order's own ceiling still bounds the money.
- **Make assignment mandatory everywhere, including inside an order.** Uniform and pointless: from
  inside an order the money cannot go orphan, so the requirement would buy nothing and would convert
  ADR 0028's optional breakdown into a toll on the most frequent payment path.
- **A mandatory field with no escape hatch.** Produces confident garbage. See §5b: a wrong
  attribution is worse than a declared non-attribution, and the suspense account is the established
  answer.
- **Let parked money reduce the store's debt while it waits.** It is what happens today by
  construction, and it is the mechanism of §4's leak. Money that names no order cannot be allowed to
  discount an order.
- **Prorate the unassigned pot across the store's open orders when one closes.** The tempting
  "fair" version of §4, and it is precisely the derived split ADR 0025 forbade and ADR 0028
  measured wrong by −47% to +72%. `min(balance, unassigned)` against one named order is a rule the
  collector can read on screen and undo; a spread is a guess printed as a fact.
- **Ask at close and honour a skip (do nothing when the collector dismisses the prompt).** Rejected
  by the direction-of-error argument: skipping is the common case, and the outcome of skipping must
  be the visible error, not the silent one.

## Consequences

- **Two numbers now exist where the collector had one**, and they can differ: "Pendiente en pedidos
  abiertos" and "Pagos que no registraste". That is the point, and it is also a new way to be
  confused. The label change is not cosmetic, it is what keeps the first number readable.
- **The displayed debt and the validation ceiling diverge on purpose.** A payment can be accepted
  against headroom the collector cannot see on screen (a closed order's balance). That asymmetry is
  deliberate, is what keeps late payments possible, and will look like a bug to anyone who finds it
  without this record.
- **Both halves are no-ops on today's data** (0 delivered orders with a balance, 0 unassigned money
  in 122 store/currency pairs). They are insurance against a failure mode that has not fired yet,
  which means the first real evidence that they work correctly will arrive after they ship.
- **This design will create the first orders that mix allocations with a product and allocations
  without one.** Today 0 of 565 do. No screen has rendered that combination and no test covers it;
  it is the largest visual risk in the package, and §5a is one of the two paths that produces it
  (ADR 0032 §3 is the other).
- **The native-usage evidence is 7 orders**, 5 of them from the last week, and 96.3% of the payment
  history is a Notion backfill that fused advance and balance into one row. Every claim here about
  how the collector assigns money rests on that thin slice and should be re-measured after a couple
  of months.
- **A store payment becomes harder to record than it is today**: the equality rule means the sheet
  cannot be submitted half-assigned, and the escape hatch has to be found and chosen. The collector
  already assigns everything (0 unassigned across 122 pairs), so the cost falls on future users and
  on the day he pays for something he cannot yet identify.
- **Parked money needs a home on screen** that is clearly not debt and clearly not credit ("a
  favor", ADR 0025 decision 4, already occupies the negative-debt slot). Three money states now
  coexist per store: owed, parked, in the collector's favour.
