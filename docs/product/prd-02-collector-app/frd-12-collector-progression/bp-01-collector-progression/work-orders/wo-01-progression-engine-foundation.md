---
id: WO-01
type: WORK_ORDER
slug: progression-engine-foundation
title: Progression Engine Foundation
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0021
source_issue: 140
implementation_status: IN_PROGRESS
last_updated: 2026-08-23
---

# WO-01 Progression Engine Foundation

## Summary

Establish the progression persistence model, the point-rule catalogue, the money-predicate adapter, the on-demand recompute engine, and the static money guard that every downstream progression slice depends on. Ships the admin void mutation and read-only ledger query as data-layer functions. No UI, no collector-facing routes: this is the foundation slice for [`BP-01`](../bp-01-collector-progression.md), the same role [`FRD-08 · BP-01 · WO-01`](../../../frd-08-delivery-management/bp-01-delivery-management/work-orders/wo-01-delivery-foundation.md) played for the delivery domain. It is validated with unit tests, not an E2E path.

## In Scope

- four Prisma models: `PointLedgerEntry`, `UserProgress`, `MedalUnlock`, `ProgressionSettings` (schema below)
- Prisma migration (`npm run db-migrate -- --name collector-progression-foundation`)
- `src/lib/data/progression/pointRules.ts`: the phase-1 rule catalogue (8 rules), each with its `ruleKey`, point value or sublinear formula, cap value and unit, and anchor description; no import of anything that touches money
- `src/lib/data/progression/moneyPredicateAdapter.ts`: the only module in the domain allowed to read a monetary field; exposes `isFullyAllocated(orderId): Promise<boolean>` for `order-settled` and any other boolean money predicate a phase-1 rule needs
- `src/lib/data/progression/recompute.ts`: `recomputeUserProgress(userId)`, batch eligibility resolution per `entityType`, cap enforcement, rank derivation (current + highest, honoring the merit lock formula even though it only bites at rank 9+), medal condition evaluation hook (stubbed to return no unlocks until `WO-05` fills the catalogue)
- `src/lib/data/progression/progressionQueries.ts` / `progressionMutations.ts`: the ledger write helper (`awardPoints`, idempotent upsert-or-skip), `getUserProgressCache`, `voidUserProgressionPoints` (`FR-12-44`), `listUserPointLedger` (`FR-12-45`)
- the civil-day resolver call for `occurredOn`, reusing the same timezone helper the budget cycle uses (`FR-12-10`)
- `src/test/progression-money-guard.test.ts`: static guard scanning `pointRules.ts` for forbidden money identifiers, with an inline fixture the guard must actually flag (`AC-12-06`)
- unit tests for the ledger write helper, the recompute engine, and the money guard

## Out of Scope

- any UI, including shared components
- any collector-facing route
- call sites inside the existing order/payment/delivery/store mutations that invoke `awardPoints` (belongs to `WO-02`)
- the rank ladder's threshold table and its i18n (belongs to `WO-03`)
- the medal catalogue's content (24 medals, 6 series) and its unlock evaluator logic (belongs to `WO-05`; this slice ships only the hook the recompute calls)
- the admin route/page that would call `voidUserProgressionPoints` and `listUserPointLedger` from a UI (deferred, see `BP-01` Risks)
- PostHog events (belong to the vertical slices that introduce user-visible actions)
- the Notion backfill script (belongs to `WO-06`, though it will call the `awardPoints` helper this slice ships)

## Requirements

- `FR-12-01` through `FR-12-04` (ledger shape, idempotency, derived balance, rule catalogue definition)
- `FR-12-06` (caps declared with an explicit unit, enforced by the recompute)
- `FR-12-07` (sublinear `order-registered` formula)
- `FR-12-08` (the exhaustive zero-credit list, encoded as the absence of a rule matching those facts)
- `FR-12-09` (money predicates arrive as booleans from the adapter)
- `FR-12-10` (civil-day `occurredOn`)
- `FR-12-11` (on-demand recompute, no cron, no materialized view)
- `FR-12-44`, `FR-12-45` (admin void, admin read-only ledger view — data layer only)
- `BR-12-01` (no point rule reads money, enforced by the static guard)
- `BR-12-03`, `BR-12-04`, `BR-12-05` (no points for empty activity, server-side and real-state crediting, append-only with no negative entries)
- `BR-12-07` (a private store or a non-`APPROVED` store credits nothing; authorship is not part of the gate, amended 2026-08-23)
- `BR-12-09` (no monetary rewards)
- `BR-12-12` (`BACKFILL` source stored on the entry)
- `BR-12-14` (sublinear split-purchase floor of 5)
- `BR-12-15` (every cap declares its unit)
- `BR-12-16` (`order-created` irrevocable against cancellation, not against deletion)
- `BR-12-17` (civil-day `occurredOn`, never re-bucketed by a later recompute)
- `BR-12-18` (`entityId` is a plain string, no foreign key)
- `BR-12-20` (event window absolute, modeled even though no phase-3 rule uses it yet)

## Blueprints

- [`BP-01`](../bp-01-collector-progression.md) — Architecture Decisions on the append-only ledger, the money guard, the on-demand recompute, and the admin-void data-layer-only scope; Contracts for the ledger write and recompute shapes
- [ADR 0035](../../../../../design/decisions/0035-collector-progression-point-ledger.md) — the canonical ledger shape this slice implements verbatim

## Schema Contract

### `PointLedgerEntry`

| Field            | Type                          | Notes                                                                                      |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| `id`             | `String @id @default(cuid())` |                                                                                            |
| `userId`         | `String`                      | FK to `User`, cascade delete                                                               |
| `ruleKey`        | `String`                      | one of the `pointRules.ts` catalogue keys                                                  |
| `entityType`     | `String`                      | e.g. `"order"`, `"delivery"`, `"storePayment"`, `"storeReview"`, `"orderItem"`             |
| `entityId`       | `String`                      | plain string, **no foreign key** (`BR-12-18`), survives the entity's own physical deletion |
| `points`         | `Int`                         | strictly positive                                                                          |
| `occurredOn`     | `DateTime`                    | civil day, server-resolved (`FR-12-10`), date-only precision                               |
| `source`         | `PointLedgerSource`           | `LIVE` \| `BACKFILL`                                                                       |
| `createdAt`      | `DateTime @default(now())`    | wall-clock write time, distinct from `occurredOn`                                          |
| `voidedAt`       | `DateTime?`                   | `null` unless an admin void (`FR-12-44`) excluded this entry; set atomically with the void |
| `voidedReason`   | `String?`                     | admin-supplied reason, required whenever `voidedAt` is set                                 |
| `voidedByUserId` | `String?`                     | the acting admin's `userId`, no cascade, kept even if the admin's account is later removed |

Unique constraint: `@@unique([userId, ruleKey, entityId])`. Index: `userId`. Index: `voidedAt` (the recompute filters on it every run).

### `UserProgress`

Rebuildable cache, never a source of truth.

| Field              | Type         | Notes                                            |
| ------------------ | ------------ | ------------------------------------------------ |
| `userId`           | `String @id` | FK to `User`, cascade delete                     |
| `maturedPoints`    | `Int`        | derived total after caps and eligibility         |
| `rankIndex`        | `Int`        | current derived rank (1-10)                      |
| `highestRankIndex` | `Int`        | running maximum, never decreases (`BR-12-06`)    |
| `lastRecomputedAt` | `DateTime`   | drives the six-hour staleness check (`FR-12-11`) |

### `MedalUnlock`

| Field          | Type                          | Notes                                                                     |
| -------------- | ----------------------------- | ------------------------------------------------------------------------- |
| `id`           | `String @id @default(cuid())` |                                                                           |
| `userId`       | `String`                      | FK to `User`, cascade delete                                              |
| `medalKey`     | `String`                      | one of the `medalCatalogue.ts` keys (catalogue content ships in `WO-05`)  |
| `unlockedAt`   | `DateTime`                    | backfilled entries carry the backfill date, not a fabricated original one |
| `seenAt`       | `DateTime?`                   | `null` until the toast/celebration has shown; backfilled rows are pre-set |
| `series`       | `String`                      | denormalized from the catalogue for query-time grouping                   |
| `rarity`       | `String`                      | denormalized, one of the five `ADR 0036` grades                           |
| `numbered`     | `Boolean @default(false)`     | phase-3 event-medal support (`FR-12-28`)                                  |
| `serialNumber` | `Int?`                        | ordinal stamped at unlock time when `numbered` is true                    |
| `source`       | `PointLedgerSource`           | `LIVE` \| `BACKFILL`, reuses the ledger's enum                            |

Unique constraint: `@@unique([userId, medalKey])`, the medal-unlock idempotency key.

### `ProgressionSettings`

| Field                     | Type                      | Notes                                                                                                           |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `userId`                  | `String @id`              | FK to `User`, cascade delete                                                                                    |
| `hideProgression`         | `Boolean @default(false)` | `FR-12-38`                                                                                                      |
| `lastCelebratedRankIndex` | `Int @default(0)`         | drives the once-per-rank celebration guard (`FR-12-19`), read/written by `WO-06`'s UI but the column lives here |

No columns are added for future opt-ins beyond this shape; a future comparison FRD adds its own column when its legal preconditions clear (`BR-12-21`).

## Point Rule Catalogue (phase 1)

`src/lib/data/progression/pointRules.ts` exports a typed, frozen list. Each entry: `{ ruleKey, points: number | ((context) => number), capUnit: "points" | "events", capValue: number, capWindow: "month" | "lifetime", timing: "imm." | "def." | "der." }`.

| `ruleKey`                 | Points                                        | Cap (unit)                                  | Timing |
| ------------------------- | --------------------------------------------- | ------------------------------------------- | ------ |
| `order-created`           | 5                                             | 10 events/month                             | imm.   |
| `order-registered`        | 20/15/10/5 sublinear per store/month, floor 5 | 120 points/month                            | def.   |
| `order-first-payment`     | 8                                             | 80 points/month                             | def.   |
| `delivery-received`       | 25                                            | 200 points/month                            | imm.   |
| `order-completed`         | 30                                            | 240 points/month                            | der.   |
| `order-settled`           | 12                                            | 120 points/month                            | der.   |
| `store-first-order`       | 20                                            | 80 points/month                             | imm.   |
| `product-type-discovered` | 12                                            | 1 event/lifetime, bounded by seeded catalog | der.   |

This is the table from `FR-12-04`, phase-1 rows only. Phase-2 rows are added by a future work order without a schema change (`BP-01` Extension Points).

## Money-Predicate Adapter

`src/lib/data/progression/moneyPredicateAdapter.ts` is the sole module in `src/lib/data/progression/` permitted to import Prisma fields named `amountMinor`, `allocatedAmountMinor`, `totalCost`, `openBalanceMinor`, or any `*Minor` identifier. Phase 1 needs exactly one predicate:

```ts
async function isFullyAllocated(orderId: string): Promise<boolean>;
```

Reads `openBalanceMinor(order)` (the canonical helper from `FRD-05 · BP-01 · WO-10`, verified at `src/lib/data/orders/orderOpenBalance.ts`) and returns `openBalanceMinor === 0`. `order-settled`'s rule definition in `pointRules.ts` calls this boolean only, never the underlying figure.

`BR-12-13`'s "no order points without an assigned payment" gate is a **separate, cheaper existence check** (`PaymentAllocation` count `> 0` for the order), not a money read, and lives in the recompute's eligibility resolution rather than the adapter, because it never touches an amount.

## Recompute Engine

```ts
async function recomputeUserProgress(userId: string): Promise<RecomputeResult>;
```

1. Load all `PointLedgerEntry` rows for `userId` with `voidedAt IS NULL`, grouped by `entityType`. A voided entry never re-enters the surviving set, regardless of the entity's own current state.
2. Per `entityType`, batch-resolve current state (does the entity still exist; for orders, is it not `CANCELLED` and does it carry `≥1 PaymentAllocation`; for deliveries, is it not `CANCELLED`/reopened out of `DELIVERED`; for stores, is the referenced store still `APPROVED` and not private) — one query per `entityType`, not one per entry.
3. Drop ineligible entries from the surviving set (no write, no compensating entry: `BR-12-05`).
4. Apply `FR-12-06` caps over the surviving set in a deterministic order (ascending `occurredOn`, then `createdAt`), grouped by civil month and `ruleKey`, respecting each rule's declared unit.
5. Sum the capped, eligible entries into `maturedPoints`.
6. Derive `rankIndex` from `rankLadder.ts`'s thresholds (stub returns rank 1 until `WO-03` ships the real ladder); for ranks 9-10, additionally require the merit lock (stub always satisfied until `WO-03`/`WO-05` exist).
7. Set `highestRankIndex = max(existing highestRankIndex, rankIndex)` (`BR-12-06`).
8. Evaluate medal conditions (stub: no-op until `WO-05` fills `medalCatalogue.ts`'s evaluator).
9. Upsert `UserProgress` with the result and `lastRecomputedAt = now()`.

Steps 6 and 8 are written as calls to injected, swappable functions (`rankLadder.deriveRank`, `medalCatalogue.evaluateUnlocks`) so `WO-01` can ship a working, tested recompute before either dependency exists, and `WO-03`/`WO-05` replace the stub without touching this file's control flow.

## Ledger Write Helper

```ts
// takes an optional tx so a caller mid-transaction can pass its own client
async function awardPoints(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    userId: string;
    ruleKey: string;
    entityType: string;
    entityId: string;
    points: number;
    occurredOn: Date;
    source: "LIVE" | "BACKFILL";
  },
): Promise<{ credited: boolean }>;
```

Issues a single `create` guarded by `skipDuplicates`-equivalent handling of the unique-constraint violation (catch `P2002`, return `{ credited: false }`), never a `findFirst` followed by a conditional `create` (a TOCTOU race under concurrent retries of the same host mutation). This is the function `WO-02` calls from inside each host mutation's transaction, and the one `WO-06`'s backfill script calls per synthetic entry.

## Module Structure

| Path                                                  | Responsibility                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/data/progression/pointRules.ts`              | phase-1 rule catalogue, cap definitions; **imports nothing money-related**   |
| `src/lib/data/progression/moneyPredicateAdapter.ts`   | the only money-reading module in the domain                                  |
| `src/lib/data/progression/rankLadder.ts`              | stub in this slice; real content in `WO-03`                                  |
| `src/lib/data/progression/medalCatalogue.ts`          | stub in this slice; real content in `WO-05`                                  |
| `src/lib/data/progression/recompute.ts`               | `recomputeUserProgress`                                                      |
| `src/lib/data/progression/progressionQueries.ts`      | `getUserProgressCache`, `listUserPointLedger`                                |
| `src/lib/data/progression/progressionMutations.ts`    | `awardPoints`, `voidUserProgressionPoints`                                   |
| `src/lib/data/progression/_tests/recompute.test.ts`   | recompute unit tests (`AC-12-01` through `AC-12-09`, `AC-12-14`, `AC-12-15`) |
| `src/lib/data/progression/_tests/awardPoints.test.ts` | idempotency and concurrent-retry tests                                       |
| `src/test/progression-money-guard.test.ts`            | static guard, `BR-12-01`, `AC-12-06`                                         |

## Admin Void and Read-Only Ledger (`FR-12-44`, `FR-12-45`)

```ts
async function voidUserProgressionPoints(input: {
  actorId: string;
  targetUserId: string;
  reason: string;
}): Promise<VoidResult>;
```

Writes no negative ledger row (`BR-12-05` forbids negative entries). Instead it sets `voidedAt = now()`, `voidedReason = input.reason`, and `voidedByUserId = input.actorId` on every affected `PointLedgerEntry`, so the recompute's `voidedAt IS NULL` filter excludes them going forward without deleting the historical row. It then triggers `recomputeUserProgress` for `targetUserId` inside the same transaction, and calls `writeAuditEntry` (`src/lib/data/admin/adminAuditMutations.ts`) with `tx` passed through so the audit row commits atomically with the void (`AC-12-16`). A `writeAuditEntry` failure throws and rolls the whole transaction back (`AUDIT_WRITE_FAILED`), never voids without a trail.

```ts
async function listUserPointLedger(targetUserId: string): Promise<PointLedgerEntryDto[]>;
```

Read-only; no update or delete path is exposed alongside it (`FR-12-45`).

Both functions are exported for a future admin route to call; this slice does not add that route (see `BP-01` Risks: `admin_audit_log` is not yet in production).

## Security Notes

- `voidUserProgressionPoints` and `listUserPointLedger` are data-layer functions only; this slice adds no route or Server Action, so nothing calls them from outside a test. The future admin route (`BP-01` Risks) must gate on `requireAdmin` (`src/lib/auth/auth-server.ts`), the same pattern `moderateProductTypeRequest` (`src/app/[locale]/(app)/admin/_actions/moderateProductTypeRequest.ts`) already uses. `actorId` is a caller-supplied argument and must never be treated as pre-authorized by this function itself.
- The money-predicate adapter (`src/lib/data/progression/moneyPredicateAdapter.ts`) is the single trust boundary for monetary reads in this domain. Any future rule that needs a new predicate must add it there, never inline in `pointRules.ts`; the static guard's identifier scan is the only thing standing between a rule and a monetary field it should never see.
- `awardPoints` must reject a non-positive `points` value before writing (`BR-12-05`); a caller mistake in `WO-02` must fail loudly here rather than silently persist a zero or negative entry.
- `entityId` is a plain string with no foreign key (`BR-12-18`). The recompute must never use it for anything beyond equality comparison against the ledger's own rows; it is not a validated reference to the entity it names.
- `voidedReason` is admin-authored free text. Any logging of a void failure (`AUDIT_WRITE_FAILED`) must follow the same "no amounts, no store names" discipline the rest of the domain already applies to credit-failure logging (`BP-01` Architecture Decisions, Error Contract).

## Technical Notes

- `occurredOn` resolution reuses `resolveTimeZone` (exported, `src/lib/data/dashboard/dashboardPeriods.ts:25`) for the null/invalid-timezone-to-UTC fallback. The instant-to-civil-day conversion itself (`getCivilDate`, `dashboardPeriods.ts:38`) is module-private, so this slice either exports it for reuse or re-implements the same `Intl.DateTimeFormat`-based logic locally under `src/lib/data/progression/`; duplicating the few lines is preferable to coupling the progression domain to a dashboard-owned internal.
- The migration is created with `npm run db-migrate -- --name collector-progression-foundation` per `.agents/rules/prisma-migration-workflow.mdc`; the standard `migrate dev` flow, followed by `npx prisma generate` and a passing `type-check`, is the definition of done, not a hand-written SQL fallback (that path is exceptional and only for a metadata-drift failure).
- `awardPoints`'s idempotency relies on catching Prisma's `P2002` unique-constraint violation, the same error family `serializableTransaction.ts` (`src/lib/data/orders/serializableTransaction.ts`) already imports `Prisma` for (`PrismaClientKnownRequestError`). Import `Prisma` from the generated client the same way (`../../../../generated/prisma/client`).
- `awardPoints` and `recomputeUserProgress` accept an optional `tx`, mirroring the pattern `writeAuditEntry` (`src/lib/data/admin/adminAuditMutations.ts:57`) already uses, not `runSerializableTransaction`. Progression writes never need Serializable isolation: the ledger append is idempotent by unique constraint rather than a read-then-write balance, and the cache write is a separate, best-effort write outside any money transaction (`BP-01` Architecture Decisions).
- `src/test/transaction-refusal-guard.test.ts` scans every non-test file under `src/lib/data/` automatically (its `DATA_DIR` constant); no manual edit to that guard is needed for `awardPoints` or `voidUserProgressionPoints` to be covered. `awardPoints` has no refusal path after a write (it only creates or catches `P2002`), and `voidUserProgressionPoints`'s only refusal (`VOID_REASON_REQUIRED`) must be decided before its first `update`, the same ADR 0022 placement rule every other writer in `src/lib/data/` already follows.

## Implementation Notes (recorded during build)

- **`delivery-received` is keyed on the delivery, not the order.** `entityType: "delivery"`, `entityId` the delivery id. Deleting and recreating a delivery therefore writes a second row, but the first names a delivery that no longer exists, so exactly one ever counts and the total returns to where it was (`AC-12-03`). Keying it on the order instead would have collapsed a split shipment's two arrivals into one credit.
- **A points cap pays the remainder of the entry that crosses it** rather than dropping that entry whole, so a cap of 120 pays 120 and not 115. An events cap (`order-created`) counts entries and ignores their value, which is the distinction `BR-12-15` exists to protect.
- **A `lifetime` cap is counted per entity**, so `product-type-discovered` credits once for each type forever rather than once in total. The unique constraint already guarantees one entry per type; the cap window is what stops the monthly bucket from applying.
- **Nothing writes ledger entries for the three `der.` rules yet.** This slice ships their eligibility and cap evaluation, and `WO-02` explicitly excludes their call sites ("no call site here"), so `order-completed`, `order-settled` and `product-type-discovered` will evaluate correctly but never be credited until a later slice decides who materializes them. The recompute as specified here reads the ledger and never appends to it; materializing a `der.` entry requires scanning entities that have no ledger row yet, which is a larger change than either slice currently owns. **This gap needs an owner before phase 1 ships.**
- **`occurredOn` uses `getTodayStart(now, timezone)`**, the same resolver the budget cycle and the overdue chips use, and `src/test/civil-day-guard.test.ts` was extended to cover the progression resolver so a wall-clock regression there fails the build.
- **`MedalUnlock` carries no `availableFrom` / `availableTo` columns.** The event window is a property of the catalogue (a code module), not of an unlock row: an unlock is by definition inside its window. `BP-01`'s Extension Points names those two columns as shipping here; the Schema Contract above, which is the binding shape, does not, and the catalogue is where `WO-05` will put them.

## Assumptions

- `admin_audit_log` exists in the dev database today but not yet in production (`BP-01` Risks, `project_prod_cutover_2026-08-22`). `voidUserProgressionPoints` is buildable and testable now; its production callability is gated on that table landing in prod, not on anything this slice does.
- `rankLadder.deriveRank` and `medalCatalogue.evaluateUnlocks` stubs return deterministic results (rank 1, no unlocks) so this slice's own recompute tests do not depend on `WO-03`/`WO-05` landing first. The stub call signatures are the extension seam those work orders fill without touching `recompute.ts`'s control flow.
- No route or Server Action calls the admin functions in this slice; they are unit-tested by calling the data-layer functions directly, the same validation approach `FRD-08 · BP-01 · WO-01` used for its own foundation slice.
- The point rule catalogue is authored as literal in-memory data in `pointRules.ts`, never a seed table, consistent with that module never importing Prisma at all (`BP-01` Runtime Components).

## E2E Acceptance Tests

This foundation slice is exempt from the "must include an E2E acceptance path" rule; it ships no UI. Validated with unit tests covering, at minimum:

- `AC-12-01`: 20 create-and-cancel cycles in one month cap `order-created` at exactly 50 points (10 events), with zero `order-registered`/`delivery-received`/`order-completed` because no `PaymentAllocation` exists
- `AC-12-02`: create → pay → delete, repeated 3 times, returns the derived balance to its starting value each time with no negative entry ever written
- `AC-12-03`: deliver → reopen → delete → recreate the same products credits `delivery-received` exactly once
- `AC-12-04`: cancel → reactivate → cancel → reactivate keeps `order-created` at every step (`BR-12-16`) while any per-product marker cleared by cancellation stops contributing at the same step
- `AC-12-05`: delete-then-rewrite a store review credits `store-reviewed` exactly once because `entityId` is the store
- `AC-12-06`: the money guard fails against a fixture containing `totalCost` and passes against the real `pointRules.ts`
- `AC-12-07`: orders/arrivals/reviews/discoveries against a private, `PENDING` or `REJECTED` store credit zero points, while the same activity at an `APPROVED` public store the collector registered themselves credits in full
- `AC-12-08`: an order with zero `PaymentAllocation`, arrived via quick arrival, credits only `order-created`'s 5 points
- `AC-12-09`: eight same-store orders yield strictly fewer `order-registered` points than eight cross-store orders, both strictly under 8× the first-order value, with the 5th+ same-store orders each at the floor of 5
- `AC-12-14`: `recomputeUserProgress` run twice with no intervening mutation produces identical output
- `AC-12-15`: `product-type-discovered` credits nothing before `DELIVERED`, exactly 12 points once after
- `AC-12-16`: an admin void commits the reversal, the recomputed total, the recomputed highest rank index, and the `admin_audit_log` entry together

## Unit Test Matrix

### `_tests/awardPoints.test.ts`

| Scenario                                                       | Expected                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| First call with a unique `(userId, ruleKey, entityId)`         | `{ credited: true }`, one `PointLedgerEntry` row created                          |
| Second call with the same `(userId, ruleKey, entityId)`        | `{ credited: false }`, no second row, no thrown error                             |
| Simulated concurrent duplicate (two calls racing the same key) | Exactly one row survives; the loser resolves `{ credited: false }`, never rejects |
| `points <= 0`                                                  | Rejects before any write                                                          |
| Called with a caller-supplied `tx`                             | Writes join the caller's transaction; no new transaction opened                   |
| `source: "BACKFILL"` vs `source: "LIVE"`                       | Persisted verbatim on the created row                                             |

### `_tests/recompute.test.ts`

| Scenario                                                                   | Expected                                                                                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-12-01`: 20 create-and-cancel cycles in one month                       | `order-created` capped at 50 points (10 events); no `order-registered`/`delivery-received`/`order-completed`                                  |
| `AC-12-02`: create, pay, delete, repeated 3 times                          | Derived balance returns to its starting value each time; no negative entry ever written                                                       |
| `AC-12-03`: deliver, reopen, delete, recreate the same products            | `delivery-received` credited exactly once                                                                                                     |
| `AC-12-04`: cancel, reactivate, cancel, reactivate                         | `order-created` matures at every step (`BR-12-16`); any per-product marker cleared by cancellation stops contributing at the same step        |
| `AC-12-05`: delete-then-rewrite a store review                             | `store-reviewed` credited exactly once (keyed by store `entityId`)                                                                            |
| `AC-12-07`: activity against a private, `PENDING` or `REJECTED` store      | Zero points credited                                                                                                                          |
| `AC-12-08`: order with zero `PaymentAllocation`, arrived via quick arrival | Only `order-created`'s 5 points mature                                                                                                        |
| `AC-12-09`: 8 same-store orders vs 8 cross-store orders in one month       | Same-store total strictly less than cross-store total; both strictly under 8x the first-order value; 5th+ same-store orders at the floor of 5 |
| `AC-12-14`: run twice with no intervening mutation                         | Identical output both times                                                                                                                   |
| `AC-12-15`: `product-type-discovered` before/after `DELIVERED`             | Zero before, exactly 12 points once after                                                                                                     |
| A voided entry (`voidedAt` set)                                            | Never re-enters the surviving set, regardless of the entity's own current state                                                               |
| A cap declared in `events` vs a cap declared in `points`                   | Enforced against the correct unit, not conflated (`BR-12-15`)                                                                                 |

### `progression-money-guard.test.ts`

| Scenario                                                       | Expected                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The real `src/lib/data/progression/pointRules.ts` scanned      | No forbidden money identifier found                                                                   |
| A fixture containing a forbidden identifier (e.g. `totalCost`) | The guard reports a violation, proving the scan can go red (`AC-12-06`)                               |
| The guarded module list still points at files that exist       | Fails if a listed module is renamed or moved (mirrors `money-modules-guard.test.ts`'s own self-check) |
