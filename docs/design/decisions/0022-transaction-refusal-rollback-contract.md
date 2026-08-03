---
title: ADR 0022 - Refusing inside a transaction: return commits, only throw rolls back
date: 2026-07-29
status: accepted
session: transaction refusal audit across src/lib/data (2026-07-29)
owner: Sergio Minei
trigger: four shipped mutations returned a discriminated `{ ok: false }` refusal from inside a `prisma.$transaction` callback after a write had already been issued, committing partial writes while the caller and the UI reported failure
updates: .agents/rules/prisma-data-layer.mdc, docs/tooling/agents/rules.md
---

# ADR 0022 - Refusing inside a transaction: return commits, only throw rolls back

## Context

Every mutation in `src/lib/data/**` reports outcomes as a discriminated union: `{ ok: true, … } | { ok: false, error: "SOME_CODE" }`. Callers switch on `ok`, and the UI maps `error` to a localized message. This convention is good and is not in question.

It collides with one fact about Prisma interactive transactions: **returning normally from the `$transaction` callback commits the transaction.** Only a thrown error produces a `ROLLBACK`. The two conventions look compatible — a refusal is "just a return value" — and they are, right up until the refusal is decided _after_ the callback has already issued a write.

Four sites had shipped with exactly that shape:

| Site                      | Write already issued                       | Refusal returned afterwards                      |
| ------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `createOrder`             | `tx.order.create`                          | `INVALID_PRODUCT_TYPE`                           |
| `editOrder`               | `tx.order.update`                          | `ITEM_HAS_LIVE_DELIVERY`, `INVALID_PRODUCT_TYPE` |
| `replaceOrderItems`       | `tx.orderItem.deleteMany`                  | `INVALID_PRODUCT_TYPE`                           |
| `applyBaseCurrencyChange` | scalar `user.update` (via a nested helper) | relayed `ZodError`                               |

The user-visible result of the first one: a phantom order row, with no items and no history entry, sitting in the collector's list — created by an operation the interface had just reported as failed. `replaceOrderItems` is worse in kind: it deletes the removed items first, so a later refusal committed the deletions and discarded nothing.

This is not four bugs. It is one bug class, reproduced four times by four different authors following the house convention correctly. The convention itself carries no signal that the return is unsafe here, and the failure is invisible in review: the code reads as a clean early exit, and the tests that existed asserted only the returned value, which was correct.

`deliveryMutations.ts` already had the right pattern (`DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE`, thrown inside the transaction and mapped back in a `.catch` outside), written for a concurrency check. It was never generalized into a rule, so it read as a local trick for a local problem rather than as the answer to a class of problem.

A second, less obvious call shape carries the same hazard: a helper that receives a caller-owned `tx: Prisma.TransactionClient` runs inside somebody else's transaction, so _its_ refusal returns are that transaction's returns. `replaceOrderItems` is exactly this — its refusals are the ones `editOrder` relays. A function can therefore be safe when it owns its transaction and unsafe when it is called from within another one.

## Decision

**Inside a transaction, every refusal must be decided before the first write. Where that is impossible, throw a typed sentinel inside the transaction and map it back to the public result outside.**

### 1. Pre-write validation is the preferred shape

Order the callback so that every condition capable of refusing is evaluated while nothing has been written. The refusal is then an ordinary `return` and is trivially correct. This is preferred because the invariant is visible in the function's own sequence of statements — no reader has to hold the commit semantics in their head.

It is acceptable and expected for this to duplicate a validation that a downstream helper also performs. `createOrder` now calls `findInvalidProductTypeKey` before `tx.order.create`, even though `createOrderItems` validates again afterwards. The duplicated read is cheap; the phantom order was not.

### 2. Typed sentinel + `.catch` mapping, when the refusal is only knowable after a write

Some refusals genuinely cannot be hoisted: a concurrency check reads the row count that a write just returned. For those:

- Throw a sentinel **inside** the transaction so the engine rolls back.
- Catch it **outside**, in a `.catch` on the `$transaction` call, and return the same discriminated result the caller already expects.
- The sentinel is an implementation detail. It never reaches the caller, never appears in the public result type, and never becomes a new error code.

### 3. The public contract never changes to accommodate the mechanism

Result shapes and `error` code vocabularies are what the UI and the translations are written against. A rollback is an internal concern of the data layer. Adding an error code, widening a result union, or letting a sentinel escape as a thrown exception are all forbidden ways to solve this.

### 4. Both call shapes are in scope

The rule applies to a `$transaction` callback body **and** to the body of any function that accepts a `Prisma.TransactionClient`. Before assuming a function is safe, check whether anyone calls it with a `tx`.

### Canonical shape

The reference example is the pattern that already existed in `deliveryMutations.ts`:

```ts
export async function createDelivery(userId: string, input: DeliveryCreateInput): Promise<CreateDeliveryResult> {
  return prisma
    .$transaction<CreateDeliveryResult>(async (tx) => {
      // Refusals that CAN be decided before any write are plain returns.
      const store = await tx.store.findFirst({ where: { id: input.storeId }, select: { id: true } });
      if (!store) {
        return { ok: false, error: "STORE_NOT_FOUND" };
      }

      const delivery = await tx.delivery.create({ data: {/* … */}, select: { id: true } });

      const stateUpdate = await tx.orderItem.updateMany({
        where: { id: { in: uniqueProductIds }, userId, deliveryState: { in: eligibleStates } },
        data: { deliveryState: getNextItemDeliveryState("create") },
      });

      // This refusal is only knowable from the write's own result, so it MUST throw:
      // a return here would commit the delivery row.
      if (stateUpdate.count !== uniqueProductIds.length) {
        throw new Error("DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE");
      }

      return { ok: true, deliveryId: delivery.id /* … */ };
    })
    .catch((error: unknown) => {
      // Mapped back to the SAME public error code the caller already handles.
      if (error instanceof Error && error.message === "DELIVERY_PRODUCT_CONCURRENT_STATE_CHANGE") {
        return { ok: false, error: "PRODUCT_NOT_ELIGIBLE" };
      }
      throw error;
    });
}
```

New sentinels should use a **named `Error` subclass** rather than a message string, and be declared next to the function it serves with a comment saying why the refusal cannot be hoisted:

```ts
class InvalidProductTypeRollback extends Error {
  constructor() {
    super("INVALID_PRODUCT_TYPE");
    this.name = "InvalidProductTypeRollback";
  }
}
// … catch with `error instanceof InvalidProductTypeRollback`
```

`instanceof` cannot collide with an unrelated error that happens to carry the same message, and a sentinel that must carry data (`BaseCurrencyChangeRollback` carries the `ZodError` it has to relay) needs a class anyway. The string form in `deliveryMutations.ts` stays as written — it works, and rewriting it buys nothing.

### Enforcement

- `.agents/rules/prisma-data-layer.mdc` carries the rule for agents and reviewers.
- `src/test/transaction-refusal-guard.test.ts` is a static guard: it flags a literal `return { ok: false … }` positioned after the first `tx.*` write within a transaction scope. Its known blind spot is a refusal returned through a variable (`return applied`) rather than an object literal — the shape `applyBaseCurrencyChange` had. The guard is a net, not a proof; the rule is the contract.
- `src/lib/data/orders/_tests/orderTransactionRollback.test.ts` covers the four repaired sites behaviourally.

## Alternatives considered

1. **Rely on code review and the written rule alone, no static guard**

- Pros: nothing to maintain, no false-positive risk.
- Cons: this exact bug survived review four times. The reviewing eye does not see it, because the code looks like every other early return in the file.
- Why not chosen: a rule with no mechanical backstop is what we already had. The guard is ~90 lines and finds the literal shape at zero runtime cost.

2. **Ban early returns inside `$transaction` callbacks entirely; require every refusal to throw**

- Pros: one rule, no ordering judgment, mechanically checkable with a much simpler pattern.
- Cons: forces a sentinel class and a `.catch` onto the common case where the refusal is a plain pre-write guard (`if (!store) return …`). That is more machinery, more indirection, and more places for a `.catch` to be forgotten — a new failure mode traded for the old one.
- Why not chosen: pre-write validation is not merely safe, it is _clearer_. Penalizing the good shape to simplify the rule is the wrong trade.

3. **Wrap `$transaction` in a house helper that treats a returned `{ ok: false }` as a rollback signal**

- Pros: makes the natural shape correct by construction; existing code would be fixed by changing the wrapper.
- Cons: a data layer where `return` sometimes means commit and sometimes means rollback, depending on the shape of the value, is harder to reason about than the Prisma semantics it hides. It also only works for functions that own their transaction — a helper taking a caller's `tx` cannot use the wrapper, so the hazard survives in the shape that is hardest to spot.
- Why not chosen: it hides the mechanism instead of teaching it, and it does not cover both call shapes.

4. **Give every mutation an `AbortTransaction` sentinel carrying the public error payload**

- Pros: one shared sentinel, less boilerplate than a class per refusal.
- Cons: a shared carrier invites throwing it across module boundaries, and a sentinel that escapes an inner `.catch` gets mapped by an unrelated outer one. Per-function sentinels cannot be caught by the wrong handler.
- Why not chosen: the safety of this pattern comes from the sentinel being narrow. A generic one is a footgun with a wide barrel.

## Consequences

### Positive

- A refusal can no longer commit a partial write. The failure the user was shown and the state of their data agree.
- The pattern that already existed in one file is now the documented answer for the whole data layer, reachable from the rule index instead of from having read `deliveryMutations.ts`.
- Pre-write validation, now the preferred shape, makes most mutations easier to read: what can fail is stated before anything happens.
- The guard makes the regression cheap to catch on the shape that caused all four incidents.

### Negative / tradeoffs

- Pre-write validation sometimes means an extra read inside the transaction, and a validation expressed in two places (once hoisted, once in the helper that still owns it). Both are accepted; the hoisted copy carries a comment explaining why it exists so nobody deletes it as redundant.
- The `.catch` shape is more verbose than an early return, and forgetting it turns a refusal into an unhandled throw. That failure is loud (Sentry, a 500) rather than silent, which is the right direction, but it is a real cost.
- The static guard cannot see refusals returned through a variable, so it must not be read as coverage. Anyone touching this area still owes it the rule, not just a green suite.

## Rollout notes

- The four sites were repaired in the same change that recorded this ADR, each by the cheapest shape that fit: `createOrder` and `replaceOrderItems` hoist their product-type validation ahead of the first write, `editOrder` moves the whole `replaceOrderItems` block above `tx.order.update` so the last step that can refuse runs before anything is written, and `createOrder` / `applyBaseCurrencyChange` add typed sentinel classes for the refusals that remain past a write.
- The guard runs as part of `npm run test`. A new hit means one of two things: hoist the refusal, or throw and map it. It never means relax the guard.
- **2026-08-03:** one of the four sites, `applyBaseCurrencyChange` (with its `BaseCurrencyChangeRollback` sentinel), no longer exists. [ADR 0024](0024-fx-reconciliation-derived-from-rate-base.md) made FX-pending state derived, which removed the bulk order/delivery flagging that function wrapped a base-currency change around, so the multi-write transaction it needed is gone. The site is kept in this record because the rule it demonstrates is unchanged; only that particular example has been deleted.

## References

- [ADR 0015 - Data access layer shape](0015-data-access-layer-shape.md)
- [ADR 0024 - FX reconciliation derived from the rate's base currency](0024-fx-reconciliation-derived-from-rate-base.md) (removed the `applyBaseCurrencyChange` site catalogued here)
- `.agents/rules/prisma-data-layer.mdc`, "Refusing inside a transaction"
- Prisma interactive transactions: the callback's returned value is the transaction's result and commits it; a rejected promise triggers `ROLLBACK`.
