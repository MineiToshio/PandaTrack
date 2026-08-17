---
title: "ADR 0027 - Figures in the store payment allocation list partition, never replicate"
date: 2026-08-14
status: accepted
session: store-level payments v5 follow-up (defect found by red-team on the store payment sheet, 2026-08-14)
owner: Sergio Minei
trigger: on ORD-20260305-01 the sheet advertised "Falta S/ 59,90" and "Falta S/ 185,00" against an order that could still take S/ 45,00, and pressing either control wrote 45,00; the figure the row printed and the figure the control wrote were two different calculations
updates: src/components/modules/StorePaymentSheet/StorePaymentAllocationPanel.tsx, src/components/modules/StorePaymentSheet/StorePaymentAllocationRow.tsx, src/i18n/locales/es/orders.json, src/i18n/locales/en/orders.json, src/components/modules/StorePaymentSheet/_tests/StorePaymentSheet.test.tsx
reverses: the per-product half of the display rule reasoned in `StorePaymentAllocationPanel.tsx` ("A product's is static: its own remaining base")
amended: 2026-08-14, after red-team review — the aggregate invariant was stated against the store's debt, which is a different magnitude from the balances it governs; the order balance shared a line with the shortcut cell; and the three fill-disabled reasons were unreachable copy behind `disabled` + `title`
---

# ADR 0027 - Figures in the store payment allocation list partition, never replicate

## Context

The allocation panel of the store payment sheet ("¿A qué va este pago?") renders one flat list of
payable lines: every product of every standing order of the store, plus a "Resto del pedido" line
where an order's products cannot absorb its whole balance. Each line carried a "Falta" cell that is
also the control: pressing it writes the largest legal amount into the amount field beside it.

Its visible text and its behavior were two different calculations:

- printed `line.lineCeilingMinor`, the product's own remaining price base (`basePagableMinor -
allocatedMinor`), a static figure;
- wrote `computeFillableMinor(...)`, that base capped by what the ORDER still has room for and by
  what is left of the PAYMENT.

**ORD-20260305-01 of Pop Dealer Store, real data read from the dev database on 2026-08-14:**

| Figure                                                             | Amount                                    |
| ------------------------------------------------------------------ | ----------------------------------------- |
| `totalCost`                                                        | S/ 244,90                                 |
| `allocatedAmountMinor` (declared at order level, no product named) | S/ 199,90                                 |
| `assignableMinor` (what the order can still take)                  | **S/ 45,00**                              |
| Printed on "Doflamingo #2237"                                      | Falta S/ 59,90                            |
| Printed on "Tony Tony Chopper #2340 (Pack Chase)"                  | Falta S/ 185,00                           |
| Sum of the printed figures                                         | S/ 244,90 · **5,4x the room that exists** |
| Written by either control                                          | S/ 45,00                                  |

The collector reads two numbers that contradict the balance of their own order, and gets a third
when they press either one.

### This reverses a decision, not an oversight

The comment this ADR removes reasoned the case explicitly. It gave the **rest** line a live figure
(`min(ceiling, assignable - sum of the order's other draft lines)`), warned in writing against the
exact failure of "advertise the order's whole balance and then write far less", and then chose not
to extend the reasoning to product lines: "A product's is static: its own remaining base." Reversing
that is a contract change for this surface, which is why it gets an ADR of its own.

### Why "just print the live ceiling" is not the fix

The natural repair is to print `computeFillableMinor`, the same number the button writes. It is
correct line by line and false as a list. With an empty draft, which is the initial state every
single time, `sumOtherLines = 0`, so every line of an order prints `min(base, orderRoom,
paymentRoom)` and the lines of one order all collapse onto the same number:

| Payment | ORD-20260305-01 would print | Sum   | vs the S/ 45,00 that exists                     |
| ------- | --------------------------- | ----- | ----------------------------------------------- |
| 45,00   | 45,00 / 45,00               | 90,00 | 2,0x                                            |
| 20,00   | 20,00 / 20,00               | 40,00 | 2,0x (and now it is the PAYMENT being repeated) |

The label says "Falta" (a debt) while the number is a function of the amount typed on the previous
panel, and it changes when the collector touches a DIFFERENT row. It is the same defect from the
other side: 5,4x becomes 2,0x, and a lie about the product becomes a lie about the list.

### Why the static base is not a "fact" either

`lineCeilingMinor` is only a validation ceiling. When an order carries money declared against it
with no product named, part of that money morally belongs to each product and nothing records which
part (this is exactly the premise of [0026](0026-declared-product-payment-coverage.md): with
order-level money on the books, "what this product still owes" does not exist). On this order the
bases add up to the full S/ 244,90 while the order owes S/ 45,00. Printing that under the word
"Falta" states a debt the data cannot support.

## Decision

Two invariants govern money inside the allocation list.

### I-1 (per line). What a control writes, what its accessible name promises, and any figure printed on it are one number

There is one calculation, `computeFillableMinor`, and one place it is stated: the fill button's
`aria-label` ("Asignar S/ 45,00 a Doflamingo #2237"), recomputed live. A second display figure is
not allowed to exist in the panel, so the two cannot drift apart again.

### I-1b (aggregate). A figure printed in the list PARTITIONS what it describes; it never replicates it

Formally, for every quantity Q named in the list, the sum of the printed figures derived from Q is
at most Q.

| Figure                            | Aggregate behavior                                 | Allowed |
| --------------------------------- | -------------------------------------------------- | ------- |
| The N amount fields               | `Σ ≤ payment` · partition                          | yes     |
| Per-line ceilings                 | `Σ = N × payment` · replicate                      | no      |
| The order balance, once per block | `Σ = Σ of the listed orders' balances` · partition | yes     |

Adopted from the sibling analysis written for the order-level breakdown panel, which reached the
same rule independently on a single-order surface. The two surfaces now share it.

**The quantity `Q` is named exactly, not by the nearest total on screen.** The balances partition
what the listed orders can still take, and that is NOT the store's debt shown one panel earlier.
They are two different magnitudes:

| Figure              | Formula                                        | Money it counts |
| ------------------- | ---------------------------------------------- | --------------- |
| `Σ assignableMinor` | `Σ totalCost - Σ Order.allocatedAmountMinor`   | **declared**    |
| `debtMinor`         | `Σ totalCost - (Σ StorePayment.amount - lost)` | **paid**        |

Every allocation is part of a payment, so `Σ allocations ≤ Σ payments` and therefore
`Σ assignableMinor ≥ debtMinor`, with equality only while every payment on the store's books is
assigned down to the last cent. This sheet is exactly what breaks that: it prints "Sin asignar: X"
and `storePaymentMutations.ts` refuses only `allocationTotal > amount`, so one ordinary payment with
a remainder is enough to separate them. Writing the invariant against the debt would have been a
claim the code does not make, on a surface built to violate it. The historical corpus (626 payments
on 2026-08-14, all fully assigned) hides this, which is why the rule is stated against the balances
themselves and the test compares against the orders in the props rather than against a debt figure
chosen to match.

### What that means concretely

1. **No row prints a ceiling.** The fill control shows the word "Máx." (`allocations.fillMax`) and
   no amount. The unpriced line keeps its paid-mark toggle and the settled line its "Saldado" chip,
   unchanged.
2. **The order's own balance is named once per order block**, on a line of its own that opens the
   block, beside the order reference it belongs to ("ORD-20260305-01 · Falta S/ 45,00"). This is the
   multi-order adaptation: this sheet spans M orders, so M different balances are M facts that add
   up to what those M orders can still take, not one figure repeated. It is also the figure the
   collector was missing. It gets a line of its own rather than a slot in the product's metadata
   line, because that line is where the shortcut cell folds on mobile: sharing it produced
   "ORD-… · Falta S/ 410,00 · [Máx.]", one statement about the order and one about the product,
   reading as two figures for the same control (on Pop Dealer with a S/ 100,00 payment, 17 balances
   summing S/ 2.355,00 next to a "Máx." that writes at most 100,00). The ratio had been reframed,
   not removed. It is deliberately the PRE-DRAFT balance (`assignableMinor`), so it never becomes a
   payment-derived figure by the back door. It reuses the order detail's own word for that exact
   figure ("Falta" / "left", `detail.payments.remainingToAllocate`), which is the one-vocabulary
   decision the two surfaces already share: the word did not leave the sheet, it moved off the
   product, where it was false, onto the order, where it is true.
3. **The rest line loses its figure too.** Its printed number carried the order's term but never the
   payment's, so with a payment below its ceiling it still said "Falta S/ 18,00" and wrote S/ 5,00.
   That residual survived the earlier fix and dies with the rule rather than with another patch.
4. **The tap target moves into the box.** The label is now a word, so the control no longer inherits
   a wide hit area from a long amount. It takes `min-h-11 md:min-h-0`, the same recipe and the same
   reason as the paid-mark toggle it sits beside (resizing the box, never a `::before`, because the
   amount input is less than 2N away under `md`). `src/test/tap-target-guard.test.ts` cannot see a
   `min-h-*` floor (interface-patterns.md §12 says so in its own words), so deleting both floors
   left the whole suite green; the floors are asserted in the sheet's own test instead.
5. The desktop column header follows the cell: `allocations.colRemaining` ("Falta") becomes
   `allocations.colFill` ("Máx."). `allocations.remaining` is removed.
6. **The inert control keeps its name and its reason.** With no figure to press for, the fill button
   spends much of its life with nothing to write, and the reason has to be reachable. It is
   `aria-disabled` with a no-op handler, never `disabled`: `disabled` takes the control out of the
   tab order (so its accessible name is never read and there is no keyboard route to the reason) and
   brings `pointer-events-none` with it (so the `title` tooltip never opens on desktop, and touch has
   no hover to begin with). The reason travels in `aria-describedby`, pointing at an `sr-only` node
   inside the control, whose id carries the placement because the cell is rendered twice.
   That is the accessibility half. The VISIBLE half is stated once per scope, never once per row:
   `noAmount` on the panel's existing notice, `payment` on a twin notice beside it, and `order` on
   the block's own message anchor when the order's balance is exactly spent, in a neutral tone
   because that draft is legal (`lineOverOrder` only fires on going PAST the balance, so landing
   exactly on it — what "Máx." does — used to leave a block of dead controls and no words). A fourth
   reason, `unavailable`, covers the render where a line's order has not come back from a refetch
   yet; it used to fall through to `payment`, which told the collector they had spent a payment they
   had not touched.

## Alternatives considered

**Print the live ceiling on every row (I-1 only).** Rejected: the arithmetic above. It fixes each
line and breaks the list, and it makes a cell labelled as a debt change when the payment amount
changes.

**Keep the static base and relabel it (for example "Base S/ 59,90").** Rejected: honest as a label,
still unreadable as a list (S/ 244,90 of bases over an S/ 45,00 balance), and it needs the order
balance shown anyway to be interpretable. Once the balance is shown, the base earns nothing.

**Print the price plus what is already allocated per product**, the shape chosen for the
single-order breakdown panel. Rejected here on scope and density: that panel exists to describe ONE
order's products, while this list's job is to route one payment across orders. The product's own
price detail stays where it is already authoritative, on the order detail.

**Drop the figure with no compensation.** Rejected: it would leave the collector with no per-order
budget at all on a multi-order surface, which is precisely the information whose absence let the
defect go unnoticed.

## Consequences

### Positive

- No figure on this surface can contradict the order it belongs to, in either direction.
- One calculation, one statement of it. A drift between shown and written is now impossible by
  construction rather than by discipline.
- The panel finally states the constraint the collector is working against (the order's balance),
  which no version of it did before.
- The residual rest-line defect (the missing payment term) is gone with no separate fix.

### Negative / tradeoffs

- The collector loses a visible per-product number in this list. The number was wrong, but it was
  read; the product's price detail now requires the order detail. Accepted: `Máx.` plus the
  order balance answers the question this sheet actually asks ("how much of this payment goes here").
- Sighted users no longer see the amount the shortcut will write; a screen reader still hears it in
  the accessible name. The same asymmetry the percentage quick-picks of `OrderInlinePaymentForm`
  already accept, and for the same reason: the word is stable and the figure is live.
- Rows are taller on mobile where the 44px target now applies to every assignable line, not only to
  unpriced ones, and the first row of each block is one line taller than its neighbours (the block
  header). The metadata line keeps a `min-h-4` floor so that row's text block does not shrink when
  the reference moves up into the header.
- An inert fill button is now focusable, so tabbing through a fully assigned list stops on controls
  that will not act. That is the cost of the reason being reachable at all, and it is the trade the
  ARIA authoring practices recommend for exactly this case.

## Enforcement

`src/components/modules/StorePaymentSheet/_tests/StorePaymentSheet.test.tsx`, describe "la lista
dice lo que escribe (ADR 0027)", built on ORD-20260305-01's real values mapped through the query's
own `resolveBasePagableMinor` / `computeRestCeilingMinor` rather than through hand-written figures:

- I-1, one case per real product: the amount clicking the shortcut writes is the amount its
  accessible name states, and the shortcut itself prints no money figure. Its sweep is the CONTROL's
  own text, not the row's — the row-wide sweep belongs to I-1b below, and attributing it here would
  overstate what this case sees. In its current state the "printed" list is empty by construction,
  which is the point: it bites again the moment anyone reprints a figure on the control.
- I-1b: the sum of every money figure printed anywhere inside the list is at most the order's own
  balance. This is the row-wide sweep.
- The balance is named once per block, once per ORDER on a two-order list, and the M figures sum to
  exactly the `assignableMinor` of the orders IN THE PROPS — not to a hand-listed pair, and not to
  the store's debt (a separate case builds S/ 34,00 of listed room over an S/ 30,00 debt and asserts
  the list still prints both balances in full).
- The balance does not move when the collector types into the block: it is pre-draft data, and a
  derived one is the back door into the defect this ADR closed.
- The tap-target floors are asserted on the rendered class list of both shortcut controls, because
  no guard in the repo can see a `min-h-*`.

The reader scans rendered text for money figures instead of asserting on specific nodes, so a
regression that moves a figure elsewhere in the row is still caught. It keys on the ISO code
`formatAmountWithSymbol` always appends, not on the `S/` symbol: this sheet is multi-currency, and a
symbol-keyed reader returns `[]` for a list rendered in USD or JPY, which makes both invariants pass
vacuously on exactly the regression they exist to catch (verified: with the fixture switched to USD
and the balance deliberately printed once per row, the symbol-keyed reader reported 3 green while
the code-keyed one reported I-1b red at 9000 against a 4500 ceiling).

**What production data does NOT exercise.** Two of these cases rest on fixtures alone: every one of
the 24 orders with a balance in the dev database has `restCeilingMinor = 0` (read 2026-08-14), so
the "Resto del pedido" row has never rendered against real data. Its behavior under this ADR is
argued and unit-tested, not observed.

## References

- [0025](0025-store-level-payments-declared-allocations.md), which created this sheet.
- [0026](0026-declared-product-payment-coverage.md) §6, "Order-level money is named, never spread",
  the same principle one level up: the money that names no product is stated per order, never split
  across products.
- `docs/design/interface-patterns.md` §12 for the tap-target recipe.
