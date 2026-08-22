---
title: "ADR 0032 - The delivery is the proof of payment, so marking one settles the order"
date: 2026-08-20
status: accepted
session: saldar al recibir + cuadre de caja (spec approved by the collector 2026-08-20, four red-team passes)
owner: Sergio Minei
trigger: the collector asked for a "ya pagué el resto" shortcut while marking an arrival, because in his market the store does not hand the product over until it has been paid in full, so every arrival he records is also a payment he then has to remember to record separately. Measured on the dev database (real history, read-only census 2026-08-17/18): 565 orders and **0 delivered with an outstanding balance**, 524 of 525 orders with their last payment on or before the delivery date, and a median lag of **1 day** between paying the balance and receiving
updates: docs/product/prd-02-collector-app/frd-08-delivery-management/frd-08-delivery-management.md, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md, docs/product/glossary.md
extends: ADR 0025 (store-level payments with declared allocations), ADR 0026 (declared product payment coverage), ADR 0028 (order-scoped payment breakdown), ADR 0022 (refusing inside a transaction)
---

# ADR 0032 - The delivery is the proof of payment, so marking one settles the order

**Implemented 2026-08-20 (uncommitted, staging), via `FRD-08 · WO-08`.** It records a decision the
collector approved on 2026-08-20; the requirements it governs live in `FRD-08` (`FR-08-39` …
`FR-08-45`, `BR-08-14` … `BR-08-18`) and `FRD-05`, and the build is tracked by their work orders.

## Context

### The axiom, and why it is a market fact rather than a habit

In the collector's market (B2C collectibles in Peru) **the store does not release the product until
it has been paid in full**. The verified flow is: quote, advance (~32% median), import (~25 days
median), arrival at the store, balance paid, handover (~1 day median after the payment). The
collector has bought from more than 100 stores and not one has ever extended him credit.

Three consequences are used as premises throughout:

- **A delivery proves a payment.** It is not a hint, it is structural evidence.
- **An order delivered with an outstanding balance is not a debt, it is a bookkeeping error.**
- Recording the arrival and recording the balance are, in this market, one event that the product
  currently forces the collector to enter twice.

The census backs the axiom rather than assuming it. Of 565 orders, **0 are delivered with an
outstanding balance**; 524 of 525 have their last payment dated on or before the delivery; the
median lag between the balance payment and the handover is **1 day**, and 16 of 17 measurable cases
fall between 0 and 3 days.

### Why the ERP "goods received not invoiced" pattern does not apply here

Every ERP the payment model has been benchmarked against (Odoo, ERPNext, QuickBooks) carries some
form of **GRNI**: goods received, not yet invoiced, therefore an accrued liability sitting between
receipt and payment. That pattern exists because it models **B2B trade on credit**, where receiving
the goods is precisely the moment a payable is _created_. Here the sequence is inverted: payment is
the precondition of receipt, so the interval GRNI exists to describe has a measured median of
**1 day and a measured population of zero**.

This is not a rejection of the benchmark, it is a statement of its scope. GRNI is the right answer
to "what do I owe for goods I already hold?" The answer in this market is "nothing, or you would not
be holding them", and a product that models the general case anyway would be asking its user to
maintain a liability that never exists. The benchmark stays authoritative wherever the collector
genuinely receives before paying (it does not happen today, and nothing here prevents recording it
when it does): what this ADR fixes is the DEFAULT.

### What the data allows the app to compute, and what it does not

- **Multi-product orders:** 268 of 565 (47%), holding 80% of all products.
- **Split deliveries** (products of one order arriving across more than one delivery): **7 orders,
  1.2%**. Every native-usage figure in this ADR rests on that sample.
- **Only 2 of 9 live multi-product orders** can have a partial balance computed today (§2), i.e.
  0.7% of the history.
- **96.3% of all payments** come from the 1:1 Notion backfill, which fused advance and balance into
  a single row. In the population with native activity, 73.9% carry two payments (advance and
  balance), which is the shape this feature is designed around.
- **338 allocations already name a product, 293 do not, and 0 orders mix both forms.** This design
  creates the first mix (§3), and no existing test covers how that renders.
- `Delivery.cost` is 0 on all 531 deliveries. The column exists and has never been populated.

## Decision

### 1. The settlement rides on the arrival window, pre-checked

A checkbox, **"Ya pagué el resto" / "I already paid the rest"**, lives inside the existing arrival
window (`QuickArrivalModal`, titled "Ya me llegó"), **immediately below the "¿Cuándo llegó?" field**
and above the "Añadir costo y fecha de salida" disclosure. The placement is load-bearing: the
payment date is inherited from the arrival date, so the two must be read together.

It comes **pre-checked**, because the axiom says the normal case is that the money already moved.
It can be unchecked, and unchecking records the arrival without touching money, exactly as today.

Scope is the five "Ya me llegó" launchers: desktop order detail (`OrderActionsCard.tsx`), mobile
order detail (`OrderDetailClient.tsx`), the orders list (`OrderListRowActions.tsx`), the dashboard
(`DashboardActivityQuickArrival.tsx`) and the per-store batch (`StoreGroupedView.tsx`). All of them
converge on `createDelivery` / `markDeliveryDelivered` in
`src/lib/data/deliveries/deliveryMutations.ts`, and **none of the six delivery functions touches
payment today** (verified). The "listo en tienda" chip (`orderMutations.ts`) is not a delivery and
must trigger nothing.

### 2. The amount is computed when it can be and asked when it cannot, never estimated

**Branch A, the delivery leaves the order COMPLETE** (every one of its products delivered):
`amount = totalCost − allocatedAmountMinor`. Always computable, with no per-product price and no
prior breakdown. This is roughly 99% of cases. **Superseded by `ADR 0034`'s canonical `openBalanceMinor`**
(`totalCost` minus allocations minus reconciliation adjustment lines) once that ADR ships: this ADR predates
`StoreAccountAdjustmentLine`, so its own formula here is gross and does not net out a store reconciliation.

**Branch B's computed sum also needs a cap `ADR 0034` adds (round-4 arbitration).** Branch B's per-product
formula below cannot see a `StoreAccountAdjustmentLine` either, since a reconciliation line is written per
order, not per product: an order carrying one could otherwise have its computed sum exceed the order's real
remaining balance. `FRD-08 · WO-08` caps Branch B's computed sum at `min(that sum, openBalanceMinor(order))`
and, when the cap actually reduces it, drops the per-product breakdown for one undetailed allocation instead
of scaling the per-product lines to fit, since scaling would itself be the proportional estimate `ADR 0025`
already forbids. This ADR's own text below, describing Branch B before `ADR 0034` existed, is silent on this
cap; `FRD-08 · WO-08` is the current source of truth for it.

**Branch B, the delivery is PARTIAL.** Computable only if **both** hold:

- (a) every delivered product has a non-null `unitPrice`, **and**
- (b) the order carries no allocation with `orderItemId IS NULL` (no undetailed money).

Condition (b) is the one that bites. If the advance was never broken down, the app cannot know how
much of it belongs to the products that just arrived, so the "remaining per product" would come out
**inflated**. Measured: only 2 of 9 live multi-product orders satisfy it.

When computable: `amount = Σ over delivered products of (its base − what is already allocated to
it)`, where `base = unitPrice × quantity`, or `totalCost` when the order has a single product.

When not computable: **the field is left blank and the collector types the amount**, capped at
`totalCost − allocated`. The app prints what it does know as a **reference and never as the answer**
("Del pedido entero faltan {monto}"), and says why it cannot compute it ("No tengo el precio de
estos productos, así que dime cuánto pagaste").

**Prorating to estimate is forbidden**, in every branch, per ADR 0025 and reaffirmed by ADR 0028:
the measured error of a derived proportional split on this collection ran from −47% to +72%.

### 3. Only what the app itself computed gets a per-product breakdown

The money written by this flow is an ordinary `StorePayment` with `PaymentAllocation` rows, and it
obeys ADR 0028's rule about what may be detailed:

- **If the app computed the amount, it may detail it per product**, because it computed it per
  product in the first place.
- **If the collector typed or corrected the figure, the allocation is written undetailed**
  (`orderItemId = null`). Splitting a number the user wrote would be inventing a declaration the
  user never made, which is the exact line ADR 0028 draws between a declaration and a derivation.
- Any surplus belonging to no product (shipping or fees typed into the total) stays undetailed,
  which is already ADR 0028's rule.

The delivered products are additionally marked settled through `declarePaidItemIds`, a parameter
`createStorePayment` **already accepts**, so the per-store view says "Saldado" instead of a
misleading percentage. **ADR 0026 is untouched by this:** `OrderItem.paidDeclaredAt` still moves no
money (invariant I1); here it rides ALONGSIDE money that a separate allocation moved, which is
precisely the coexistence ADR 0026 §7 already contemplates.

### 4. Two transactions, not one, and ADR 0022 is the reason

The arrival is written first, exactly as today; the payment is written second, in its own
transaction.

"The arrival is never blocked" and "arrival plus payment in one Serializable transaction with
retry" are incompatible requirements. A serialization failure is only detectable **at commit**,
which is the late refusal ADR 0022 exists to forbid: past the first write, a refusal can no longer
be a `return`, and the only honest exit is a throw that discards the arrival the collector already
watched succeed.

So: if the payment transaction fails after its retries, **the arrival is already recorded** and the
UI offers **Retry**. The state "delivered, payment pending, retry" is a real state and must survive
navigation.

**The amount never comes from the client.** Each retry recomputes the plan on the server; replaying
a client-held figure would repeat a number that the intervening writes may have invalidated.

### 5. One `StorePayment` per ORDER, never one per (store, currency)

A batch arrival covering N orders writes N payments. Grouping them into one payment per (store,
currency) would be tidier on paper and is rejected for two reasons:

- **Payments cannot be edited today.** A single payment spanning N orders turns any correction into
  "delete and rebuild the other N−1", which is the failure mode ADR 0028 §5 already recorded when
  it made the TRANSFER the ledger unit.
- **FX inheritance.** A per-order payment inherits that order's `exchangeRate` verbatim, which is
  what ADR 0031 leaves as the payment boundary's honest behaviour. A payment spanning several orders
  has no single pair to inherit.

Orders already settled contribute no line to a batch.

### 6. Provenance: `StorePayment.settledByDeliveryId`

A new nullable column, FK to `Delivery`, **`onDelete: Restrict`**. Not `SetNull`: a silent detach
would leave a payment nobody can trace back and nobody can reverse, i.e. money the product created
and can no longer undo.

### 7. The date is proposed, not imposed

The arrival date is proposed as the payment date and is **editable** (the collector's own call). The
median error is 1 day, but there is a real case in the history with a 14-day gap, and there is no
way for the app to tell the two apart.

### 8. The double-counting guard

If that (store, currency) is holding **money already paid and not yet assigned**, the checkbox is
**NOT pre-checked**, and the flow offers to assign that money first ("En {tienda} tienes {monto}
pagados sin asignar").

The reason is precise: the store-debt ceiling of ADR 0025 protects the AGGREGATE. It does not stop
the same order from being paid twice by two different routes, once as loose money in the store's
pot and once here. This is the only red-team attack that survived, mitigated rather than eliminated,
and a pre-checked box defaults to the side that CREATES money, so the guard has to sit exactly here.
ADR 0033 closes the other half of it by making that pot impossible to leave orphaned.

### 9. Reversibility and idempotency

- `reopenDelivery` deletes the `StorePayment` rows whose `settledByDeliveryId` is that delivery,
  recomputes the caches, and reports the amount reverted ("Entrega reabierta y {monto} devueltos al
  saldo pendiente").
- The **Undo** of a reopen must pass the settlement flag **explicitly, with no default**, and
  restore the reverted amount **verbatim, without recomputing**. Otherwise undo could mint money on
  an old delivery that never had a settlement.
- Marking twice is impossible: a product can only belong to one live delivery.
- Reopen then re-mark: the reopen deleted the payment, the re-mark recomputes it. No double charge.
- Batch order is deterministic: `orderDate ASC, humanReadableId ASC`. It has to be stated, because
  38 pairs of orders tie on `orderDate`.

### 10. Forward only. No retroactive migration.

A backfill would be a no-op today (0 delivered orders carry a balance) and would falsify payment
dates on 522 closed orders. The rule is a ratchet that only acts going forward.

### 11. The delivery cost stays out of it

`Delivery.cost` is not recorded by this flow, does not touch store debt, and does not reach the
dashboard until a user asks for it. All 531 deliveries carry 0.

### 12. One variant stays OPEN, and is recorded as open

**Undecided:** whether the settlement checkbox also belongs in the **formal shipment flow** (the
create-delivery wizard, `createDeliveryAction.ts`, and "Marcar como llegada",
`DeliveryDetailClient.tsx`), or only in the five "Ya me llegó" launchers.

The nuance that makes it a real question: in the formal flow more time passes between paying and
marking the arrival, so there the box should probably **not** be pre-checked, and the date should be
**asked** rather than proposed. That is a different control with a different default, not the same
one on another screen.

This is documented as pending, deliberately. Neither this ADR nor the FRD invents an answer.

**Narrowed (added 2026-08-20, round-4 arbitration, `ADR 0033` §3).** This open question is about the
settlement **checkbox and its UI only**. `ADR 0033`'s order-close consumption of unassigned store money is a
different question, already answered: it runs behind whichever mutation actually closes an order, `Marcar
como llegada` (`markDeliveryDelivered`) included, whether or not that flow ever gains a settlement checkbox of
its own. A collector who closes an order through the formal flow must not leave that store's unassigned money
stranded either. See `FRD-08 · FR-08-46` and `WO-08`.

### Copy (es / en)

| Where            | es                                                                  | en                                                                    |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Checkbox         | Ya pagué el resto                                                   | I already paid the rest                                               |
| Detail           | Se registrará un pago de {monto} con fecha {fecha}.                 | A payment of {amount} dated {date} will be recorded.                  |
| Partial delivery | Cubre los {n} productos que estás recibiendo.                       | Covers the {n} products you are receiving.                            |
| Cannot compute   | No tengo el precio de estos productos, así que dime cuánto pagaste. | These products have no price on record, so tell me how much you paid. |
| Reference        | Del pedido entero faltan {monto}.                                   | {amount} is left on the whole order.                                  |
| Help             | Desmárcalo si todavía debes ese dinero.                             | Uncheck it if you still owe that money.                               |
| Confirmation     | Llegada anotada y {monto} registrados como pago.                    | Arrival recorded, and {amount} logged as a payment.                   |
| History          | Registrado al anotar la llegada                                     | Recorded when the arrival was logged                                  |
| On reopen        | Entrega reabierta y {monto} devueltos al saldo pendiente.           | Delivery reopened, and {amount} went back to the outstanding balance. |
| Unassigned money | En {tienda} tienes {monto} pagados sin asignar.                     | {store} holds {amount} already paid and not assigned.                 |

**"On reopen" is superseded (added 2026-08-20, round-4 arbitration, `ADR 0033`'s close-time consumption).** The
single-amount sentence above only describes the settlement half of a reopen being deleted; it predates the
order-close consumption of `FR-08-46` and does not distinguish the reverted settlement amount from any
already-paid money that stays applied to the reopened order. The row above is kept here as the historical
record of what this ADR originally approved; the two-amount replacement copy that ships instead is defined in
[`FRD-08 · WO-08` § UX Notes, "Reopen-reversion copy names both amounts when both apply"](../../product/prd-02-collector-app/frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-08-settlement-on-arrival.md#ux-notes).

## Alternatives considered

- **Anchor the feature on the "listo en tienda" chip (`ARRIVED_AT_STORE`) instead of the delivery.**
  The most tempting option, because the chip is nominally the moment the goods reach the store, and
  it lost on four independent counts. It **stores no date**, so a payment raised from it would have
  no honest date to carry. It is a **free toggle** that is also entered by cancelling a shipment, so
  it is reached by a path that is not an arrival at all. It acts on **one loose product at a time
  with no batch**, so the multi-product case it is supposed to help would be entered product by
  product. And the collector barely uses it: **14 of 1,492 items**. Against that, the delivery is
  dated, batched, reversible, and its measured lag from the real payment is 1 day.
- **Model the interval with the ERP GRNI pattern.** Correct for B2B credit, wrong here: the
  liability GRNI accrues has a measured population of zero in this data (see Context). Adopting it
  would ask the collector to maintain an account that is always empty, and would keep the double
  entry this ADR removes.
- **One transaction for arrival and payment.** Atomic and wrong. The refusal that matters
  (serialization) only appears at commit, so it is the late refusal ADR 0022 bans, and paying for
  atomicity here means occasionally throwing away an arrival the collector already saw succeed. The
  arrival is the fact; the payment is the inference. Losing the fact to protect the inference is the
  wrong trade.
- **One `StorePayment` per (store, currency) for a batch.** Rejected in §5: payments are not
  editable, so it converts one correction into N.
- **Derive the partial amount by prorating the order total across its products.** Forbidden by
  ADR 0025 and re-forbidden by ADR 0028. Measured error −47% to +72%.
- **Push the collector to fill in per-product prices so branch B always computes.** Rejected
  outright. The prices are missing because he does not have them and is not going to reopen months
  of chat logs. The feature has to be useful without that column, which is why branch B degrades to
  a typed amount instead of a blocked flow.
- **Leave the checkbox unchecked by default.** Safer against §8's double-count and worse against the
  axiom: the default would be wrong in ~99% of cases, and a default that is usually wrong trains the
  collector to click past it. The chosen shape keeps the pre-check and moves the safety to the one
  condition where the risk is real (unassigned money in that store).
- **A separate "settle" step after the arrival.** It is what the product does today, and it is the
  problem: two entries for one event, with the second one relying on memory. The measured evidence
  that they are one event is the 1-day median lag.
- **Backfill the history.** No-op today and falsifies 522 closed orders' payment dates.
- **`onDelete: SetNull` on `settledByDeliveryId`.** Cheaper migration, and it converts a deleted
  delivery's payment into money with no provenance and no way back. `Restrict` fails loudly instead.

## Consequences

- **Counting the same money twice is mitigated, not eliminated.** The store-debt ceiling guards the
  aggregate, not the route, and §8's guard is a default, not an invariant. This needs a dedicated
  test, and it is the one risk the red team could not close.
- **The evidence is small and should be re-measured.** The "1 day" lag comes from 17 orders; the
  population with genuine native app usage is **7 orders, 5 of them from the last week**; split
  deliveries are 7 orders (1.2%). Every number in §2's branch analysis inherits that sample size.
  Repeat the census after a couple of months of real use before hardening any of it.
- **This design creates the first order that mixes allocations with a product and allocations
  without one.** Today 0 of 565 orders do (338 with, 293 without, cleanly separated), so no screen
  has ever rendered that combination and **no test covers it**. It is the largest visual risk in the
  package, and it lands on the per-store view and the order payment history at the same time.
- **A new persistent state appears between the two transactions:** "delivered, payment pending,
  retry". It has to render clearly and survive navigation, or the collector ends up with a delivery
  recorded and money silently missing, which is the exact failure this ADR set out to remove.
- **`paidDeclaredAt` and this checkbox will coexist on the same product.** A product the collector
  already marked as paid (ADR 0026) will still be offered the order's balance here, because that
  mark moves no money **by design**. That reads as a contradiction on screen the day the mark gets
  used, and the resolution is copy, never making the mark move money.
- The `StorePayment` row gains a provenance column that is meaningful for exactly one creation path,
  and `Delivery` gains a `Restrict` dependency that will refuse deletions the product currently
  allows.
- One question stays open (§12) and blocks nothing in the five "Ya me llegó" launchers.
