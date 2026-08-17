---
title: "ADR 0029 - Declaring allocations against an order that does not exist yet: position as the wire key"
date: 2026-08-15
status: accepted
session: store-level payments v5 (payment breakdown on the image-intake review screen)
owner: Sergio Minei
trigger: the collector saved a multi-product order from a chat screenshot, then opened the order, deleted the payment the intake had just written and re-entered it with a product breakdown. Twice in two days (ORD-20260814-02, ORD-20260815-01). The panel that made that possible landed with ADR 0028 and lives on the order detail; this decision is about offering it one screen earlier, where the order does not exist yet
updates: src/lib/imageIntake/intakeBreakdownContract.ts, src/lib/imageIntake/intakeBreakdown.ts, src/lib/data/orders/orderQueries.ts, src/app/[locale]/(app)/orders/_actions/imageIntakeSaveAction.ts, src/app/[locale]/(app)/orders/_actions/imageIntakeContract.ts, src/app/[locale]/(app)/orders/_components/share/OrderPaymentBreakdownPanel.tsx, src/app/[locale]/(app)/orders/_components/share/OrderPaymentBreakdownRow.tsx, src/app/[locale]/(app)/orders/new/image/_components/IntakeReviewScreen.tsx, src/app/[locale]/(app)/orders/new/image/_components/ImageIntakeScreen.tsx
extends: ADR 0028 (order-scoped payment breakdown), ADR 0025 (declared allocations), ADR 0023 (one operation, one surface), ADR 0022 (transaction refusal contract, and why it does not apply here)
---

# ADR 0029 - Declaring allocations against an order that does not exist yet: position as the wire key

## Context

ADR 0028 fixed what a payment breakdown IS: a declaration by the collector about **a payment being
recorded against an order that already exists**. Every part of it assumes that order: the panel's
lines are keyed by `orderItemId`, the ceilings come from `payment_allocation` rows, and the write
path is `addOrderPayment`, which takes an `orderId`.

The image-intake review screen breaks that assumption in the only way that matters. It is the last
screen before an order is written, it already holds the products AND the payments of that order, and
it is the screen that captured the prices in the first place (`FR-11-42`) — the by-price split, the
one the collector actually uses, works here precisely because this screen is what makes prices
exist. What it does not have is ids: the order items get theirs when `createOrder` commits.

The value is smaller than it looks and is worth stating honestly. This does not stop a loss: the
collector already does the breakdown by hand, from the order detail, and did it twice in two days.
It removes three gestures from a flow that already works.

Three things about the intake path make it cheap, and they were verified rather than assumed:

- The intake does **not** use `createOrder({ initialPayment })`. It writes the order first and then
  records each payment row with `addOrderPayment`, **after the transaction has committed**
  (`recordDraftPayments`, `FR-11-102`). By the time that runs, the item ids exist.
- `addOrderPayment` already accepts `allocations` and already builds the order-level residual. No
  schema change, no migration, no change to the mutation layer.
- The panel does not depend on an existing order. `BreakdownItem.itemId` is an opaque string.

The manual create form is the expensive half and is deliberately out of scope: it would need
`initialPaymentSchema` widened, a re-read of the items inside the transaction, and a second mount of
the panel with a different state owner. It has created **zero** orders since 2026-07-22.

## Decision

### 1. The wire key is the product's POSITION, resolved to `orderItemId` after the commit

The breakdown travels as its own argument of the save action, one entry per payment row that carries
one, each line naming a `position` (1-based, the ordinal of the product in the flattened draft) and
an `amountMinor`. `position` is emitted by `flattenGroupsToItems` and persisted on `order_item`, so
it is the only key that means the same thing on both sides of the client/server hop.

The save action resolves position → id with one indexed read **outside every transaction**, then
passes the resolved lines **through** `orderPaymentCreateSchema` (never beside it: that schema is
where `orderItemId: cuid()`, `amountMinor: min(1)` and the 200-line ceiling live, and an id the map
failed to resolve has to die at that parse rather than reach Prisma).

A position that does not resolve degrades: the payment is written **without** its breakdown and
counted, rather than refused. It is the one case where client and server can disagree about the set
of products, and `FR-11-27a1` already chose that ordering for this family — losing a correction beats
losing the payment.

**ADR 0022 is not engaged.** Nothing here is added inside a `$transaction` callback or in a function
taking a `Prisma.TransactionClient`: the new read is a plain query, the mapping happens post-commit,
and every refusal a broken-down payment can produce is already decided by `validateAllocations`
before the first write, inside code that is already under the static guard.

### 2. The breakdown never enters the model's contract

`imageIntakeDraftSchema` is the shape the extraction answers in, and the server re-parses it. Putting
allocations in there would hand a machine the power to propose a split, which is exactly the
distinction ADR 0028 §1 draws between a derivation and a declaration. The breakdown is therefore a
separate argument, and the boundary now has a **static guard** rather than prose
(`src/test/image-intake-draft-schema-guard.test.ts`): it was previously believed to be covered by
`image-intake-response-schema-guard`, which only checks that the response schema's keywords are on
the provider's allowlist and never looks at the draft schema at all.

### 3. The denominator of a declaration against an order under construction is the REMAINING balance,

and the printed percentage must name its own denominator

A payment row on this screen is not the first one by construction: the review screen holds a list.
Row _k_ splits against what rows 0..*k*−1 left behind, and the two sums involved are deliberately
different — a product's ceiling drops only by what earlier rows **named it for**, while the order's
balance drops by each earlier row's **full amount**, split or not, because all of a payment lands on
the order whatever its breakdown says.

The denominator of the by-price split on row _k_ is therefore

```
orderTotalCostMinor(k) = max( totalCost − Σ_{j<k} amount_j ,  Σ prices of the ELIGIBLE lines of row k )
```

The `max` is not decoration. `orderTotalCostMinor` has **two consumers with two different line
sets**: `applySplit` hands `splitByPriceLines` the eligible, ticked, unpinned lines, while
`deriveBreakdown` computes the percentage the panel PRINTS over every eligible line, ticked or not.
Both pass it through `resolveSplitDenominator`, which raises it to its own sum of prices, so without
the guard the two settle on different numbers: a row paying 10000 with only B ticked applies 100% of
B's price while printing 66.7%. With it, `Σ ticked ≤ Σ eligible ≤ orderTotalCostMinor`, so both land
on the same figure by construction.

> **The invariant: the denominator applied and the denominator printed are the same number, always.**

Taking the remaining balance rather than the total is what makes the central case close: on an order
whose first row already covered one product outright, the product that is left lands on its exact
price and the residual is **0**, instead of leaving money attributed to no product at all — which is
the very thing this family of features exists to remove. Where the ticked lines are still eligible,
the guard raises the denominator back to the sum of prices and the choice is a no-op; that is the
measured limit of it, and it is stated rather than oversold.

The consequence is a label problem, and it gets a label answer. The panel takes a
`percentBasis: "order" | "remaining"` prop that **chooses copy and never arithmetic**: it enters no
formula, never reaches `resolveSplitDenominator`, and moves no figure. The order detail always passes
`"order"`. The review screen passes `"order"` on row 0 (where the remaining balance _is_ the total,
so "del pedido" is literal) and `"remaining"` from row 1 on. Two percentages measured against two
different things, ten centimetres apart, under one label, would be worse than an extra sentence.

The label names the **base**, not the exact value, because the `max` guard can raise the denominator
above that base. That imprecision is not new: "del pedido" on the order detail already does the same
thing on a discounted order. The alternative — a third label naming "the greater of the balance and
the sum of the prices" — is a phrase nobody reads at a glance, and the detail's own spec already
chose base-before-literalness for that reason.

## Consequences

- The panel and its row move to `orders/_components/share/`, and their copy namespace is renamed from
  `orders.detail.payments.breakdown` to `orders.payments.breakdown` (49 keys). Not a `namespace` prop:
  that would make the home of the copy a runtime decision and let two surfaces drift apart silently.
  They are NOT promoted to `src/components/modules/`: there is no consumer outside the `orders`
  subtree, and `component-inventory-guard` only scans `src/components/{core,modules}`, so promoting
  would buy a catalog obligation for nothing.
- Every DOM id the panel and its rows mint is derived from a required `instanceId`. With several
  panels on one screen — and item keys that are POSITIONS, identical on every payment row — the old
  module constants collided across `aria-controls`, `aria-expanded` and every `aria-describedby` at
  once. The ids are not byte-for-byte what the detail used to emit, and nothing asserted them; what
  is preserved, and tested on both surfaces, is that every reference points at a node that exists.
- Two things reach the order detail that nobody asked for, and they are the only two: **"Marcar
  todos"** (justified by 23 real orders of ten products or more and one of 32, not by the schema's
  ceiling of 200) and `percentBasis`, which passes `"order"` there and changes nothing. **The foot of
  the shipped panel is not touched.**
- A payment row **with** a breakdown is validated before the order is written (amount, date present,
  date not in the future in UTC, date not before the order, and a sequential balance simulation).
  A row **without** one keeps `FR-11-52b` exactly: dropped server-side, blocking nothing. The balance
  check is a simulation IN ORDER with an accumulator, never `Σ amounts ≤ totalCost`: the server writes
  row by row and a refused row consumes no balance, so the flat sum produces false positives and can
  blame a row that carries no breakdown at all.
- The retry after a mid-write failure stops being mute. It returns **every** `paymentIndex` that
  carried a breakdown and sends the collector to the order's detail. It over-reports on purpose:
  `recordDraftPayments` steps over a refused row instead of stopping, so counting what is already
  there and calling the rest lost is wrong in both directions. Payment-level idempotency still does
  not exist (`FR-11-27a1` already declares that hole); what changes is that the collector is told.

## Alternatives rejected

**A fourth foot line for the residual of an already-covered product** (`footResidualUnticked`).
Rejected for four independent reasons, any one of which is enough. Decision 3 removes the case that
motivated it (the residual becomes 0). It would improve **0 of 267** real multi-product orders; the
state is only reachable _because of_ this feature. The condition as drafted fires on **every opening
of the panel** — the draft is born with nothing ticked, so the first thing the collector would read
on unfolding is "S/ 80,00 were not assigned", beside a foot already printing that same figure; its
two sibling lines guard against exactly that (`showResidualUnpriced` requires `pricedTickedCount > 0`,
`showResidualClamped` requires `clampedCount > 0`). And it breaks the declared invariant **one
residual, one explanation** while leaving both existing tests green, which is how it would have
shipped.

**Putting the breakdown inside `imageIntakeDraftSchema`.** See decision 2.

**Marking the breakdown stale when a price changes upstairs, with a "Recalculate" control.** It has
the shape of `FR-11-58a` and that is why it tempts. But `FR-11-58a` is advisory because a stated total
_can_ legitimately differ from the sum of the prices; a by-price split computed from prices that no
longer exist is not legitimately anything. It would leave a panel on screen whose own caption ("each
product receives the same percentage of its price") is false while the notice stands, and add a state,
a control and a sentence so the collector can choose to save wrong numbers. The split re-runs instead,
through the same door a tick goes through, and lines the collector typed into are pinned and never
touched (I-2).

**Invalidating the breakdown on any product edit.** It destroys the collector's work for correcting a
neighbouring field. The predicate is the COUNT of flattened products and nothing else, which is the
same distinction `FR-11-51a` already draws between an inline correction and a split/merge — and the
only one this screen can actually observe, since all five gestures arrive as one replaced group.

**Building the same thing for the manual create form.** Out of scope with volume measured at zero
since 2026-07-22, and building the server half "for later" is the unused persistence code ADR 0023
rejected in writing.
