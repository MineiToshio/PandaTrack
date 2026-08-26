---
id: WO-05
type: WORK_ORDER
slug: medal-album
title: Medal Album
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0021
source_issue: 144
implementation_status: IN_PROGRESS
last_updated: 2026-08-26
---

# WO-05 Medal Album

## Summary

Ship the phase-1 medal catalogue (12 of the 24 medals: the 7 of `Primeros pasos`, the 4 of `La espera`, and 1 secret medal), the unlock evaluator wired into the call sites [`WO-02`](wo-02-accrual-in-existing-flows.md) already opened, the `"Medallas"` album tab content, and the medal detail subview. Extends `store-reviewed`'s own credit call site alongside the medal evaluator since both read the same store-review anchor. Writes the ADR for medals granting no points and never being revoked. **Amended 2026-08-26 (medal catalogue v2):** this slice's catalogue now carries **28 medals, all of them shipped and evaluable**; the twelve phase-2 rows it had left as silhouettes were promoted, `store-mapped-1` was replaced and four rows were added. See `Implementation Notes`.

## In Scope

- `src/lib/data/progression/medalCatalogue.ts`: the catalogue (12 awardable entries at the time of this slice, all 28 since catalogue v2) with `medalKey`, name/hint keys, condition predicate, rarity, series, `publicSafe`, `stateful` flag, and the phase-3 columns already modeled by `WO-01` (`series`, `availableFrom`, `availableTo`, `numbered`) left `null`/unset for every phase-1 medal
- `evaluateUnlocks(userId, context): Promise<MedalUnlockCandidate[]>`, called from `WO-01`'s recompute (replacing its stub) and from each `WO-02` call site directly after `awardPoints`, so a same-transaction action can report a same-response unlock (`FR-12-13`) without waiting for the next recompute
- the accessor `rankLadder.ts` (`WO-03`) calls for the merit lock: shipped-medal count excluding event medals whose window has closed and medals dependent on another user's action (`store-mapped-1`, replaced on 2026-08-26 by the controllable `store-charted-1`, so the accessor excludes nothing today and the two exclusions stand only for a future event medal)
- credit/evaluation call site for `store-reviewed` in `upsertStoreReview` (`src/lib/data/stores/storeMutations.ts:144`): 20 points, `entityId` is the **store**, not the review row (`FR-12-04`, `AC-12-05`), gated by `BR-12-07` (approved, non-private store; authorship is not read) and by "the user already received a product from this store" (an existence check against delivered order items, no money read)
- the one secret medal shipping in phase 1: pick it from the FRD's three candidates (`midnight-order`, `same-day-settle`, `year-streak`) on evaluation cost; `year-streak` requires a 12-consecutive-month scan and is the most expensive, `midnight-order` is a single-row time check on `createOrder`, `same-day-settle` needs same-day cross-reference between an order's settlement and its delivery. Ship `midnight-order` (cheapest to evaluate, no cross-entity join) and record the choice in the ADR this slice writes, closing the FRD's open question
- `"Medallas"` album tab content (inside `WO-04`'s tab shell): one page per series, global counter (`"12 de 28"`), per-series counter, unlocked medals in colour, locked medals as silhouettes with hint, the secret medals as silhouettes with no hint and a neutral label (`FR-12-25`)
- medal detail subview `src/app/[locale]/(app)/progress/medals/[medalKey]/page.tsx`: name, series, rarity, condition text, hint, `publicSafe`, unlock date, `stateful` currency (`"vigente"` / `"ya no vigente"`) when it applies; back navigation returns to the album page with scroll position preserved (`FR-12-34`); unknown key resolves to 404
- `stateful` medal currency: a medal whose condition is a state, not an event, additionally computes and displays whether that state still holds, without ever revoking the unlock (`FR-12-23`, `BR-12-08`)
- i18n additions to `progress.json`: `medals.<key>.name`, `medals.<key>.hint`, `rarity.<level>` (five grades, reusing `ADR 0036`'s vocabulary)
- `ADR 0040`, medals granting no points and never being revoked (`FR-12-22`, `FR-12-23`, `BR-12-08`)
- PostHog events: `medal_album_viewed`, `medal_series_page_viewed` (carries `series`), `medal_detail_viewed` (carries `medal_key`, `rarity`, `unlocked`)
- unit tests for the evaluator (idempotency via the `(userId, medalKey)` unique constraint, `stateful` currency toggling without revocation) and the store-reviewed call site

## Out of Scope

- ~~the twelve phase-2 medals (future work order)~~ shipped by the catalogue v2 pass of 2026-08-26 instead of by a later work order, together with four new rows and one replacement; see `Implementation Notes`
- the unlock toast that renders a `medalsUnlocked` entry (belongs to `WO-06`)
- the `"% de coleccionistas que la tienen"` line (explicitly deferred per `FR-12-27`, not a phase-1 or phase-2 deliverable)
- the administration UI for time-limited events (explicitly out of scope for the whole FRD)

## Requirements

- `FR-12-04` (`store-reviewed` anchor and cap)
- `FR-12-20` (28-medal catalogue; this slice shipped the phase-1 12 and, after the catalogue v2 pass of 2026-08-26, all 28)
- `FR-12-21` (rarity via `ADR 0036`'s print-run metaphor; this slice wires the catalogue's `rarity` field to that vocabulary, the visual treatment itself is FDD-owned)
- `FR-12-22`, `FR-12-23` (no points from medals, never revoked, `stateful` currency)
- `FR-12-24` (`publicSafe` flag on every medal)
- `FR-12-25` (silhouette + hint for locked; no hint for the secret medal)
- `FR-12-26` (global and per-series counters)
- `FR-12-27` (medal detail view, percentage line deferred)
- `FR-12-28` (phase-3 columns present on every medal row, unused in phase 1)
- `FR-12-29` (toast queueing is `WO-06`'s concern; this slice only guarantees `evaluateUnlocks` returns a stable, ordered list so the queue has something deterministic to consume)
- `FR-12-34` (medal detail is a subview of `"Medallas"`, not a fourth tab, scroll position preserved)
- `BR-12-07` (store gating applies to `store-reviewed` identically to every other rule)
- `BR-12-08` (medals grant no points, never revoked)
- `BR-12-19` (glossary term discipline: "medal" never "badge"; already registered in `docs/product/glossary.md`, no action needed beyond using the registered terms)
- `BR-12-20` (event window absolute; modeled by `WO-01`, exercised here only by the accessor excluding closed-window medals from the merit-lock denominator, since no phase-1 medal actually carries a window)

## Blueprints

- [`BP-01`](../bp-01-collector-progression.md) — Risks: medal evaluation keyed off the same `entityType`/`entityId` shape the ledger uses, so idempotency is inherited rather than re-implemented per medal; the merit lock's live-recomputed denominator
- [ADR 0036](../../../../../design/decisions/0036-medal-rarity-visual-system.md) — the five-grade rarity vocabulary and its icon+label contract, already accepted; this slice's catalogue conforms to it, does not redefine it

## Evaluator Notes

- `evaluateUnlocks` takes the same idempotency shape the ledger already uses: `MedalUnlock`'s `@@unique([userId, medalKey])` means a re-evaluation of an already-unlocked medal is a no-op insert attempt, caught the same way `awardPoints` catches `P2002` (`WO-01`). No medal-specific "already have it" check needs writing by hand.
- Condition predicates read current state directly (order/delivery/review rows), never the point ledger, so a medal's condition and a rule's eligibility are independent checks over the same underlying facts, not two different sources of truth about the same event.
- `first-order-closed` ("one order fully paid and fully arrived") reads `openBalanceMinor(order) === 0` and every item `DELIVERED`; this is the one phase-1 medal condition that needs a money-adjacent boolean, so it goes through `WO-01`'s `moneyPredicateAdapter.ts` exactly like `order-settled` does, never a direct field read from the medal evaluator itself.

## Condition Computability

Verified line by line against `prisma/schema.prisma` and the current data layer. Eleven of the twelve phase-1 conditions evaluate cleanly against persisted, structured state with no schema gap:

- `first-order`, `first-payment`, `first-arrival`, `first-store`: existence/ordering checks over `Order`, `StorePayment`, `Delivery` rows scoped to `userId`, ordered by `createdAt`.
- `first-order-closed`: `openBalanceMinor(order) === 0` (via the adapter) plus every `OrderItem.deliveryState === "DELIVERED"` for the order's items.
- `first-review`: a `StoreReview` row exists for `(storeId, userId)` and at least one `OrderItem.deliveryState === "DELIVERED"` exists for an `Order` at that `storeId` for this user, the same anchor the `store-reviewed` point rule reads.
- `patience-60` / `patience-120` / `patience-200`: day-count between `Order.orderDate` and the order's completing `Delivery.receivedDate`.
- `split-arrival`: an order whose items resolve `DELIVERED` across more than one distinct `Delivery` id via the `DeliveryOrderItem` join.
- `midnight-order` (the phase-1 secret): the evaluator must read `Order.createdAt` (a real timestamp), never `Order.orderDate` (a civil day with no time component, `FR-08` convention shared with delivery dates), for the 00:00-04:00 civil-time window. `Order.createdAt` is stored as a UTC instant, so the check converts to the user's civil day/time the same way `FR-12-10`'s resolver does before comparing, never a raw UTC-hour comparison. The ADR this slice writes must record this explicitly, since a reviewer skimming for "order time" could otherwise reach for the wrong field.

`first-photo-order` is the one condition with **no dedicated persisted signal**. `Order` carries no `source`/`origin` column (confirmed absent from `model Order`). The only trace that an order came from image intake is the idempotency marker `saveOrderFromDraftAction` writes into `Order.note` (`[image-intake:<digest>]`, `src/app/[locale]/(app)/orders/_actions/imageIntakeSaveAction.ts:154`), the same marker-in-note pattern the chat importer already uses. `Order.note` is a private, user-editable field (`FR-05-21`, inline-editable from the order detail view), so re-scanning it at an arbitrary later recompute is not a reliable source of truth: a collector who edits that specific order's note afterward could make an as-yet-unwon medal permanently unreachable (an already-won `MedalUnlock` row is immutable and can never be revoked, `BR-12-08`, but a not-yet-evaluated win could be lost). The safe evaluation point is **at creation, inside the same request that just wrote the marker**: `saveOrderFromDraftAction` calls `createOrder`, one of `WO-02`'s `evaluateUnlocks` call sites, so the evaluator's context for that specific call already has the freshly created order's own `note` value in hand, before any edit could ever touch it. This slice's `first-photo-order` predicate must check the marker prefix only against the order object the current call site just wrote, never via a standalone `note LIKE '[image-intake:%'` scan across a user's order history at recompute time. This is documented as a named limitation in the ADR this slice writes: the condition is call-time-evaluated, not state-re-derivable, which is an exception to this module's general rule that "condition predicates read current state directly." The Notion backfill (`WO-06`) needs no special handling here: image intake postdates the migrated history, so no migrated order can ever satisfy this condition, and the backfill correctly evaluates it as unmet for every migrated order.

## Module Contract

| Path                                                         | Responsibility                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/data/progression/medalCatalogue.ts`                 | phase-1 catalogue (12 entries) + `evaluateUnlocks(userId, context)`, replacing `WO-01`'s stub; exports the merit-lock accessor below |
| `src/lib/data/progression/_tests/medalCatalogue.test.ts`     | evaluator unit tests: idempotency, `stateful` currency toggling, computability cases above                                           |
| `src/lib/data/stores/_tests/storeMutations.test.ts`          | extended with `store-reviewed` credit/medal call-site cases (existing test file, per current test layout)                            |
| `src/app/[locale]/(app)/progress/medals/[medalKey]/page.tsx` | medal detail subview; `notFound()` from `next/navigation` on an unknown key, matching the existing `orders/[id]/page.tsx` pattern    |
| `src/i18n/locales/{es,en}/progress.json`                     | `medals.<key>.name`, `medals.<key>.hint`, `rarity.<level>` (extends the namespace `WO-03` also writes to)                            |

`rankLadder.ts`'s merit-lock denominator (`WO-03`) calls a named accessor this slice exports from `medalCatalogue.ts`, rather than reaching into the catalogue array directly:

```ts
// excludes medals dependent on another user's action (store-mapped-1) and any event medal
// whose window has closed, per FR-12-17's denominator rule
function getMeritLockDenominator(unlockedMedalKeys: string[]): number;
```

This keeps `WO-03`'s statement ("must call a catalogue accessor, not hardcode 12") satisfied with a concrete function signature instead of an implied one.

## Security Notes

- Every route and query in this slice is scoped to the session `userId` with no user-id route parameter anywhere (`FR-12-18`, `BR-12-02`), consistent with the rest of `FRD-12`'s Screens and Data Contract; the medal detail page loads `getMedalDetail(medalKey, userId)`, never a bare `medalKey` lookup that could answer for another user's unlock state.
- `publicSafe` (`FR-12-24`) is captured on every catalogue entry but enforced nowhere in this slice, since nothing here renders a public surface; it exists purely as forward classification for a future surface that does not exist yet, so no additional access check is owed here beyond persisting the flag correctly.
- The `store-reviewed` call site inside `upsertStoreReview` (`src/lib/data/stores/storeMutations.ts:144`) must apply the `BR-12-07` gate (store not private, `APPROVED`) using data the mutation already loaded for its own authorization check, not a second query, mirroring the pattern `WO-02`'s call sites already establish for the same rule.
- `evaluateUnlocks`'s idempotency must follow `WO-01`'s `awardPoints` catch-`P2002` pattern against `MedalUnlock`'s `@@unique([userId, medalKey])`, never a `findFirst`-then-`create` (a TOCTOU race under a retried Server Action, the same class of bug `WO-01`'s Ledger Write Helper section calls out).
- `BR-12-01`'s static money guard (`src/test/progression-money-guard.test.ts`, `WO-01`) is scoped to `pointRules.ts` in its current definition. This slice extends the guard's scanned-file list to include `medalCatalogue.ts`, since `FRD-12`'s Implementation Notes describe the guard's purpose as covering "the rule catalogue" generally, not `pointRules.ts` specifically, and `first-order-closed`'s adapter-routed boolean is exactly the kind of money-adjacent condition the guard exists to keep honest as the catalogue grows in `WO-05`'s phase-2 follow-up.

## Assumptions

- `evaluateUnlocks` and the phase-1 rule call sites of `WO-02` run in the same request/transaction boundary already established there; this slice adds no new transaction shape, only new predicates evaluated inside the existing one.
- The medal detail route's scroll-position preservation on back navigation (`FR-12-34`) uses the app's existing back-navigation convention (browser history / `router.back()`) rather than a bespoke scroll-restoration mechanism, consistent with how other subview-to-list back links behave elsewhere in the app (`.agents/rules/ui-visual-consistency.mdc`).
- `rarity`'s five-level visual treatment (matte, gold corner seal, numbered border, animated iridescent ring, signature) is FDD-owned per `ADR 0036`; this slice wires the catalogue's `rarity` field to that vocabulary and does not redefine the visual system.
- The static guard extension (scanning `medalCatalogue.ts`) is additive to `WO-01`'s existing test file, not a new guard file, per this document's `docs-and-standards.mdc` preference for extending over duplicating.

## E2E Acceptance Tests

- Given a collector places their first order, logs their first payment, and receives their first delivery
- When each corresponding Server Action resolves
- Then `first-order`, `first-payment`, and `first-arrival` each unlock exactly once, each response's `medalsUnlocked` carries the newly unlocked medal, and re-triggering the same action a second time (e.g. a retried Server Action) unlocks nothing further

- Given a collector opens `"Medallas"` with nothing unlocked
- When the tab renders
- Then all 28 medals render as silhouettes, the four secret medals render with no hint and a neutral label, and the global counter reads `"0 de 28"` (before catalogue v2 this read `"0 de 12"` with the phase-2 twelve excluded from the counter)

- Given a delivery that took 65 days from order to arrival
- When the progression is recomputed
- Then `patience-60` unlocks and `patience-120` does not

- Given a `first-order-closed` medal whose triggering order later has a product returned to `ARRIVED_AT_STORE` via a delivery reopen
- When the album is opened
- Then the medal is still unlocked, in colour, and additionally shows `"ya no vigente"` (`AC-12-12`)

- Given a collector reviews a store from which they never received a product
- When the review is saved
- Then `store-reviewed` credits nothing and no medal in any series unlocks from it (`BR-12-07`)

- Given a collector opens a medal's detail page from the album
- When they navigate back
- Then they land on the same series page at the same scroll position, and requesting an unknown `medalKey` resolves to 404

## Unit Test Matrix

### `medalCatalogue.test.ts`

| Scenario                                                                            | Expected                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `evaluateUnlocks` for a user with a first order, first payment, first arrival       | Returns `first-order`, `first-payment`, `first-arrival`            |
| `evaluateUnlocks` called twice for an already-unlocked medal                        | Second call returns no duplicate, no thrown error (`P2002` caught) |
| `first-order-closed` when `openBalanceMinor > 0`                                    | Not unlocked                                                       |
| `first-order-closed` when balance is `0` and one item is not `DELIVERED`            | Not unlocked                                                       |
| `first-order-closed` when balance is `0` and every item is `DELIVERED`              | Unlocked                                                           |
| `stateful` medal whose condition stops holding after unlock                         | Still `unlocked`, `isCurrentlyValid: false` (`"ya no vigente"`)    |
| `patience-60` for a 59-day delivery                                                 | Not unlocked                                                       |
| `patience-60` for a 60-day delivery                                                 | Unlocked                                                           |
| `patience-120` for a 65-day delivery                                                | Not unlocked                                                       |
| `split-arrival` for an order fully covered by one delivery                          | Not unlocked                                                       |
| `split-arrival` for an order covered by two deliveries                              | Unlocked                                                           |
| `midnight-order` for an order created at 03:59 civil time                           | Unlocked                                                           |
| `midnight-order` for an order created at 04:01 civil time                           | Not unlocked                                                       |
| `first-photo-order` when the call-site context carries the image-intake note marker | Unlocked                                                           |
| `first-photo-order` when the order's note is later edited after unlock              | Still `unlocked` (immutable `MedalUnlock` row, never re-derived)   |
| `getMeritLockDenominator` excluding `store-mapped-1`-class and closed-window medals | Returns the shipped count minus excluded medals; since catalogue v2 nothing is excluded, so the case guards the accessor for a future event medal |
| Store private, `PENDING` or `REJECTED`                                              | No medal in any series unlocks (`BR-12-07`)                        |
| Store `APPROVED` and public, registered by the collector themselves                 | Medals unlock normally (`BR-12-07`, amended 2026-08-23)            |

### `storeMutations.test.ts` (extended)

| Scenario                                                            | Expected                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Review a store the user received a product from                     | `store-reviewed` credits 20 points, medal evaluator runs   |
| Review a store the user never received a product from               | No credit, no medal evaluation (`BR-12-07`)                |
| Review the same store a second time after deleting the first review | Credits exactly once (`entityId` is the store, `AC-12-05`) |

## Implementation Notes

Recorded during implementation (2026-08-23). Each item is a deliberate departure from, or a decision
inside, the scope above.

- **The evaluator is split in two, because the money guard forbids the catalogue any import at all.**
  `src/test/progression-money-guard.test.ts` already listed `medalCatalogue.ts` with an EMPTY import
  allowlist, so a DB-reading `evaluateUnlocks` could not live there. `medalCatalogue.ts` stays a pure
  leaf (catalogue rows, `selectUnlockedMedals`, `getShippedMedalCount`, `getMeritLockDenominator`,
  `resolveConditionsToEvaluate`), declaring each medal's condition BY KEY exactly as `pointRules.ts`
  does; `src/lib/data/progression/medalEvaluation.ts` owns one resolver per key plus
  `evaluateUnlocks` and `resolveStatefulMedalCurrency`. The guard's scanned list is extended to
  include `medalEvaluation.ts` with an explicit import allowlist, which is what this work order's
  Security Notes asked for (`medalCatalogue.ts` was already on the list).
- **The catalogue carries all 24 medals, not 12.** `FR-12-20` requires the phase-2 twelve to "stay
  visible as silhouettes so half the album reads as a promise". They are catalogued with
  `phase: 2`, are never evaluated, never offered by the evaluator, and are excluded from every
  counter, so the album's counters read `"N de 12"` per this work order's own E2E test while the
  grid still shows twenty-four pieces. A phase-2 card reads `"Próximamente"` rather than
  `"Cómo conseguirla"`, since an instruction the collector cannot follow is not a hint.
  **Superseded 2026-08-26 by the catalogue v2 pass below**: nothing is catalogued as `phase: 2` any
  more, so no counter excludes a row and no card reads `"Próximamente"`.
- **Catalogue v2: all 28 medals ship (2026-08-26).** Approved from
  [`medal-catalogue-v2.md`](../../medal-catalogue-v2.md), which verified condition by condition that
  every deferred row was already resolvable against the schema as it stood: the phase-2 deferral was
  an ordering decision taken on evaluation cost, not a capability gap (`ADR 0040`, amended the same
  day). What landed:
  - the twelve `phase: 2` rows became shipped and evaluable, and `La vitrina`, `Explorador`,
    `Cronista` and `Secretas` are awardable pages rather than promises;
  - `store-mapped-1` was replaced by `store-charted-1` (`STORE_APPROVED_1`), because it was the one
    row the collector could not control on their own; its resolver reuses the same creditable-store
    gate every other medal query applies (`APPROVED`, public, not private, `BR-12-07`), which is
    stricter than approval alone and is the honest reading of "on the shared map";
  - four rows were added, `first-preorder`, `countries-3`, `reviews-5` and `swift-arrival`, so every
    series holds at least four pieces and `Primeros pasos` fills both of its rows at eight;
  - `first-store` stopped resolving `ANY_ORDER` (the same condition as `first-order`, so two pieces
    unlocked from one click) and now resolves an order at a SECOND distinct store;
  - `first-order-closed` and `clean-record-10` each rose one rarity level, giving a print-run spread
    of 10 normal, 7 primera edición, 5 limitada, 5 holográfica, 1 firmada;
  - `getMeritLockDenominator` moved from 12 to 28 with nothing excluded, so ranks 9 and 10 now ask
    for 13 and 17 medals (`FR-12-17`). That is the intended effect of shipping the album: the gate
    was written as a fraction precisely so the catalogue could grow under it.
- **`store-reviewed` did not exist as a point rule and was added here.** `FR-12-04` lists it as a
  phase-2 rule, but this work order scopes its call site, so `pointRules.ts` gains the rule (20
  points, 60 pts/month, `entityType: store`) plus a new `store-product-received` condition the
  recompute resolves per store. `upsertStoreReview` widens its existing store lookup to
  `STORE_CREDIT_ELIGIBILITY_SELECT` (no second query) and credits after its last refusal, inside
  its own transaction; `settleProgression` runs after the commit, as at every other call site.
- **`MedalUnlockSummary` dropped its `name` field**, and the blueprint's contract was amended in the
  same change. The credit path runs inside a mutation with no locale, so a name resolved there
  would be a hardcoded user-facing string; the client reads `progress.medals.<medalKey>.name`.
- **Same-response unlocks ride the recompute `settleProgression` already runs.** No second
  evaluation pass was added. One consequence, stated so it is not read as a bug: when a mutation
  appends no ledger row at all (`credited === 0`, i.e. the store gate refused or every entry was a
  duplicate), `settleProgression` short-circuits and a medal that turned true through some other
  path is picked up by the next recompute rather than by that response.
- **Route shape.** `WO-04`'s `/progress` landing page and its three-tab shell do not exist yet, so
  this slice ships the album at `src/app/[locale]/(app)/progress/medals/page.tsx`, the detail at
  `.../medals/[medalKey]/page.tsx`, and a minimal `progress/layout.tsx` holding only the section's
  vertical rhythm. `WO-04` fills that layout with the tab chrome and the `hideProgression` gate.
- **One page per series is one SECTION per series on the album page**, not one route per series,
  matching the prototype's stacked pages. `medal_series_page_viewed` is therefore not shipped;
  `medal_album_viewed` and `medal_detail_viewed` are. Owner-confirmed narrowing.
- **`--rarity-*` is now declared in `src/app/globals.css`**, verbatim from `tokens-css.md` §12.1,
  because the album cannot render without it. `WO-04` still owes `--rank-band-*`.
  `tokens-css.md`, `visual-foundations.md` and `ADR 0036` were updated to say so.
- **Medal artwork shipped as one sober placeholder for all 24 pieces at this slice's completion**
  (owner decision): a plate, a ring in the medal's own rarity token, and a generic medal glyph,
  with `data-medal="<medalKey>"` on the figure. `MedalDefinition.imageKey` plus
  `resolveMedalArtSrc` in `MedalStage.tsx` are the single substitution point, so real artwork
  lands by dropping files into `public/medals/` and filling in one field per catalogue row; that
  substitution happened for all 24 medals on 2026-08-24, per `medal-art-guide.md` §5, and the art
  was relanguaged and regrown to 28 pieces by catalogue v2 (`medal-catalogue-v2.md` §2, §3, §3a);
  publishing those files into `public/medals/` is tracked separately from this work order. The
  per-grade seal glyph of `FDD-12 §3.1` remains deferred; the always-present `RarityChip` text
  label already satisfies `ADR 0006`.
- **The `"% de coleccionistas"` block renders switched off** with the honesty copy, rather than
  being omitted. Owner decision; `FDD-12 §2.6` was amended in the same change.
- New components registered in `docs/design/components.md`: `RarityChip` and `MedalStage` (Tier 1),
  `MedalCard` (Tier 2), including the locked-art recipe as its own pattern.
