---
title: "ADR 0038 - The highest rank reached is permanent, and ranks 9-10 additionally require a merit lock expressed as a percentage of the shipped medal catalogue"
date: 2026-08-23
status: accepted
session: collector-progression rank ladder implementation (FRD-12, WO-03, 2026-08-23)
owner: Sergio Minei
trigger: FRD-12's rank ladder derives a collector's rank from their current matured point total, a total that can fall (an order gets deleted, an entity becomes ineligible), and the two possible responses, a title that moves with the total versus a title that only ever climbs, produce very different products; separately, the two highest ranks needed a gate beyond a raw point threshold so they stay meaningful as the medal catalogue itself grows across phases
updates: docs/product/prd-02-collector-app/frd-12-collector-progression/frd-12-collector-progression.md
extends: ADR 0035 (collector progression point ledger: derived balance, never negative entries)
---

# ADR 0038 - The highest rank reached is permanent, and ranks 9-10 additionally require a merit lock expressed as a percentage of the shipped medal catalogue

## Context

`rankLadder.ts` derives a rank index from a collector's current matured point total (`FR-12-14`). That total is not monotonic: `ADR 0035` already establishes that the point ledger's derived balance can fall when an order is deleted or an entity becomes ineligible, by design. A rank ladder built directly on top of a balance that can fall inherits the same property unless a second decision fixes it: does the collector's title fall with the number, or does it not?

Separately, the two highest ranks (`collection-shisho` at rank 9, `guild-legend` at rank 10) sit at the top of a curve calibrated so reaching rank 10 on points alone takes roughly forty-five months of steady recordkeeping (`FR-12-14`). A collector who orders steadily but never opens the medal album would still reach those thresholds on points, which does not match what the two top ranks are meant to signal: not just volume, but engagement with the collection as a whole. The medal catalogue itself is not static either; it ships twelve medals in phase 1 and is planned to grow to twenty-four in phase 2, so any gate tied to "how many medals" rather than "what share of the medals" would silently get harder to clear as the catalogue grows, which is not a property anyone approved.

Both decisions were already settled in the FRD (`FR-12-16`, `FR-12-17`, `BR-12-06`) before this slice; this ADR records them as the FRD approved them, rather than re-deciding either one, so the reasoning has a permanent home next to the code that implements it.

## Decision

### 1. The highest rank reached is permanent (`FR-12-16`, `BR-12-06`)

`UserProgress.highestRankIndex` is a running maximum, never a direct reflection of the current point total. `recompute.ts` computes `currentRankIndex` from `rankLadder.deriveRank(...)` on every run, then stores `Math.max(existingHighestRankIndex, currentRankIndex)`. A collector whose derived total falls after a deletion keeps their title; only the progress bar inside the current band moves backwards, never the name or the position ("Rango N de 10") shown on every surface.

`rankLadder.ts` itself has no notion of "highest": `deriveRank` is a pure function of the current total and the two album counters, returning only the rank that total resolves to right now. The permanence rule lives entirely in `recompute.ts`, the one place that reads and writes the stored highest value, so there is exactly one place in the codebase that could get the never-decreases invariant wrong.

### 2. Ranks 9 and 10 additionally require a merit lock, expressed as a percentage of the shipped catalogue (`FR-12-17`)

Reaching rank 9's or rank 10's point threshold is necessary but not sufficient. Rank 9 additionally requires the collector to have unlocked **45%** of the medals shipped in the current build; rank 10 requires **60%**. The denominator is `medalCatalogue.getShippedMedalCount()`, read at evaluation time rather than cached, so the percentage is measured against the catalogue as it exists today, not as it existed when the collector first crossed the threshold. This is what keeps the gate reachable as the catalogue grows from twelve medals in phase 1 to twenty-four in phase 2: a fixed count would get harder to clear over time for reasons the collector did not cause, a fixed percentage does not.

A collector who has the points for rank 9 or 10 but not the required album share sits at the highest rank whose threshold **and** merit lock are both satisfied, never at a half state: `rankLadder.deriveRank` walks back down from the points-only target rank until it finds one whose gate is actually clear. The lock is visible from rank 6 onward so it is never a surprise revealed only at the moment the collector would otherwise cross the line (`FR-12-17`).

## Alternatives considered

1. **A rank that moves with the current total, up or down.**

- Pros: simplest possible model, one derivation, no stored "highest" to keep in sync.
- Cons: a collector who deletes one old order (a correction, a duplicate, a mistake) could see their title downgraded for a moment they did nothing wrong in; a title that can be taken away reads as a penalty, not a record of what was reached.
- Why not chosen: `FR-12-16` and `BR-12-06` require permanence explicitly; a moving title is the opposite of the reward the FRD calibrated the ladder to be.

2. **A merit lock expressed as a raw medal count instead of a percentage.**

- Pros: simpler to compute, no division, no zero-denominator case to guard.
- Cons: a fixed count set against a twelve-medal catalogue would need to be manually recalibrated the moment phase 2 ships twelve more medals, or it silently gets easier (a fixed low count against a bigger album) or the product has to remember to bump it (and might not, leaving it stale).
- Why not chosen: `FR-12-17` already specifies the lock as a percentage for exactly this reason; the blueprint's own Risks section calls out that the denominator "can move underneath a collector" as the catalogue grows and requires it to be recomputed at read time rather than cached.

3. **A merit lock counting all shipped medals, including ones the collector cannot control.**

- Pros: one less exclusion rule to implement and explain.
- Cons: a medal that depends on another user's action, or an event medal whose window already closed, could make the top two ranks unreachable for a collector who did everything the game asks of them, through no fault of their own.
- Why not chosen: `FR-12-17` excludes both cases explicitly from the denominator; `medalCatalogue.getShippedMedalCount()` owns that exclusion so `rankLadder.ts` never has to special-case it.

## Consequences

### Positive

- A collector's title is a record of what they reached, never a number that can be quietly taken back by an unrelated correction elsewhere in the app; this keeps `ADR 0035`'s "the ledger can fall" property from ever surfacing as a visible downgrade.
- The merit lock stays meaningful and reachable across catalogue growth without a manual recalibration step, because the fraction is fixed and the denominator is read live.
- `rankLadder.ts` stays a pure, dependency-free leaf module (per the money guard already scanning it): permanence lives in `recompute.ts`, the merit lock's denominator arrives as a plain number the caller already resolved, and neither concern leaks into the other.

### Negative / tradeoffs

- Two numbers now have to be reasoned about together (`currentRankIndex` and `highestRankIndex`), and every surface that names a rank must be careful to always read the highest, never the current; a UI that reads the wrong one would visibly (and wrongly) downgrade a collector.
- The merit lock adds a second gate on top of the point threshold for exactly two ranks, which is one more rule a future contributor has to remember when reasoning about "why is this collector not at rank 9 yet" (the answer might be the album, not the points).

## References

- [ADR 0035 - Collector progression point ledger](0035-collector-progression-point-ledger.md)
- [ADR 0036 - Medal rarity visual system](0036-medal-rarity-visual-system.md)
- `docs/product/prd-02-collector-app/frd-12-collector-progression/frd-12-collector-progression.md` (`FR-12-14`, `FR-12-16`, `FR-12-17`, `BR-12-06`)
- `docs/product/prd-02-collector-app/frd-12-collector-progression/bp-01-collector-progression/bp-01-collector-progression.md` (Risks: the merit lock's denominator can move underneath a collector)
- `src/lib/data/progression/rankLadder.ts`
