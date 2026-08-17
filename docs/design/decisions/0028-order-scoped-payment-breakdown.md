---
title: "ADR 0028 - Order-scoped payment breakdown: declared proportional split, ceilings as permission"
date: 2026-08-15
status: accepted
session: store-level payments v5 (order detail breakdown, spec v9 after five red-team passes)
owner: Sergio Minei
trigger: the collector asked to say how much of one payment goes to each product of a multi-product order, on the 8 of his 559 orders that have more than one product and an open balance; every one of those 8 already carries money declared against no product, so "what does this product still owe" has no answer and the panel had to answer a different question
updates: src/lib/orders/splitPaymentAmount.ts, src/lib/orders/orderPaymentBreakdown.ts, src/app/[locale]/(app)/orders/[id]/_components/OrderPaymentBreakdownPanel.tsx, src/app/[locale]/(app)/orders/[id]/_components/OrderPaymentBreakdownRow.tsx, src/app/[locale]/(app)/orders/[id]/_components/OrderInlinePaymentForm.tsx, src/app/[locale]/(app)/orders/[id]/_components/OrderDetailClient.tsx, src/lib/data/orders/orderPaymentMutations.ts, src/lib/data/orders/orderPaymentAllocations.ts, src/lib/data/orders/orderQueries.ts, src/lib/orders/productPaymentState.ts, src/components/core/MoneyAmountInput.tsx
extends: ADR 0025 (declared allocations), ADR 0026 (declared product coverage), ADR 0027 (figures partition, never replicate)
---

# ADR 0028 - Order-scoped payment breakdown: declared proportional split, ceilings as permission

## Context

The order detail's inline payment form records money against one order. On a multi-product order the
collector wanted to say **which products that money is for**, and the obvious framing was "show what
each product still owes and let me fill it in".

That framing has no answer on the orders it would serve. Measured on the collector's own database:
of 559 orders, **8** are non-cancelled, hold more than one product and still owe money. **All 8 of
them** carry money declared at order level with no product named — S/ 1.106,60 across 14 payments.
That money is not attributed, so what a product still owes is not a fact the system holds, and
deriving one means splitting the pool backwards.

Splitting the pool backwards is precisely what ADR 0025 rejected, after measuring a derived split
against the collector's real history and finding it wrong by **−47% to +72%**. ADR 0026 reaffirmed
it. Answering the question anyway produced, on ORD-20260305-01, "falta S/ 59,90" and "falta
S/ 185,00" on an order that owes S/ 45,00.

The question that DOES have an answer, and the one the collector was actually asking, is
_**"how much of THIS payment do I put on each product?"**_ — a decision of his, over a budget that
is a verifiable fact, on an order whose balance does not depend on the answer at all.

Three further facts shaped the rest:

| Fact                                                                                      | Consequence                                                      |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Equal parts only adds up when every product costs the same                                | proportional to price becomes the default (`FR-05-54`)           |
| **No payment in the system has more than one allocation** (626 payments, 626 allocations) | six downstream sites assume 1:1 and are latent, not exercised    |
| 209 of 266 multi-product orders have **no unit price at all**                             | the real lever is capturing prices, not the split (out of scope) |

## Decision

### 1. A proportional split is a DECLARATION the collector triggers, not a derivation the app applies

The rule is `denom = max(totalCost, Σ precios)`, `pct = P / denom`, `línea_i = pct × precio_i`. That
is the collector's own stated rule, in his words: "sumas el total del pedido, tienes el monto que se
pagó, sacas qué porcentaje es sobre eso [...] y divides el adelanto según ese porcentual".

**This does not reopen what ADR 0025 rejected, and the difference is the nature of the act, not the
arithmetic.** There, the app would have inferred an attribution nobody stated, silently, over
history. Here the collector ticks the products under a heading that says "marca los productos que
cubre este pago", sees the exact figures before saving, edits any line by hand, and what is stored is
ordinary declared amounts. Four properties, all absent from the derivation.

**And this has to be said plainly, or it will look like a measurement was reversed in silence:** ADR
0025 measured a _derived_ split against real data and found it "actively wrong on the owner's own
historical data" (−47% to +72%). This ADR adopts the proportional rule on the collector's
**testimony** about how he pays, and **there is not one historical payment to validate it against** —
all 626 existing allocations are single-line, so no real distribution has ever been observed. It is
legitimate _because_ the act changed, and for no other reason. **If anyone ever wants to DERIVE a
split again, ADR 0025's measurement still stands and still says no.**

### 2. I-7 — the residual has a closed form, in two terms, and is named rather than spread

```
residual = pct × max(0, denom − Σ precios)   +   Σ (ceiling leftovers)
```

This is the exact border between "declaring" and "prorating", and both terms carry a rule:

- **First term.** The part of a payment that falls on what has no price (shipping, fees, products
  with no price captured) belongs to no product. It stays undetailed instead of being spread across
  products that did not cause it. On an order of 150 (100 of products, 50 of shipping) paid 75: 20,00
  and 30,00 to the products and **25,00 undetailed**, which is the right answer and not a shortfall.
- **Second term.** Money a line cannot take because its own price is already covered also leaves the
  split, and is **never handed to the other products**. The test to apply is one line: _a refund is
  legitimate exactly when the sentence the mode puts on screen still describes the result._ "Partes
  iguales entre los marcados" promises no per-product quota, so equal parts DOES refund. "Cada
  producto recibe el mismo porcentaje de su precio" promises one, so by-price does not.

The single movement that is permitted is the sub-step rounding remainder, and only inside a stated
bound: **no line ends above `ceil(its own quota)`**. Without that bound "moving a rounding leftover
is not redistribution" is a definition rather than a property, and the test that guards it is
decorative. What guards it is `splitPaymentAmount.test.ts`'s property sweep: **5.000 iterations from
a fixed seed** (`20260814`), over one to six products, both currency steps, unpriced lines, hard
ceilings, shipping and discounts, asserting the bound on every line of every case, plus never
overspending and never breaking a ceiling. (**Corrected 2026-08-15:** this paragraph used to claim
"0 violations over an exhaustive 291.200-case sweep". The property holds and is tested; the sweep is
seeded-random rather than exhaustive, and that figure was reproducible from nothing in the repo.)

### 3. I-1b applies here too: nothing in the list replicates the payment

Adopted from ADR 0027, and this surface is where it bites hardest. A per-row ceiling is correct line
by line and false in aggregate: with an empty draft, every row's ceiling is the whole payment, so on
ORD-20260509-03 (six products, no prices) six rows would each advertise the full S/ 280,00 —
**6,0× the money that exists**. So the budget is named ONCE, above the list; rows print only static
facts about their own product; and the fill control shows the word **"Máx."** with the amount in its
accessible name.

### 4. I-1 applies per line: the figure shown is the figure written

The fill control's accessible name and what it writes are one `computeFillableMinor` call, shared
with the store payment sheet, never two similar calculations.

### 5. An order's payment ledger groups by TRANSFER, which changes the delete contract

A broken-down payment writes N+1 allocations. Rendering one row per allocation would paint one
transfer of S/ 65,00 as three payments with three delete buttons, where deleting one silently changes
what the other two mean. So the unit becomes _"what this order claims of one transfer"_: the 1:1
mapper is removed from the export, all three callers group by `paymentId`, and a delete acts on the
pair (payment, order), taking this order's whole claim and leaving a payment shared with other orders
alive with theirs. `orderPaymentDeleteSchema` keeps `min(1).max(64)` when renaming its field:
**606 of 626 payments (96,8%) carry a 29-character `mig_*` id** from the Notion migration, and
narrowing to `cuid()` would make them undeletable — deleting being the collector's only correction
path.

### 6. With undetailed money on the order, "Por tienda" stops printing a per-product ratio

This split writes item-level allocations onto orders that also carry an unsplit pool, so a product's
item-level share is a **floor**, not what it was paid. `resolveProductPaymentState` therefore takes
`orderHasUndetailedMoney` and resolves to a new `"partial-undetailed"` state, rendered like
`"unpriced-partial"`: the declared amount, no bar and no percentage ("No denominator, no bar"). With
a pool the denominator is unknown for want of attribution rather than for want of a price, but it is
just as unknown. Without this, ORD-20260305-01 would read **90% paid** on the order and **8%** on each
of its products.

**All THREE surfaces, and the optimistic tick too (completed 2026-08-15).** The rule is only kept
where the state is rendered: the order detail's own product list resolved `"partial-undetailed"` and
then drew nothing at all for it, printing no figure for a product that does carry declared money, so
it now states the amount with the same copy the two "Por tienda" surfaces use. And the store-grouped
view's optimistic payment patch moved `allocatedMinor` without moving `orderHasUndetailedMoney`, so
for the length of the round trip a row repainted precisely the ratio this point suppresses.

## Alternatives considered

| Alternative                                                           | Why not                                                                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Show "what each product still owes" and let the collector fill it in  | The figure does not exist on 8 of the 8 orders this serves; producing one means the prorating ADR 0025 measured wrong twice  |
| Prorate the pool backwards to seed the split                          | Same thing wearing a different hat                                                                                           |
| Equal parts as the default                                            | Only adds up when every product costs the same; the collector's own words are that it "no cuadra"                            |
| Refund a ceiling leftover to the other products (by-price)            | Contradicts the caption the collector is reading; on the test case it paid one product its FULL price out of a 50% payment   |
| Send the sub-step rounding leftover to the residual too               | Breaks exact closure: JPY 33/67 paid in halves would leave a product at 66 of 67                                             |
| An editable field for the residual                                    | In the store sheet the residual is a decision (which order gets what); here 100% lands on this order, so it is a consequence |
| Accept the wrong per-product ratio in "Por tienda" and note it in §14 | ADR 0027 had just reverted exactly this defect on the sibling surface, using the invariant that came out of this work        |
| Promote `StorePaymentAllocationRow` for reuse                         | Three structural differences (no per-row figure, a checkbox, no order reference) parameterised for two consumers             |

## Consequences

### Positive

- The panel answers a question that has an answer, and the order's balance is provably independent
  of it (`BR-05-22`), so no screen can contradict another.
- The residual is **explicable** rather than a mute leftover: `FR-05-54` and `BR-05-24` predict it to
  the cent, and the foot names which of the two terms produced it.
- Fixing the ledger unit (`BR-05-23`) disarms four latent defects in the store payment sheet, which
  already emits N+1 allocations from `buildAllocationInputs` with zero rows having exercised it.
- `AllocationAmountInput` becomes `core/MoneyAmountInput`, so a route-level component no longer has
  to import a field out of `modules/StorePaymentSheet/`.

### Negative / tradeoffs

- **The collector will see FEWER percentages in "Por tienda" after this change, not more.** That is
  decision 6 and it is deliberate: with a pool, the honest render is the amount and no bar.
- **This does nothing for old orders.** S/ 1.106,60 already sits unattributed on those 8 orders and no
  future breakdown touches it. The only path is delete-and-re-record, which the pool strip names.
- **A hard ceiling can leave a product one step short of its price**, and that step goes to the
  residual. On an unsettled order the product then reads 99% in "Por tienda" (or, with a pool, the
  amount). One step at most, always named as undetailed, but it is a figure the collector looks at.
- `ITEM_HAS_ALLOCATION` will block editing a few more products. Accepted: it already blocks **293 of
  1.488 (19,7%)** without a single complaint, so this is a marginal increase on a live baseline, and
  it is the trade ADR 0025 accepted under "Edit guards multiplied".
- **No idempotency key.** Treating an unanswered submission as resendable can duplicate a payment.
  Accepted here because the duplicate is born on the order the collector is looking at, in the card
  in front of them, with its own delete button, and recovering a six-line draft is worth more.

## Enforcement

- `src/lib/orders/_tests/splitPaymentAmount.test.ts` — the split rule, the rounding rule and its
  bound, the ceiling, and I-7 in all three of its shapes including the discount counterexample.
- `src/lib/orders/_tests/orderPaymentBreakdown.test.ts` — eligibility, the emitted payload, the mode
  default.
- `.../orders/[id]/_components/_tests/OrderPaymentBreakdownPanel.test.tsx` — I-1, I-1b (counted
  **inside** `getByRole("list")`, with and without ticked rows), I-2, I-3, I-5, I-6 and E5.
- `.../orders/[id]/_components/_tests/OrderDetailClient.test.tsx` — the conditional close, the
  authoritative inline error, the refused-line marking and the `unanswered` flag.
- `src/lib/orders/_tests/productPaymentState.test.ts` and
  `.../orders/_components/_tests/StorePendingProductRow.test.tsx` — decision 6, in both halves (no
  progressbar AND the amount still present).
- `src/test/component-inventory-guard.test.ts` fails until `MoneyAmountInput` is in
  `docs/design/components.md`; `src/test/transaction-refusal-guard.test.ts` fails if the per-allocation
  subunit check lands after the first write.

## References

- [ADR 0025 - Store-level payments, declared allocations](0025-store-level-payments-declared-allocations.md)
  — §Decision 7 (the `addOrderPayment` door) and §Alternatives 1 (the derived split, still rejected).
- [ADR 0026 - Declared product payment coverage](0026-declared-product-payment-coverage.md) — §6 (order-level
  money is named, never split) and §7 (the coverage axis lives on the product's own row).
- [ADR 0027 - Figures in the store payment allocation list partition, never replicate](0027-allocation-list-figures-partition-never-replicate.md)
  — I-1 and I-1b came out of this work and landed there first; the sibling surface's defect is
  **resolved**, not an accepted exception, which is what makes decision 6 obligatory rather than
  optional.
- `FR-05-42c`, `FR-05-52`, `FR-05-53`, `FR-05-54`, `BR-05-22`, `BR-05-23`, `BR-05-24` in
  `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md`.
