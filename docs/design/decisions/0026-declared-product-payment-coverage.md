---
title: "ADR 0026 - Declared payment coverage per product, on a second axis from money"
date: 2026-08-14
status: accepted
session: store-level payments v5 follow-up (2026-08-13 design + red-team, implemented 2026-08-14)
owner: Sergio Minei
trigger: 83% of the collector's real order items carry no unit price and a large share of the money paid was declared against an order without naming a product, so the per-product payment cell had nothing honest to say and the only remaining answers were "invent a split" or "stay silent"
updates: prisma/schema.prisma, src/lib/orders/productPaymentState.ts, src/lib/data/orders/orderItemMutations.ts, src/lib/data/orders/storePaymentMutations.ts, src/lib/data/orders/orderMutations.ts, src/lib/data/orders/pendingProductsByStoreQueries.ts, src/lib/orders/storePaymentSheetValidation.ts, docs/design/decisions/0025-store-level-payments-declared-allocations.md, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md, docs/product/glossary.md
supersedes: partially supersedes ADR 0025 Decision point 2 (the `settlesTarget` half of it only)
---

# ADR 0026 - Declared payment coverage per product, on a second axis from money

## Context

ADR 0025 made a payment belong to the store and what it covers an optional
`PaymentAllocation` declaration. That model is honest about money and it stays. What it left
open is the question the collector actually asks while looking at one product: **"is this one
paid?"**

Three facts of the real data make that question unanswerable from money alone:

1. **Most products have no price.** 1,234 of 1,485 order items (83.1%) carry no `unitPrice`, so
   there is no base to compare an allocation against and no percentage that would not be a
   fabrication.
2. **Most money names an order, not a product.** 293 allocations have `orderItemId IS NULL`. Money
   declared at the order level cannot be attributed to any one of that order's products without
   inventing the split, which ADR 0025 already rejected outright and which measured at −47% to
   +72% error against the collector's own history.
3. **The caudal is still open.** `addOrderPayment` writes `orderItemId: singleItemId ?? null`, and
   the inline payment form, the Notion importer and the image intake all go through it. Every new
   payment against a multi-product order creates another order-level allocation.

So the per-product cell had exactly two remaining options: state a number derived from a guess, or
say nothing at all about 83% of the catalog. The first is the anti-pattern this whole payment model
exists to refuse. The second is what shipped, and it is why a collector who genuinely knows a
product is paid had no way to say so.

The natural candidate was already in the schema. `PaymentAllocation.settlesTarget` was designed for
exactly this ("covered in full, amount unknown"), the Zod schema, the mutation and six read branches
all support it, and it had zero rows in use. It was reconsidered seriously and rejected; §Decision
point 3 records why.

## Decision

**A product's payment situation is stated on two independent axes, and only one of them is
money. The coverage axis is a claim the collector makes, it carries no amount, and it moves no
figure anywhere in the system.**

### 1. Two axes, one crossing point

| Axis         | What it holds                                                                                | Who writes it                | Closes the books     |
| ------------ | -------------------------------------------------------------------------------------------- | ---------------------------- | -------------------- |
| **Money**    | `StorePayment` → `PaymentAllocation.amountMinor` → `Order.allocatedAmountMinor` → store debt | the collector, exact amounts | yes, by construction |
| **Coverage** | `OrderItem.paidDeclaredAt`: "this product is paid", no amount                                | the collector, one tap       | never                |

They meet in exactly one place, and it is a statement rather than a correction: when every product
of an order carries the mark and that order still owes money, the payments card says so out loud
instead of leaving two contradictory claims sitting side by side. See Decision point 5.

### 2. The mark lives on the product (`OrderItem.paidDeclaredAt`)

```prisma
/// The collector's own claim that this product is paid, with no amount committed. NEVER written by
/// a derivation: only an explicit user action sets or clears it, and it moves no money figure
/// anywhere (no allocation, no order balance, no store debt, no reminder). `null` = unmarked.
paidDeclaredAt     DateTime?
```

A `DateTime?` rather than a `Boolean`: it costs the same, and "when did I mark this" is the one
question a collector reconciling months later will actually ask. Every existing row is born `NULL`;
the migration backfills nothing, because backfilling would be deriving.

**There is deliberately no order-level mark.** `Order.totalCost` is mandatory on all 560 orders, so
an order's outstanding balance is _always_ known. Declaring an order "settled, amount unknown" would
be a plug in the books, not a claim about something unknowable. The honest equivalent already exists
and it is money, in one tap, on both surfaces: the **"Todo · S/ X"** quick-pick of the order
detail's inline form, and the **"Falta S/ X"** line of the payment sheet's allocation panel.
`setOrderItemPaidDeclared` accepts `OrderItem` ids only, and no endpoint, control or copy for
"order paid without an amount" exists.

> **Amended 2026-08-14 (F1).** This paragraph originally named a _"'Falta S/ X' quick-pick in the
> inline form"_, which never existed under that label: the inline form said "Saldo restante", and
> "Falta" is the payment sheet's own column. Both labels are now named as they actually read.

### 3. Why not `settlesTarget`

Four reasons, each independently sufficient:

1. **It is not editable.** A payment's allocations are fixed at creation; the repo has no edit path
   for them. A collector who marks the wrong product has to delete the whole payment. The request
   here is to state a fact when they know it, which is not the same moment as when they transfer.
2. **It cannot reach the history.** A declaration that can only hang off a _new_ payment says
   nothing about the 293 existing order-level allocations, which are the bulk of the problem.
3. **It re-creates the defect that killed it.** The documented reason the payment sheet stopped
   emitting it (`storePaymentSheetValidation.ts`) is the phantom `S/ 0.00` row it leaves in the
   order's payment history, undoable only by leaving the sheet.
4. **The provenance it appears to add is false where it matters.** "Which payment covered this
   product" is only a real fact when money was assigned to the product, and in that case there is
   already an amount.

**Its disposition: write-strict, read-tolerant.**

- **Write-strict.** `createStorePayment` refuses `settlesTarget: true` with
  `SETTLES_TARGET_UNSUPPORTED`, and the guard runs **before** the amount checks so a
  `{ amountMinor: 0, settlesTarget: true }` payload cannot slip past it. With the flag refused, a
  zero line means nothing at all, so `amountMinor` moved from `min(0)` to `min(1)` in
  `orderValidation.ts` and the mutation enforces the same. `src/test/settles-target-guard.test.ts`
  statically forbids a new writer anywhere in `src/` or `scripts/` (it distinguishes a `data:` write
  from a `select:`/`include:`/`omit:` field selection, which are spelled identically).
- **Read-tolerant.** The six live read branches stay. They cost nothing, and they mean that a `true`
  row arriving out of band (a restore, an import) renders as "Saldado" rather than as the phantom
  `0.00` line that motivated killing the flag in the first place.
- **What actually sustains the deprecation** is not "zero rows in dev" (a dev-only observation) but
  that **no writer has existed since migration `20260808215744`** backfilled every legacy row to
  `false`, and that the pending Notion production cutover runs this same code.

### 4. Case 0 is an entailment, not an estimate

The visible state of one product resolves in one pure function,
`resolveProductPaymentState` (`src/lib/orders/productPaymentState.ts`), shared by every surface:

```
0.  order.totalCost - order.allocatedAmountMinor <= 0  -> "proven"           (Saldado)
1.  base != null && base - allocatedMinor <= 0         -> "proven"           (Saldado)
2.  paidDeclaredAt != null                             -> "declared"         (Saldado · marcado)
3.  base != null && allocatedMinor > 0                 -> "partial"          (bar + %)
4a. base == null && allocatedMinor > 0                 -> "unpriced-partial" ("S/ 8,00 pagados")
4b. base == null                                       -> "unpriced"         (offers the mark)
5.  otherwise                                          -> "none"             (no mark: see below)
```

**Case 4a, added 2026-08-14 (F2).** Money declared against a product with **no** price base used to
fall through to case 4 and disappear from the screen: the row asked "¿marcar pagado?" about a
product that already had money on it. It is reachable today from the payment sheet, which accepts an
amount on a line with no price. The state shows **the amount and never a ratio** — with no
denominator there is no percentage and no bar (`docs/design/interface-patterns.md` §15, "No
denominator, no bar") — and it does not offer the mark, because a figure is more informative than a
claim. It sits **after** cases 0-3, so neither the order's own arithmetic nor an existing mark is
outranked by it.

**Case 5 no longer offers the mark** (2026-08-14, F2): see the amended asymmetry note under
"Negative / tradeoffs".

**Case 0 is the one worth defending.** Because `totalCost` is mandatory, `allocated >= totalCost`
_proves_ the order owes nothing, and therefore that no product of it owes anything. That is a
deduction from the order's own recorded total, not a guess about how the money split: not one
centavo is attributed to any product, and no figure changes. It is the same class of argument as
case 1, applied one level up. Without it the app would ask the collector to declare by hand what it
already knows: **17 of the 42 pending products that would otherwise show "Marcar pagado" sit in
fully paid orders**, and two products of one fully paid order would look different depending on
whether a button had been pressed.

The ordering 0 → 1 → 2 → 3 is one principle applied three times: **a fact proven by arithmetic beats
a claim, and a claim beats a percentage we already know is incomplete.** Case 3 is only honest when
all of that product's money came through item-level lines, which is why the surface that shows it
must also name the order-level money separately (Decision point 6).

A mark outranked by case 0 or 1 is **not erased**. It stays in the database and the order detail
keeps rendering it (`showMarkWhenProven`), because the detail is the audit surface and a mark put
there by mistake has to stay reversible: without that, a mark on a fully paid order could never be
taken back and would reappear the day the total went up.

### 5. Invariant I1, and the guard that can actually see it

> **I1.** No write or clear of `paidDeclaredAt` changes `Order.allocatedAmountMinor`, any field of
> `StoreDebtRow`, any dashboard figure, or the set of payment-reminder candidates.

A unit test cannot state I1: those figures are computed in other modules, so a test asserting "this
mutation did not call `order.update`" stays green forever while somebody teaches the dashboard to
read the column. I1 is therefore enforced by a **static scan**,
`src/test/money-modules-guard.test.ts`, over an enumerated list of eight money modules that may not
so much as _name_ `paidDeclaredAt` / `paid_declared_at`:

```
src/lib/data/dashboard/dashboardRollup.ts
src/lib/data/dashboard/dashboardAggregation.ts
src/lib/data/dashboard/dashboardQueries.ts
src/lib/data/orders/storePaymentQueries.ts
src/lib/data/orders/orderPaymentAllocations.ts
src/lib/data/notifications/reminderCandidateQueries.ts
src/lib/orders/paymentSummary.ts
src/lib/orders/storePaymentPresentation.ts
```

The guard also asserts that each path still resolves and that two of the files still contain the
figures they own, so an entry that quietly stops matching real code cannot turn the whole check
green. If a genuine need to read the column from one of these modules ever arises, that is an ADR
argument and the entry comes out deliberately.

**A consequence I1 forces, stated rather than smoothed over:** a payment reminder still fires for an
order whose every product is marked, because `reminderCandidateQueries` filters on
`allocatedAmountMinor < totalCost`, which is money. That is correct. The alternative would make the
mark a way to silence notices about real debt.

### 6. Order-level money is named, never spread

`getPendingProductsByStore` sums **item-level allocations only**, and the narrow
(`orderItemId: { in: [...] }`) is part of the contract rather than an optimization. The money that
named an order and no product is surfaced as its own list, one line per order, shown only when the
amount is positive **and the order still has a balance** (a fully paid order needs no explanation:
case 0 already shows every one of its products as "Saldado"). It shipped as a block at the foot of
each store group and moved on 2026-08-15 behind a **"Sin desglosar · {n}"** trigger in the group
header, which opens it in the canonical `<Modal>`: the scope and the condition are unchanged, but a
list this occasional had been charging permanent vertical space to the eight store groups in ten
that have no such money at all (`FR-05-51`, revised).

This is the Odoo "Mark as fully paid" pattern, which requires the collector to say where the
difference goes, and QuickBooks' "Unapplied Cash", where the residual stays visible and is never
distributed. **The golden rule: nothing is ever split.**

### 7. Coexistence with money on the same product

Money and mark are orthogonal and may both be present. Critically, **a mark never makes a line
read-only.** In the payment sheet, `isSettled` remains exactly `line.state === "settled"`, and the
new `"declared"` state resolves _after_ `settled`, so a marked product still accepts an amount. The
opposite would push that money into "Resto del pedido", which writes `orderItemId = NULL`, and the
mark would become a factory for the very undetailed money this feature exists to reduce.

No surface **offers** the mark on a priced line: where the exact number is known, using the number is
strictly more informative than a claim, and offering both would create two sources of truth about the
same product. ~~The sheet is the one surface that does not offer it~~ — **amended 2026-08-14 (F2):
the rule is about the nature of the datum, not the surface, and the order detail applies it too. See
the amendment under "Negative / tradeoffs".** The sheet still _shows_ the mark as consultable state
(a "marcado" marker on the reference line), because that is where the collector is looking while they
pay, and every surface keeps showing an existing mark so it stays reversible.

### 8. Cancellation: `credit` clears marks, `lost` keeps them

`cancelOrder`'s `credit` branch deletes the order's allocations and zeroes
`allocatedAmountMinor`; in the same transaction it now also clears `paidDeclaredAt` on that order's
items. The collector just unlinked every peso that funded the coverage, so a product still reading
"Saldado · marcado" would be claiming a coverage nothing pays for, and `reactivateOrder` would bring
the order back full of those claims with zero money behind them. The `lost` branch keeps its
allocations, so by the same logic it keeps its marks. The cancel modal states it in the `credit`
option.

### 9. Batch writes refuse whole, per ADR 0022

`setOrderItemsPaidDeclaredWithin(tx, itemIds, userId, declared)` takes the caller's transaction
client, because both callers need it to commit with something else, and Prisma does not nest
transactions. It **counts ownership before the write**: a bare
`updateMany({ where: { id: { in: ids }, userId } })` carrying one foreign id writes the other rows
and reports `count` short, which is precisely the silently applied subset a batch declaration must
never be. Because the refusal is decided before this function writes anything, a plain `return` is
safe (ADR 0022).

`createStorePayment` accepts `declarePaidItemIds` and proves every id belongs to this collector
**and** to an order of this same store as its last refusal before the first write. Since 2026-08-14
(F2) the **payment sheet is its only caller**: the order detail's inline form no longer carries a
coverage question, so `addOrderPayment` lost the parameter, its order-scoped `ITEM_ORDER_MISMATCH`
pre-check, and the field on `orderPaymentCreateSchema`. `declarePaidItemIdsSchema` itself stays, on
`storePaymentCreateSchema`. The later call to
`setOrderItemsPaidDeclaredWithin` can then only fail on a concurrent delete, and by then the payment
row exists, so it throws the `DeclaredItemsRollback` sentinel and a `.catch` outside maps it back to
`ITEM_ORDER_MISMATCH` without widening the public result type. Returning there would have committed
the payment beside a declaration that never landed.

Deleting or removing a marked product is refused with `ITEM_HAS_PAID_MARK`, in both
`replaceOrderItems` and `deleteOrderItem`, beside the existing monetary guards and before the first
write.

## Alternatives considered

1. **Reactivate `settlesTarget` with `amountMinor = 0`.**
   - Pros: zero schema change; the Zod schema, the mutation and six read branches already exist.
   - Cons: not editable, cannot reach historical allocations, re-creates the phantom `S/ 0.00`
     history row that killed it, and the provenance it adds is false in the case that matters.
   - Why not chosen: see Decision point 3. Frozen instead: refused on write, honored on read.

2. **Derive a per-product split from order-level money** (proportional, chronological, or
   "whatever is left goes to the first product").
   - Pros: every product would show a number; no new column, no new control.
   - Cons: measured at −47% to +72% error against the collector's own history; a guess rendered as
     a fact, in the one place the collector goes to check a fact.
   - Why not chosen: already rejected by the owner in ADR 0025; this ADR does not reopen it.

3. **A mark at the order level ("this order is settled, amount unknown").**
   - Pros: one tap instead of N; matches how the collector talks about a paid order.
   - Cons: `totalCost` is mandatory on all 560 orders, so the outstanding amount is always known,
     and the mark would be an accounting plug over a number the system already has.
   - Why not chosen: the honest equivalent is money and already exists in one tap on both surfaces
     (the inline form's "Todo · S/ X" quick-pick, the allocation panel's "Falta S/ X" line — see the
     F1 amendment in Decision point 2; this bullet used to name a "Falta S/ X" quick-pick in the
     inline form, which never existed there under that label).

4. **Backfill the mark from the arithmetic** (mark everything a fully paid order contains).
   - Pros: no first-day surprise; the column would carry the full picture.
   - Cons: a stored claim the collector never made, indistinguishable afterwards from one they did.
   - Why not chosen: case 0 gets the same visible result by _deduction at read time_, which is
     reversible, auditable, and self-correcting if a total later changes.

5. **Load unit prices for the 1,234 priced-less items**, making the money axis sufficient on its own.
   - Pros: no second axis at all; percentages everywhere.
   - Cons: data entry the collector does not have, producing invented prices that would then enter
     the arithmetic, unlike a mark, which cannot.
   - Why not chosen: it converts an honest silence into a dishonest number.

## Consequences

### Positive

- The collector can state what they know ("this one is paid") without being forced to invent what
  they do not know (how much of a shared transfer it was).
- Money stays exactly as trustworthy as before. The store's debt, the dashboard and the reminders
  are provably untouched, by a guard that fails loudly rather than by convention.
- Case 0 removes work rather than adding it: 25 of the 67 pending products change to "Saldado" on
  day one with no collector action, 17 by case 0 and 8 by case 1, and no figure moves.
- `PendingProductRow.settled` stops being dead code. It was fed only by `settlesTarget` (0 rows), so
  the "Saldado" chip in "Por tienda" had never once rendered; it now renders from a real source.
- Order-level money finally has a place where it is named rather than implied, which is the first
  thing that makes a product sitting at 0% explicable.

### Negative / tradeoffs

- **Two success-toned chips in the same column** ("Saldado" and "Saldado · marcado"). Deliberate:
  the colour says the same thing because the fact is the same, and the suffix says who is claiming
  it. The accessible name disambiguates regardless.
- **A reminder can contradict a fully marked order** (Decision point 5). Named in the product copy
  (`markedHint`: "No cambia montos ni recordatorios") rather than papered over.
- **~~A deliberate asymmetry in the sheet~~**: the same product offered the mark on the order detail
  and in "Por tienda", and refused it in the payment sheet when its price was known. On that day's
  sheet population, 32 of 49 lines.

  > **Amended 2026-08-14 (F2): the asymmetry is gone, and it was miscalibrated, not merely
  > accepted.** The argument this ADR gave for refusing the mark in the sheet (Decision point 7) is
  > exact: _where the exact number is known, using the number is strictly more informative than an
  > affirmation, and offering both would create two sources of truth about the same product_. **That
  > argument does not depend on the surface.** A priced product on the order detail has the same
  > number available as in the sheet, and offering a claim beside it produced exactly the two
  > sources of truth the ADR set out to avoid. The asymmetry was justified by the ROLE of each
  > surface (the sheet pays, the detail audits), but the detail pays too: its inline form is where
  > all 626 payments were recorded.
  >
  > The rule is now about the **nature of the datum**, not the surface, and it is shared by every
  > surface. It lives in two pure predicates over the raw input (`offersPaidMark` /
  > `rendersPaidMark`, `src/lib/orders/productPaymentState.ts`), never over the resolved state:
  > `resolveProductPaymentState` answers `"declared"` for any marked product, priced or not (case 2
  > precedes cases 4 and 5), so a predicate over the resolved state would hide the control on an
  > already-marked product and leave that mark impossible to take back.
  >
  > - **Adding** a mark: only where there is no number at all — no price base, no money declared
  >   against the product, and the order not cancelled. A single-product order therefore never
  >   offers it, because `resolveBasePagableMinor` falls back to the order total there.
  > - **Rendering** the control: `paidDeclared ⇒ rendersPaidMark`, with no exception. Every existing
  >   mark stays visible and reversible, priced or not, funded or not, cancelled or not.
  > - A product that no longer offers the mark renders **nothing**, not a disabled chip: a control
  >   that cannot act is a tab stop with nothing behind it.
  > - **Being rendered is not being interactive** (fixed 2026-08-14, same day): a `<button>` appears
  >   only where there is something to do — a mark to take back, or one that can be added. A priced
  >   product with no mark, on an order the arithmetic already settles, states "Saldado" as a
  >   `<span>`. It shipped as a button whose accessible name read "Marcar {name} como pagado" over
  >   that visible "Saldado" (WCAG 2.5.3, Label in Name) and which wrote `paidDeclaredAt` when
  >   pressed — arming the deferred contradiction: raise the order's total afterwards and the notice
  >   fires with every product marked. Rendering was gated on the rule and interactivity was not, so
  >   the rule reached 33 of the 482 priced products it was written for.
  >
  > What this bought: the contradiction between the two axes ("you marked every product and the
  > order still owes money") could fire on **24 of the 24 orders with an open balance**; it can now
  > fire on **3**. Sixteen of those 24 have exactly one product, where marking it IS saying the
  > order is paid, and the collector was right to call that a contradiction. No money module was
  > touched and invariant I1 is untouched.

- **The mark does not reach most of the catalog by hand.** Of the 1,418 items outside "Por tienda",
  1,404 sit in fully paid orders and render as proven with an inert control; only 14 are actually
  markable. That is the right outcome (there is nothing to claim about a proven product), but it
  means the order detail is an audit surface far more than a marking surface.
- **One more column on a hot table.** `OrderItem` gains a nullable `DateTime` with no index; it is
  never a query predicate, only a projected field.

## Rollout notes

- Migration `20260814055553_add_order_item_paid_declaration` adds one nullable column, with no
  backfill, no default and no index. Every existing row is `NULL`, so the pending production cutover
  is indifferent to it.
- No data migration touches `settlesTarget`. It keeps its `false` backfill from
  `20260808215744` and its read branches.
- The store payment sheet's draft carries `declared` inside `SheetItemDraft`, within its order,
  which is what makes the existing `droppedDraftLines` / `staleOrders` reconciliation cover it with
  no new handling, and what keeps it out of every ceiling validation.

## References

- `docs/design/decisions/0025-store-level-payments-declared-allocations.md` (Decision point 2, whose
  `settlesTarget` half this ADR supersedes)
- `docs/design/decisions/0022-transaction-refusal-rollback-contract.md` (the refusal contract behind
  the batch write and the `DeclaredItemsRollback` sentinel)
- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md`
  (`FR-05-49`…`FR-05-51`, `BR-05-19`…`BR-05-21`)
- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/fdd-05-order-payment-shipment.md`
  (the control's anatomy and its two breakpoints)
- `docs/product/glossary.md` ("marca de pagado" / "paid mark", "sin desglosar" / "not itemized")
- `src/lib/orders/productPaymentState.ts`, `src/test/money-modules-guard.test.ts`,
  `src/test/settles-target-guard.test.ts`
