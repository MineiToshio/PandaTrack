---
title: "ADR 0035 - Collector progression points are an append-only ledger with a derived balance, never negative entries"
date: 2026-08-23
status: accepted
session: collector-progression point ledger design (FRD-12, 2026-08-23)
owner: Sergio Minei
trigger: a progression engine has to award points for actions that are themselves reversible, cancelling and reactivating an order, hard-deleting an order or a delivery, reopening a delivery, editing a review, and a simple increment/decrement counter needs an exhaustive, hand-written reversal handler for every one of those paths, which is exactly the bug class ADR 0022 already catalogued for transaction refusals: one convention, quietly wrong at every call site that forgets it
updates: docs/product/prd-02-collector-app/frd-12-collector-progression/frd-12-collector-progression.md, docs/product/prd-02-collector-app/prd-02-collector-app.md, docs/product/glossary.md
extends: ADR 0022 (transaction refusal: return commits, only throw rolls back)
---

# ADR 0035 - Collector progression points are an append-only ledger with a derived balance, never negative entries

## Context

FRD-12 introduces collector progression: points, ranks, and collectible medals earned from ordinary collector actions (placing an order, marking a delivery arrived, writing a review, and similar). Every one of those source actions already has a documented reversal in the codebase, and none of the reversals were designed with a point system in mind:

- `deleteOrder` (`src/lib/data/orders/orderMutations.ts`) **physically deletes** the order row and its children. A points scheme keyed on one entry per entity leaves that entry orphaned, pointing at a row that no longer exists. Worse, nothing stops the collector from create → get credited → delete → create again, farming points on a loop the ledger cannot see, because the entity that would prove it happened before is gone.
- `reactivateOrder` (same file) exists and is one click. A scheme that tries to reverse a cancellation by writing a second entry under a suffixed key (`{ruleKey}:cancelled`) cannot then reactivate: the second cancellation has no fresh suffix to write to, because the first reversal already claimed it, and the balance is left wrong with no legal move to correct it.
- `reopenDelivery` and `deleteDelivery` (`src/lib/data/deliveries/deliveryMutations.ts`) are the same shape one domain over: a delivery can be undone, re-marked, and hard-deleted, and each of those is a path a suffixed-reversal scheme has to special-case by hand.
- A review can be deleted and rewritten. The same class of gap: an entry earned once has to track content that can change out from under it.

This is one bug class, not five. A mutable counter, or a ledger that reverses itself by writing negative-value entries for every undo, requires the progression module to learn, in advance, every place elsewhere in the codebase that can undo, delete, or edit the thing that earned points. That list is neither closed nor owned by this feature: `orderMutations.ts` and `deliveryMutations.ts` belong to FRD-05 and FRD-08, and a future change to either can silently break the points system without anyone touching progression code at all.

## Decision

**The engine is an append-only ledger. It never writes a negative entry, and the live balance is not stored: it is derived, at read time, by recomputing which entries still count.**

### 1. One idempotent entry per action

Every point-earning action inserts one row keyed by `(userId, ruleKey, entityId)`, unique. Triggering the same action twice (re-marking a delivery arrived, re-running an intake that already created the order) writes nothing a second time, because the unique constraint refuses the duplicate insert; the write is a plain idempotent upsert-or-skip, not a "did I already do this" query the caller has to remember to run first.

`entityId` is a plain string column, **not a foreign key**. This is deliberate: a foreign key to `Order.id` or `Delivery.id` would cascade-delete the ledger row the moment `deleteOrder` runs, which destroys exactly the audit trail a ledger exists to keep, and would resurrect the farming loop this ADR exists to close (delete the order, and the evidence that points were ever earned for it disappears with it).

### 2. The balance is derived, never decremented

No entry is ever updated or reversed with a compensating row. Instead, the balance a collector sees is computed by a recompute pass that, for every ledger entry, checks two things against the current state of the source data:

1. **Does the entity the entry names still exist?** A hard-deleted order's entries fail this check and stop counting, with no delete hook anywhere in `orderMutations.ts` or `deliveryMutations.ts` needing to know the ledger exists.
2. **Does the entity still satisfy the rule's eligibility predicate today?** A cancelled order fails its "order placed" rule's predicate and stops counting; `reactivateOrder` makes it pass again, and the same entry, unmodified since the day it was written, resumes counting on the next recompute. Reopening a delivery, and rewriting a review's content against a rule that reads the current row, follow the identical shape.

Cancellation, reactivation, hard deletion, reopening, and edited reviews are therefore covered by **one mechanism**: existence plus current eligibility, re-evaluated from the source tables, not from anything the ledger itself stored about the action at the time it happened. A future reversible action anywhere else in the codebase is covered automatically, with zero new code in the progression module, as long as its rule's eligibility predicate reads the current row.

### 3. The recompute is on-demand, not a materialized view or a second cron job

The collector's progression figure is recalculated when the Progress section is opened, if the cached value is stale, and cached until the next write invalidates it. The project has exactly one cron job today (`/api/notifications/dispatch`, daily), already committed to reminders; adding a second scheduled job, or a materialized view that needs its own refresh trigger, is machinery this feature does not need to justify.

### 4. Corollary: no points rule reads money

No rule in the points-rules module may read a monetary field, directly or transitively: `amountMinor`-suffixed columns, `totalCost`, `unitPrice`, or a `currencyCode`. Money predicates ("is this order fully paid", "did this payment clear") are computed once, ahead of the rules, by a dedicated adapter that hands the rules module booleans only (`isFullyPaid: boolean`, never the figure it was computed from). A rule that wants to react to money state consumes the boolean; it never re-derives it.

This mirrors the existing invariant in `src/test/money-modules-guard.test.ts` (`OrderItem.paidDeclaredAt` moves no money, enforced by a static scan naming every module allowed near the money axis) applied in the opposite direction: money modules must not read the coverage mark, and here the points-rules module must not read money. A static guard scans the rules module's source for the same identifier list (`amountMinor`, `totalCost`, `unitPrice`, `currencyCode`, and their common variants) and fails the build if any appears. Per the money-modules guard's own documented lesson, the test ships with a fixture case that the guard must catch, proving the scan sees the real shape of a violation and is not merely passing against an empty file.

### Canonical shape

```ts
model ProgressionLedgerEntry {
  id        String   @id @default(cuid())
  userId    String
  ruleKey   String   // e.g. "order.placed", "delivery.arrived", "review.written"
  entityId  String   // plain string, NOT a foreign key, survives the entity's own deletion
  points    Int
  earnedAt  DateTime @default(now())

  @@unique([userId, ruleKey, entityId])
  @@index([userId])
}
```

The recompute reads this table plus the current state of `Order` / `Delivery` / whatever table `entityId` names for that `ruleKey`, and sums `points` only over rows whose entity still exists and still passes the rule's eligibility predicate.

### Related constraint: ADR 0022

The ledger insert is a plain, idempotent write; there is ordinarily nothing to refuse mid-transaction. Where a rule's eligibility genuinely can only be decided after another write in the same transaction (mirroring the shape ADR 0022 already covers), the same discipline applies without exception: decide the refusal before the ledger insert, or throw a typed sentinel inside the transaction and map it back outside, never a `return` after the insert has already been issued. The progression cache is never invalidated from inside a money-domain transaction (an order or payment write): it is recomputed lazily, on the next read of the Progress section, keeping the two domains' transactions independent.

## Alternatives considered

- **Negative-entry reversal (write a compensating row when the source action is undone).** Rejected: it requires the progression module to know about every reversal path in `orderMutations.ts` and `deliveryMutations.ts` in advance, breaks concretely on reactivation (the first cancellation's reversal already claimed the suffixed key, so the second cancellation has nowhere to write), and does not cover a hard physical delete at all, since a deleted row triggers no application code to write the compensating entry.
- **An entity fingerprint to block re-creating a deleted, already-credited entity.** Adds a new column and a new check, and still leaves reactivation and delivery reopening unsolved: the fingerprint stops the farming loop through delete-and-recreate but says nothing about an entity that legitimately toggles between eligible and ineligible without ever being deleted.
- **A mutable point counter on the user record, incremented and decremented in place.** Not auditable (no way to answer "why does my total say this"), and impossible to recompute if a rule's point value or eligibility definition changes later: every historical counter update baked in the old rule, permanently.
- **A materialized balance view refreshed on a schedule.** Rejected on the same operational ground as the on-demand recompute decision: the project runs one cron job today, already committed elsewhere, and a scheduled refresh is unjustified machinery at collector-app volume, on top of introducing a staleness window with no compensating benefit over an on-demand recompute.

## Consequences

### Positive

- Cancellation, reactivation, hard deletion, delivery reopening, and review edits are all covered by the same existence-plus-eligibility recompute, with no reversal code required anywhere in `orderMutations.ts` or `deliveryMutations.ts`, and no future reversible action anywhere else in the codebase needs progression-aware changes to stay correct.
- The ledger is fully auditable: every entry that ever counted is still a row, whether or not it counts today, so "why did my points change" always has an answer in the data.
- Changing a rule's point value or eligibility definition later is a pure function change; the next recompute picks it up for every existing entry with no backfill migration.
- The farming loop (create, get credited, delete, recreate) is closed by construction: a deleted entity's entries stop counting on the very next recompute, they are not merely orphaned.

### Negative / tradeoffs

- The balance is a computed join over the ledger and the source tables, not an O(1) counter read; it must be cached and invalidated deliberately (§3) rather than trusted as free.
- A collector's total can go **down** on a recompute (an order they cancelled after earning its points), which has to be explained in the interface with a "why this changed" line rather than presented as a silent drop; the FDD owns that surface.
- Cost of the recompute grows with the collector's full history of entries, not just recent activity; at collector-app volumes (hundreds of orders per user, not millions) this is acceptable, but the query needs the `@@index([userId])` from day one, not as a later optimization.
- The static money-boundary guard is a scan, not a proof, in the same sense ADR 0022's transaction-refusal guard is: it catches the identifiers it is told to look for and nothing it was never pointed at. The rule, not the guard, is the contract.

## Rollout notes

- FRD-12 owns the exact rule keys, point values, and eligibility predicates; this ADR fixes the mechanism (append-only, derived balance, idempotent key, no money in rules) that every one of those rules must be written against.
- The static guard should ship in the same change as the rules module, named for what it protects (analogous to `src/test/money-modules-guard.test.ts`, `src/test/transaction-refusal-guard.test.ts`), with its own fixture proving it can see a real violation.

## References

- [ADR 0022 - Refusing inside a transaction: return commits, only throw rolls back](0022-transaction-refusal-rollback-contract.md)
- [ADR 0024 - FX reconciliation derived from the rate's base currency](0024-fx-reconciliation-derived-from-rate-base.md) (prior art for deriving a live figure from current state instead of maintaining a stored, hand-updated one)
- `src/test/money-modules-guard.test.ts` (prior art for a static identifier scan enforcing a one-way boundary between two axes of the same domain)
- `src/lib/data/orders/orderMutations.ts` (`deleteOrder`, `reactivateOrder`)
- `src/lib/data/deliveries/deliveryMutations.ts` (`deleteDelivery`, `reopenDelivery`)
