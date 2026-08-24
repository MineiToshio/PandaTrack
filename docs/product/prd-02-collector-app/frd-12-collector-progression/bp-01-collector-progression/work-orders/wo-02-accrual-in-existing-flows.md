---
id: WO-02
type: WORK_ORDER
slug: accrual-in-existing-flows
title: Accrual in Existing Flows
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0021
source_issue: 141
implementation_status: IN_PROGRESS
last_updated: 2026-08-23
---

# WO-02 Accrual in Existing Flows

## Summary

Wire `awardPoints` (from [`WO-01`](wo-01-progression-engine-foundation.md)) into the real order, payment, delivery, and store mutations that anchor the phase-1 rule catalogue, respecting the caps, the anti-split floor, and the payment-gate rule that closes the self-declared-arrival loop. Every wired Server Action returns the progression delta in its own success payload so the client can raise the unlock toast optimistically (`FR-12-13`). Writes the ADR for deferred credit with no pending UI state.

## In Scope

- credit call site in `createOrder` (`src/lib/data/orders/orderMutations.ts:84`): `order-created`, 5 points, immediate, inside the same transaction, after the store/category/initial-payment refusals and after `order.create` (`FR-12-05`)
- credit call site in `writeStorePaymentWithAllocations` (`src/lib/data/orders/storePaymentMutations.ts:399`, the shared writer `createOrder`'s initial payment and `createStorePayment` both call): `order-first-payment` (8 points, once per order, on the order's first-ever allocation) and `order-registered` (deferred credit, first assigned payment or first arrival, sublinear per store/month per `FR-12-07`)
- credit call site in `createDelivery` (`src/lib/data/deliveries/deliveryMutations.ts:169`) and `markDeliveryDelivered` (`deliveryMutations.ts:425`): `delivery-received`, 25 points, immediate, per delivery (not per product), inside the delivery transaction
- credit call site in `createOrder` for `store-first-order` (20 points): the first order ever placed at a given store by this user, evaluated inside the same transaction as the order create
- the `BR-12-13` gate: `order-registered`, `delivery-received`, and (by construction, since it is `der.`) `order-completed` only mature once the order carries `≥1 PaymentAllocation`; enforced in the recompute's eligibility step from `WO-01`, not re-implemented here, but this slice's call sites must still fire unconditionally (crediting an entry that the recompute may later find ineligible is correct; skipping the write because "no payment yet" would make the entry retroactively uncreditable once a payment does land, since the write already happened at the wrong moment)
- the `BR-12-07` gate: no call site fires when the order/delivery/review's store is private (`Store.isPrivate` or `Store.visibility === "PRIVATE"`) or is not `APPROVED` (`Store.status !== "APPROVED"`). Who registered the store is deliberately NOT read (amended 2026-08-23) — see Call Site Placement Notes for the widened `select` each call site needs, since today's `store.findFirst` calls in `createOrder` and `createDelivery` only select `id`
- extending the Server Action wrappers for `createOrder`, `createStorePayment`, `createDelivery`, `markDeliveryDelivered` to return `{ ..., progression: { pointsDelta, rankUp, medalsUnlocked: [] } }` per the `BP-01` Server Action contract; `medalsUnlocked` stays an empty array in this slice
- credit call site for the three `der.` rules, moved INTO this slice (see Scope Correction below): `order-completed` in `persistDerivedOrderStatuses`, `order-settled` in the two `PaymentAllocation` producers, `product-type-discovered` where a product reaches `DELIVERED`
- `ADR 0037`, deferred credit with no pending UI state, one writer per rule, and the two transaction corollaries (`FR-12-05`)
- unit tests for each new call site: correct `ruleKey`, correct `entityType`/`entityId`, correct `occurredOn`, gated correctly by `BR-12-07` and `BR-12-13`
- `POSTHOG_EVENTS.PROGRESSION` group added to `src/lib/constants.ts` (namespace only; the events themselves fire from the UI slices that consume this contract, `WO-04`/`WO-05`/`WO-06`)

## Out of Scope

- the toast UI that renders `medalsUnlocked` (belongs to `WO-06`)
- medal evaluation itself (belongs to `WO-05`; this slice ships the contract shape with an empty array)
- `store-reviewed` (belongs to `WO-05`'s call site work alongside the medal catalogue it also touches, since both read the same store-review anchor)
- phase-2 rules (`order-item-registered`, `order-data-complete`, `order-created-from-image`, `order-payment-detailed`, `item-paid-declared`, `item-arrived-at-store`, `store-created-adopted`)

## Scope Correction: the three `der.` rules had no writer

The original cut left `order-completed`, `order-settled` and `product-type-discovered` out of this slice on the grounds that they are "evaluated by the recompute". Building `WO-01` showed that reading to be wrong in a way no test could catch: the recompute iterates the LEDGER, not the world, so a rule whose entry no mutation ever appends is worth zero points forever, while every unit test stays green because each one asserts that the recompute *would* count such an entry correctly.

All three are therefore credited in this slice, each by exactly one call site placed where the state it depends on is derived and persisted. The division of labour is unchanged: the write only prices the fact at the moment it happens, and the recompute alone decides whether the entry still counts. [`ADR 0037`](../../../../../design/decisions/0037-progression-deferred-credit-no-pending-state.md) records the decision; `FRD-12`'s `FR-12-04` table and `BP-01`'s Architecture Decisions were corrected in the same change.

### Known gap, deliberately recorded

`order-settled` is credited where declared money is written, which covers the two paths that produce `PaymentAllocation` rows in a live flow. Two rarer routes to being fully covered do not append it yet: a store-account reconciliation writing the balance off (`StoreAccountAdjustmentLine`), and an order edit lowering `totalCost` onto what is already declared. In both cases the entry lands the next time money is declared against that order. Closing it for good means either instrumenting those two writers or teaching the recompute to materialise a missing `der.` entry from facts it already resolves; neither is in this slice.

### `store-reviewed` stays out

It belongs to `WO-05`, it is a phase-2 rule, and it is not in `pointRules.ts`'s phase-1 catalogue at all, so `upsertStoreReview` is untouched here.

## Requirements

- `FR-12-04` (call-site placement for the phase-1 `imm.`/`def.` rows)
- `FR-12-05` (immediate `order-created` credit, no pending state)
- `FR-12-07` (sublinear `order-registered`)
- `FR-12-12` (credit inside the host transaction, after its last refusal)
- `FR-12-13` (Server Action returns the progression delta)
- `BR-12-03`, `BR-12-04` (no points for empty activity, server-side against real state)
- `BR-12-07` (private/non-`APPROVED` store credits nothing; a self-registered store that is approved and public credits normally)
- `BR-12-13` (no order points without an assigned payment, enforced by the recompute this slice's writes feed)
- `BR-12-14` (anti-split floor of 5)
- `BR-12-16` (`order-created` irrevocable against cancellation)

## Blueprints

- [`BP-01`](../bp-01-collector-progression.md) — Architecture Decisions on credit-failure swallowing and the two-transaction settlement split; the Server Action contract in Contracts
- [`FRD-08 · BP-01`](../../../frd-08-delivery-management/bp-01-delivery-management/bp-01-delivery-management.md) — `ADR 0032`'s two-transaction settlement split; the delivery credit call site must land in whichever transaction actually closes `DELIVERED` (`createDelivery` when `receivedDate` is set at creation, or `markDeliveryDelivered`), never in the independent money transaction

## Call Site Placement Notes

- **Credit failures are swallowed, never surfaced as a host refusal** (Error Contract, `FRD-12`). Each call site wraps `awardPoints` so a thrown error inside it is caught, logged with progression-safe context (no amounts, no store names), and the host mutation's own return value is unaffected. This must not be implemented as `await awardPoints(...)` unguarded inside the transaction, because an unhandled rejection there would roll back the host's real write, which is exactly the asymmetry the Error Contract forbids.
- **Order of operations inside `createOrder`**: refusals (`STORE_NOT_FOUND`, `INVALID_PRODUCT_TYPE`, `INITIAL_PAYMENT_INVALID`) all happen before `order.create`, matching the existing ADR 0022 comment already in the file. The `order-created` and `store-first-order` credit calls go after `order.create` and after `createOrderItems`, alongside the existing `appendOrderHistoryEntry` call, never before it.
- **`order-registered`'s sublinear count** is computed by counting the user's own `order-registered`-eligible orders at that store within the current civil month at write time (a plain `count` query, no money read), then mapping position → {20, 15, 10, 5, 5, ...}. This count is a hint at write time, not the source of truth: the recompute is what actually caps and re-derives the final total, so a race between two same-month order creates producing the same "position" is not a correctness bug, only a display nuance the recompute settles on its next run.
- **`writeStorePaymentWithAllocations` is called from two places** (`createOrder`'s initial payment, and `createStorePayment`'s own body). The credit call belongs inside `writeStorePaymentWithAllocations` itself, not duplicated at both call sites, so both paths credit identically and the idempotency key (`entityId = orderId`) prevents a double credit if both somehow ran for the same order.
- **`writeStorePaymentWithAllocations` (`src/lib/data/orders/storePaymentMutations.ts:399`) loads no store row of its own**: it receives `storeId` as a plain string and never queries `Store`. Its two callers each load a store separately, and today both selects are narrower than the BR-12-07 gate needs: `createOrder`'s `tx.store.findFirst({ where: { id: input.storeId }, select: { id: true } })` and `createStorePaymentInTx`'s equivalent lookup at `storePaymentMutations.ts:498` (also `select: { id: true }`). Each of those two selects must widen to include `visibility`, `status`, `isPrivate`, and the resolved boolean (not the raw store row) must be threaded into `writeStorePaymentWithAllocations`'s `params` as a new field (for example `creditEligibleStore: boolean`) so the credit call inside it can gate without a third query. This is a scope correction to the original text ("checked inline... no extra query"), not new scope: no call site issues an additional database round trip, but two existing `select` clauses grow by three fields each (originally four: `createdByUserId` was dropped when `BR-12-07` was relaxed on 2026-08-23).
- **`createDelivery`'s store lookup has the same gap**: `tx.store.findFirst({ where: { id: input.storeId }, select: { id: true } })` (`src/lib/data/deliveries/deliveryMutations.ts:178`) must widen the same way before the `delivery-received` credit call site can read `BR-12-07`'s three fields.

## Security Notes

- Every credit call site derives `ruleKey`, `entityType`, and `entityId` from server-resolved values the host mutation already computed (the created row's own `id`, the caller's own `userId`), never from client input. There is no code path where a client can name an arbitrary `ruleKey` or inflate `points`.
- The `BR-12-07` gate must read the widened store `select` (see Call Site Placement Notes) inside the same transaction as the credit call, not a value cached from an earlier request; a store's `status`/`visibility` can change between page load and submission, and the gate exists precisely to stop an unapproved or private store from ever maturing points, including through a race.
- The `progression` field in each Server Action's success payload (`pointsDelta`, `rankUp`, `medalsUnlocked`) must only ever reflect the acting user's own ledger. `MedalUnlockSummary` (`{ medalKey, name, rarity, series }`) carries no field that could leak another user's activity, and this slice's stub always returns `medalsUnlocked: []`.
- Credit failures are caught and logged with progression-safe context only (`BP-01` Architecture Decisions: "no amounts, no store names"); the existing Sentry capture pattern (`.agents/rules/sentry-error-handling.mdc`) applies, scoped to avoid leaking a store's identity or a payment's amount into an error report about a secondary, non-critical effect.

## Technical Notes

- `writeStorePaymentWithAllocations` runs inside two different transaction shapes depending on caller: `createOrder`'s plain `prisma.$transaction` (`src/lib/data/orders/orderMutations.ts:85`) for the initial-payment path, and `createStorePaymentInTx` wrapped by `runSerializableTransaction` (`src/lib/data/orders/storePaymentMutations.ts:635`) for the standalone payment path. The credit call inside `writeStorePaymentWithAllocations` must not assume either isolation level; `awardPoints(tx, ...)` (`WO-01`) only needs whatever `tx` it is handed.
- `createDelivery` and `markDeliveryDelivered` each already return inside their own `prisma.$transaction` callback (`src/lib/data/deliveries/deliveryMutations.ts:169`, `:425`). The `delivery-received` credit call goes after the `orderItem.updateMany`/`persistDerivedOrderStatuses` calls and before the `return`, in the same position the existing `closedOrders` computation occupies in `markDeliveryDelivered`.
- `occurredOn` for every call site is the civil day resolved at the moment of crediting (`new Date()` run through the same timezone resolver `WO-01`'s Technical Notes describe), never the order's `orderDate`, the delivery's `deliveryDate`, or the payment's `paymentDate` (`FR-12-10`, `BR-12-17`).
- `src/test/transaction-refusal-guard.test.ts` scans every non-test file under `src/lib/data/` automatically; no manual edit to that file is required for this slice's call sites to be covered. What matters is that every credit call in `createOrder`, `writeStorePaymentWithAllocations`, `createDelivery`, and `markDeliveryDelivered` is placed after that function's own last refusal, matching the placement already documented above.
- **The duplicate must be resolved by the database, not by a catch.** `WO-01`'s `awardPoints` catches `P2002` and reports "already credited", which is correct for a standalone write and unsafe inside a host transaction: PostgreSQL aborts the entire transaction on a constraint violation, so a retry landing on an already-credited entity would roll the ORDER back. Every call site here therefore goes through `awardPointsBatch`, one `createMany({ skipDuplicates: true })` per credit step (`ON CONFLICT DO NOTHING`, which never raises). `awardPoints` stays for the backfill script, which owns its own transaction.
- **The shared credit surface is `src/lib/data/progression/accrual.ts`**, one exported function per anchor, each swallowing its own failure and returning rows appended or `null`. `combineCredits` folds several steps into one outcome and poisons it to `null` if any step failed, so a partial delta can never reach the client. `settleProgression` runs AFTER the host transaction commits: it reads the cache, runs the recompute, and returns `{ pointsDelta, rankUp, medalsUnlocked: [] }` derived from the difference, never from the rows just written.
- **The store gate lives in `src/lib/data/progression/storeCreditEligibility.ts`**, imported by both the recompute and every call site, with `STORE_CREDIT_ELIGIBILITY_SELECT` as the exact `select` a host mutation must widen to. `recompute.ts`'s private copy of the predicate was replaced by that import: two definitions of "this store may credit" would eventually disagree, and a collector would watch points appear and then vanish.
- `persistDerivedOrderStatuses` gained a `userId` parameter and now scopes its own `findMany` by it. Behaviour is unchanged (every caller reaches it through products already proven to belong to the collector) and it removes the one place in the delivery lifecycle where an order was re-derived by id alone.
- `POSTHOG_EVENTS.PROGRESSION` is added as an empty or single-key namespace object following the existing structure of `POSTHOG_EVENTS` in `src/lib/constants.ts:113`; this slice adds the namespace only, no event fires from it yet.

## Assumptions

- `store-first-order`'s "first order ever placed at a given store by this user" check is a `count` query inside `createOrder`'s own transaction (`tx.order.count({ where: { storeId, userId } })` before the new `order.create`, or an equivalent check against rows already loaded), consistent with the sublinear `order-registered` count already described above as a write-time hint, not a source of truth: the recompute is what finally settles ties.
- The Server Action wrappers referenced (for `createOrder`, `createStorePayment`, `createDelivery`, `markDeliveryDelivered`) already exist under their respective route trees; this slice extends their return type and body to add the `progression` field, it does not create new Server Actions.
- A credit call site that throws is caught locally (per Call Site Placement Notes) and never propagates to the host mutation's own try/catch or Sentry boundary as if it were a host-mutation failure; it is captured with its own, separate context.
- `ADR 0037` (deferred credit with no pending UI state) is authored as part of this slice's implementation, per `BP-01` Architecture Decisions, and lives at `docs/design/decisions/0037-progression-deferred-credit-no-pending-state.md` following the existing ADR numbering and filename convention (`0035-collector-progression-point-ledger.md`, `0036-medal-rarity-visual-system.md`).

## E2E Acceptance Tests

- Given a collector creates an order at a new, approved public store and logs its first payment
- When the order-create and payment Server Actions each resolve
- Then the order-create response carries `progression.pointsDelta` reflecting `order-created` (+5) and `store-first-order` (+20) when it is the first order at that store
- And the payment response carries `progression.pointsDelta` reflecting `order-first-payment` (+8) and, once the order also has a delivery or the sublinear position resolves, `order-registered`

- Given a collector creates 8 orders at the same store within one civil month
- When each order-create Server Action resolves
- Then the 5th through 8th each report the floor value for `order-registered` in their own `pointsDelta`, never zero (`BR-12-14`)

- Given a collector logs a payment against an order at a store that is still unapproved
- When the payment Server Action resolves
- Then `progression.pointsDelta` is `0` and no ledger entry names that order (`BR-12-07`)

- Given a delivery is marked delivered through `markDeliveryDelivered`
- When the Server Action resolves
- Then `progression.pointsDelta` includes `delivery-received`'s 25 points, credited inside the same transaction that set the delivery to `DELIVERED`, never inside the independent settlement money transaction

## Unit Test Matrix

### `orderMutations.test.ts` (new cases)

| Scenario                                                                                               | Expected                                                                                     |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `createOrder` succeeds at a new, approved public store                                                 | `order-created` and `store-first-order` both credited via `awardPoints`                      |
| `createOrder` succeeds at a store where the user already has an order                                  | `order-created` credited; `store-first-order` not called                                     |
| `createOrder` succeeds at a private or non-`APPROVED` store                                            | No credit call fires for either rule (`BR-12-07`)                                            |
| `createOrder` succeeds at an `APPROVED`, public store the collector registered themselves               | Both rules credit normally (`BR-12-07`, amended 2026-08-23)                                   |
| `createOrder` returns a refusal (`STORE_NOT_FOUND`, `INVALID_PRODUCT_TYPE`, `INITIAL_PAYMENT_INVALID`) | No credit call fires; refusal happens before any write, matching existing ADR 0022 placement |
| `awardPoints` throws inside the credit call                                                            | Caught locally; `createOrder`'s own success result is unaffected                             |

### `storePaymentMutations.test.ts` (new cases)

| Scenario                                                                                                | Expected                                                                        |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `writeStorePaymentWithAllocations` called for an order's first-ever allocation                          | `order-first-payment` credited once                                             |
| `writeStorePaymentWithAllocations` called again for the same order's later allocation                   | `order-first-payment` not credited again (idempotency key `entityId = orderId`) |
| Called with `creditEligibleStore: false` (private/non-`APPROVED`)                                       | Neither `order-first-payment` nor `order-registered` credited (`BR-12-07`)      |
| Called from both `createOrder`'s initial payment and `createStorePayment`'s own body for the same order | Exactly one `order-first-payment` entry survives                                |
| `order-registered`'s sublinear position, 1st through 8th same-store order in one civil month            | Points follow 20/15/10/5/5/5/5/5 (`BR-12-14`)                                   |

### `deliveryMutations.test.ts` (new cases)

| Scenario                                                                           | Expected                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `createDelivery` with `receivedDate` set (quick arrival)                           | `delivery-received` credited inside the same transaction as the create         |
| `createDelivery` without `receivedDate` (standard, `IN_TRANSIT`)                   | `delivery-received` not credited yet                                           |
| `markDeliveryDelivered` on an `IN_TRANSIT` delivery                                | `delivery-received` credited inside the same transaction that sets `DELIVERED` |
| `markDeliveryDelivered` at a private/non-`APPROVED` store                          | No credit call fires (`BR-12-07`)                                              |
| `markDeliveryDelivered` returns a refusal (`DELIVERY_NOT_FOUND`, `INVALID_STATUS`) | No credit call fires                                                           |

### Server Action payload shape (unit or integration level)

| Scenario                                                      | Expected                                                                     |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A wrapped Server Action's crediting mutation succeeds         | Response includes `progression: { pointsDelta, rankUp, medalsUnlocked: [] }` |
| A wrapped Server Action's credit call is caught and swallowed | Response includes `progression: null`, never a partial or guessed delta      |
