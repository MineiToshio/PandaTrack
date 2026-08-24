---
title: "ADR 0037 - Progression credit is written at the fact, never held in a pending state, and every rule has exactly one writer"
date: 2026-08-23
status: accepted
session: collector progression accrual in existing flows (FRD-12 · BP-01 · WO-02, 2026-08-23)
owner: Sergio Minei
trigger: FRD-12 promises 25 of an order's points only once the collector logs a payment or an arrival, which invites a "pending points" state in the interface; and its three derived rules (`order-completed`, `order-settled`, `product-type-discovered`) were specified as "evaluated by the recompute" with no writer, so nothing would ever have appended their ledger entries
updates: docs/product/prd-02-collector-app/frd-12-collector-progression/frd-12-collector-progression.md, docs/product/prd-02-collector-app/frd-12-collector-progression/bp-01-collector-progression/bp-01-collector-progression.md
extends: ADR 0035 (append-only point ledger with a derived balance), ADR 0022 (transaction refusal rollback contract), ADR 0032 (two-transaction settlement split)
---

# ADR 0037 - Progression credit is written at the fact, never held in a pending state, and every rule has exactly one writer

## Context

[ADR 0035](0035-collector-progression-point-ledger.md) settled the storage shape: an append-only ledger, one idempotent entry per `(userId, ruleKey, entityId)`, with the balance derived at read time by re-checking each entry against the current state of the row it names. It deliberately left open **when** an entry gets appended, and that turned out to carry two decisions rather than one.

The first is a product question. `FR-12-05` promises the collector 5 points the moment they create an order and states that 20 more arrive "when you record the first payment or the first arrival". A reward described as arriving later is the classic invitation to build a pending state: a provisional row, a greyed figure, a "points on the way" chip. The FRD forbids it in plain language, but nothing in the data model enforces it, and the ledger's `voidedAt` column plus a nullable "matured" flag would make one very easy to add.

The second is a gap that only became visible once the engine existed. `FR-12-04` labels three of the eight phase-1 rules `der.` and gives their anchor as "recompute": `order-completed`, `order-settled`, `product-type-discovered`. The recompute built in `WO-01` evaluates eligibility over **entries that already exist**; it iterates the ledger, not the world. So an entry that no mutation ever writes is an entry the recompute never sees, and all three rules were worth exactly zero points, forever, with every unit test green: each one tested that the recompute _would_ have counted such an entry correctly.

## Decision

### 1. There is no pending points state, anywhere, in any form

Points not yet credited have simply not been earned yet. No provisional ledger row, no nullable maturity column, no interface affordance that shows a figure the collector does not yet have. What `FR-12-05` promises is delivered as **plain copy** ("20 more when you record the first payment or the first arrival"), which is a sentence, not a state.

This is what keeps `ADR 0035`'s derived balance meaningful. A pending row would have to be excluded from the total, which means the recompute would carry two notions of "counts" instead of one, and the moment there are two, the question "why does the app say 45 when I count 65" stops having an answer anybody can trace.

### 2. Every rule is written by exactly one call site, at the moment its fact becomes true

`imm.` and `def.` rules are appended by their host mutation. The three `der.` rules are appended too, at the point where the state they depend on is **derived and persisted**:

- `order-completed` inside `persistDerivedOrderStatuses`, the one function that writes a `COMPLETED` status, rather than in each of the delivery mutations that can trigger it;
- `order-settled` inside the two functions that produce `PaymentAllocation` rows, since being fully covered is a fact about declared money and can only start being true where declared money is written;
- `product-type-discovered` where a product reaches `DELIVERED`.

"Evaluated by the recompute" was read, during specification, as "written by the recompute". It cannot be: the recompute walks the ledger, and a rule with no writer has nothing for it to walk. Making the recompute scan the whole world instead was rejected, because it turns an O(entries) pass into an O(orders + deliveries + catalogue) one on a read path, and because it would file the entry under the civil day the collector happened to open the section rather than the day the fact occurred, which quietly re-buckets it under a different monthly cap.

**The division of labour stays exactly where `ADR 0035` put it.** The write decides only _what the fact is worth_ at the instant it happens (`order-registered`'s anti-split position is knowable then and never again). Whether an entry still **counts** is re-derived on every recompute, against the current state, for `der.` and `imm.` rules alike. That is why a completed order that is later reopened stops paying with no reversal written, and why crediting an order that has no assigned payment yet is correct rather than premature: the entry exists, the condition does not hold, the entry is worth nothing until it does.

### 3. A credit never fails a business mutation, and a failed credit reports nothing rather than a guess

Every call site wraps its credit and swallows what it throws, captured once with progression-safe context (no amounts, no store names). The host's own result is untouched. The Server Action then reports `progression: null`, which the client reads as "no toast", never as zero.

Corollary that is not optional: **a credit inside a host transaction must resolve its duplicate through `ON CONFLICT DO NOTHING`, never by catching the unique-violation error.** PostgreSQL aborts the entire transaction on a constraint violation, so the catch-and-continue form that is correct for a standalone write would, inside `createOrder`, roll the order back the second time a collector's retry landed on an already-credited entity. Batch insertion with `skipDuplicates` is therefore the required shape at every call site, and the single-entry form stays for the backfill script, which owns its own transaction.

### 4. The ledger write rides in the host transaction; the progress cache is re-derived after it commits

The append is inside the host's own transaction and after its last refusal, per [ADR 0022](0022-transaction-refusal-rollback-contract.md): a mutation that refuses must leave no credit behind. The `UserProgress` cache is the opposite and is written **outside**, once the host has committed, because one row per user folded into the serializable payment path would add a write-write conflict surface the money domain does not have today, for a figure that is rebuildable by definition.

That ordering is also what makes the delta honest. `pointsDelta` is the difference between the cached total and the freshly recomputed one, never the sum of the rows just appended: the caps and the eligibility conditions are the recompute's to apply, so an order with no payment yet correctly reports zero, and a collector who already hit the monthly ceiling is not congratulated for points they did not get.

For an arrival, the credit belongs to whichever transaction actually set the delivery to `DELIVERED` ([ADR 0032](0032-delivery-triggered-settlement.md)), never to the independent money transaction that follows it: that one commits separately and may refuse on its own, and the arrival is no less real when it does.

## Consequences

- The interface has no vocabulary for provisional points, so a future surface cannot introduce one without contradicting this record.
- The three derived rules pay out. Their entries exist from the mutation onward and mature under the same conditions every other rule is subject to.
- `order-settled` is credited where declared money is written, which covers the two paths that produce allocations today. Two rarer routes to being fully covered (a store-account reconciliation writing off the balance, and an order edit lowering the total onto what is already declared) do not append it yet; the entry is added the next time money is declared against that order, and closing the gap for good means either instrumenting those two writers or teaching the recompute to materialise a missing `der.` entry. That is a known, bounded gap, recorded here rather than discovered later.
- The recompute stays the single authority on what a total is. Nothing else is ever allowed to add up ledger rows and call the result a balance.

## Alternatives rejected

- **A provisional ledger row that matures.** Two notions of "counts" inside the recompute, and a balance nobody can reconcile by hand.
- **The recompute as the writer of `der.` entries.** Turns a read path into a full-world scan and files each entry under the day the collector opened a screen, which moves it into a different monthly cap than the fact it describes.
- **Catching the unique violation inside the host transaction.** Correct-looking, and it rolls back real orders on PostgreSQL.
- **Reporting `pointsDelta` as the sum of the rows just written.** Cheaper, and wrong every time a cap truncates or a condition does not hold yet, which is precisely the case the collector would notice.
- **Crediting the arrival inside the settlement money transaction.** Couples a fact that already happened to a money write that is allowed to refuse.
