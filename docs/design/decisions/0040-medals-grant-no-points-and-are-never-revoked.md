---
title: "ADR 0040 - Medals grant no points, are never revoked, and the one condition that cannot be re-derived is evaluated at its call site"
date: 2026-08-23
status: accepted
session: collector-progression medal album implementation (FRD-12, WO-05, 2026-08-23)
owner: Sergio Minei
trigger: FRD-12 ships a 24-medal album alongside a point ledger, and the two systems meet at the same call sites; without a decision on record, the obvious next step for any later contributor is to let a medal pay out points "because it is an achievement", and the obvious next step for any later refactor is to recompute a medal's state and drop the unlock when the state stops holding, both of which would quietly change what the product rewards
updates: docs/product/prd-02-collector-app/frd-12-collector-progression/frd-12-collector-progression.md
extends: ADR 0035 (collector progression point ledger), ADR 0036 (medal rarity visual system), ADR 0038 (permanent rank and merit lock)
---

# ADR 0040 - Medals grant no points, are never revoked, and the one condition that cannot be re-derived is evaluated at its call site

## Context

`FRD-12` puts two reward systems in the same feature and wires them into the same mutations. Points are a derived balance: every ledger entry is re-examined against the current state of the row it names, and an entry that stops passing simply stops counting (`ADR 0035`). Medals are the opposite kind of object: a record that a collector once reached something.

Three questions had to be settled before the catalogue could ship, because in each case the intuitive answer is the wrong one and would only be discovered as a complaint months later.

1. **Should a medal be worth points?** Every reward system the collector has seen elsewhere pays out for an achievement, so the absence has to be a written decision rather than an omission somebody "fixes".
2. **What happens when a medal's condition stops holding?** `first-order-closed` means "one order fully paid and fully arrived". Reopen a delivery and that order is no longer closed. The recompute's own instinct, applied to medals, would withdraw the medal.
3. **How is a condition evaluated when the fact it depends on is not reliably stored?** Eleven of the twelve phase-1 conditions read persisted, structured state. `first-photo-order` ("created an order from an image") does not: `Order` carries no `source` column, and the only trace is the `[image-intake:<digest>]` marker that `saveOrderFromDraftAction` writes into `Order.note`, a private field the collector can edit afterwards.

A fourth, smaller question came with the catalogue: `FRD-12` left open which of the three secret medals ships in phase 1.

## Decision

### 1. Medals grant no points (`FR-12-22`, `BR-12-08`)

A medal never appears in the ledger as a `ruleKey`, never carries a point value, and never moves a rank threshold. `medalCatalogue.ts` has no `points` field and no `ruleKey` field on any row, and the medal evaluator touches no ledger table in either direction.

The reason is the same one behind the whole progression feature's money guard. Points measure recordkeeping and are capped per month precisely so the total tracks discipline rather than volume. A medal is awarded for a milestone, and a milestone that also paid points would be an uncapped, unbounded bonus riding on top of a carefully calibrated curve: the rank thresholds of `FR-12-14` are fitted to 210 points a month, and twelve medals paying out would move a collector up the ladder for reasons the curve was never calibrated against. Keeping medals as status only is what lets the two systems ship in one feature without either one distorting the other.

### 2. A medal, once unlocked, is never revoked (`FR-12-23`, `BR-12-08`, `AC-12-12`)

A `MedalUnlock` row is immutable. Nothing in the codebase deletes one, and the evaluator only ever inserts.

Medals whose condition is a STATE rather than an EVENT are marked `stateful` in the catalogue. Those recompute whether the state still holds and display `"vigente"` or `"ya no vigente"`, in full colour, alongside the unlock they keep. The album records that the collector reached it, not that they still hold it.

The alternative, withdrawing the medal, makes the album a live dashboard of the current collection rather than a history of it, and turns an ordinary correction (reopening a delivery that was marked received too early) into a punishment. It would also make the merit lock of `ADR 0038` non-monotonic: a collector could be demoted from rank 9 by fixing a mistake in their own records.

### 3. `first-photo-order` is evaluated at its call site, not re-derived (documented exception)

This module's general rule is that condition predicates read current state directly. `first-photo-order` is the one exception, and it is deliberate.

The evaluator accepts a call-time `context` carrying the note of the order the CURRENT request just wrote, and the predicate checks the marker prefix only against that value. It never scans a collector's order history for `note LIKE '[image-intake:%'`. `saveOrderFromDraftAction` calls `createOrder`, which is already one of the evaluator's call sites, so the freshly written note is in hand before any edit could touch it.

Re-scanning notes at an arbitrary later recompute would be unsound in one direction that matters: an already-written unlock can never be revoked, but a not-yet-evaluated win could be LOST by a collector editing that specific order's note. The consequence, stated plainly so nobody treats it as a bug: the medal is not recoverable by a later recompute. A collector whose very first image-intake order was created while the credit path was failing does not get it retroactively, and that is the price of not making the medal depend on a field the collector is free to rewrite.

The Notion backfill needs no special handling: image intake postdates the migrated history, so no migrated order can satisfy this condition, and the backfill correctly evaluates it as unmet.

### 4. `midnight-order` is the secret medal shipping in phase 1

Chosen on evaluation cost, closing `FRD-12`'s open question. `midnight-order` is a single-column read over orders the query already filters; `same-day-settle` needs a cross-entity join between an order's settlement and its delivery; `year-streak` needs a twelve-consecutive-month scan. The choice changes no rule: all three remain in the catalogue as phase-2 silhouettes with no hint.

One implementation constraint is recorded here because a reviewer skimming for "order time" would reach for the wrong field. The check must read `Order.createdAt`, a real instant, never `Order.orderDate`, which is a civil day pinned to UTC midnight with no time component at all. `createdAt` is stored as a UTC instant, so it is converted to the collector's civil hour through `User.timezone` before being compared against the 00:00 to 04:00 window. A raw UTC-hour comparison would credit collectors in one part of the world and never credit the ones the feature was written for.

> **Amended 2026-08-26 (medal catalogue v2).** The phase split this decision reasoned about is gone: the album now ships **28 medals, all of them shipped and evaluable**, and nothing is catalogued as a later phase. The correction worth recording is about the argument, not the outcome. Choosing `midnight-order` on evaluation COST was a decision about ORDERING, never about capability: the review that produced `docs/product/prd-02-collector-app/frd-12-collector-progression/medal-catalogue-v2.md` §4 walked every deferred condition against the schema as it stood and found each one resolvable with the tables already in place, most of them in a single query, and `same-day-settle` and `swift-arrival` on joins the recompute already loads. So "cheaper to evaluate first" was the right way to sequence a slice and would have been the wrong way to read this ADR, as if the other conditions were waiting on data the product did not have. They were not. The decisions this note does **not** touch: medals still grant no points, an unlock is still never revoked, and `first-photo-order` is still evaluated at its call site rather than re-derived. Two consequential follow-ons from the same pass, recorded here because they land on this ADR's neighbours: `store-mapped-1` was replaced by `store-charted-1`, which removes the catalogue's only `controllable: false` row and therefore the only exclusion the merit-lock denominator of [ADR 0038](0038-permanent-rank-and-merit-lock.md) had to apply, moving that denominator from 12 to 28 (ranks 9 and 10 now ask for 13 and 17 medals); and the artwork moved off the rarity-by-drawing-style language into one painted style for all 28, with rarity carried by frame metal, a bounded piece count and light level, which is a change to the ART and not to the five-grade vocabulary [ADR 0036](0036-medal-rarity-visual-system.md) fixed.

## Alternatives considered

**Medals pay a small, capped bonus.** Rejected: any bonus at all makes the medal catalogue part of the point economy, which means every future medal has to be priced against the rank curve, and the "no points" line on the detail view (`"Las medallas no dan puntos y no se revocan."`) is what makes the album legible as status rather than as currency.

**Revoke a stateful medal when its condition stops holding.** Rejected under decision 2 above. The `"ya no vigente"` line gives the honest reading without the punishment.

**Add an `Order.source` column so `first-photo-order` becomes re-derivable.** A real option, and the right one eventually. Rejected for this slice as a schema change well outside a work order whose scope is the album, and because the marker-in-note pattern is already shared with the chat importer: introducing a column for one medal, while the importer keeps using the note, would leave two answers to "where did this order come from". When a future slice does add that column, this exception should be retired.

**Ship `year-streak` as the phase-1 secret.** Rejected on cost: a twelve-month scan on every evaluation, for a medal almost nobody can hold in the product's first year.

## Consequences

### Positive

- The point economy stays exactly as calibrated: adding a medal costs nothing in the ledger and cannot move a rank threshold.
- Medal evaluation inherits the ledger's idempotency instead of re-implementing it: `MedalUnlock`'s `@@unique([userId, medalKey])` makes a re-evaluation of a held medal a no-op insert, caught the same way `awardPoints` catches `P2002`.
- The album is stable to read: nothing a collector sees there can disappear because they corrected a record.
- The evaluator gets cheaper as the album fills, since a condition behind a medal already held is not queried at all unless that medal is `stateful`.

### Negative / tradeoffs

- `first-photo-order` is not recoverable by recompute, which is a genuine asymmetry with the other eleven conditions and has to stay documented for as long as it is true.
- A `stateful` medal now needs its condition re-resolved on every album read, which is a query the other medals do not cost. Both phase-1 stateful conditions were kept to a single indexed existence check for that reason.
- "Never revoked" means a medal awarded through a bug stays awarded. The correction path is an administrative one, not an automatic one.

## References

- `FR-12-20` through `FR-12-29`, `FR-12-34`, `BR-12-07`, `BR-12-08`, `BR-12-20`, `AC-12-05`, `AC-12-12` in `docs/product/prd-02-collector-app/frd-12-collector-progression/frd-12-collector-progression.md`
- [ADR 0035](0035-collector-progression-point-ledger.md) - derived balance, never negative entries
- [ADR 0036](0036-medal-rarity-visual-system.md) - the five-grade rarity vocabulary and its icon+label contract
- [ADR 0038](0038-permanent-rank-and-merit-lock.md) - the merit lock this decision keeps monotonic
- `docs/product/prd-02-collector-app/frd-12-collector-progression/medal-catalogue-v2.md` - the approved catalogue v2 pass this ADR is amended by (2026-08-26)
- `src/lib/data/progression/medalCatalogue.ts`, `src/lib/data/progression/medalEvaluation.ts`
