---
id: WO-03
type: WORK_ORDER
slug: rank-ladder
title: Rank Ladder
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0021
source_issue: 142
implementation_status: IN_PROGRESS
last_updated: 2026-08-23
---

# WO-03 Rank Ladder

## Summary

Ship the ten-rank ladder: the threshold constant, the `rankLadder.ts` module the recompute already calls as a stub (from [`WO-01`](wo-01-progression-engine-foundation.md)), the merit-lock check for ranks 9-10, and the `es`/`en` i18n for every rank name and lore line. Writes the ADR for the permanent rank and the merit lock.

## In Scope

- `src/lib/data/progression/rankLadder.ts`: the ten-entry threshold table computed from `pointsForRank(n) = round(200 * (n - 1) ^ 1.75 / 10) * 10`, and `deriveRank(maturedPoints, shippedMedalCount, unlockedMedalCount): { currentRankIndex, meritLockSatisfied }`
- replacing `WO-01`'s recompute stub call to `rankLadder.deriveRank` with the real implementation; no change to `recompute.ts`'s control flow
- the merit-lock formula: 45% of the shipped medal catalogue for rank 9, 60% for rank 10, denominator computed at read time from `medalCatalogue.ts`'s shipped-count (stubbed to phase-1's 12 until `WO-05` ships; `rankLadder.ts` must call a catalogue accessor, not hardcode 12, so it self-corrects when `WO-05` lands)
- `highestRankIndex` never-decreases enforcement lives in `WO-01`'s recompute already; this slice supplies the correct `currentRankIndex` input it compares against
- once-per-rank celebration guard: `deriveRank`'s result is compared against `ProgressionSettings.lastCelebratedRankIndex` by the caller (the UI slices), not by this module; this slice only guarantees `currentRankIndex`/`highestRankIndex` are stable and correct so that comparison is meaningful
- i18n namespace `src/i18n/locales/{es,en}/progress.json`, keys `ranks.<rankKey>.name`, `ranks.<rankKey>.lore`, `ranks.<rankKey>.threshold` is a number, not a translated string
- `ADR 0038`, the permanent rank and the merit lock (`FR-12-16`, `FR-12-17`, `BR-12-06`)
- unit tests for the threshold formula (strictly increasing), `deriveRank`'s merit-lock gating at ranks 9-10, and the never-decreases property under a falling `maturedPoints`

## Out of Scope

- the "Rangos" tab UI and the ladder visualization (belongs to `WO-04`)
- the dashboard widget's rank strip (belongs to `WO-04`)
- the rank-up celebration modal itself (belongs to `WO-06`)
- phase 2's `I`/`II`/`III` grade subdivision (future work order, per `BP-01` Extension Points)

## Requirements

- `FR-12-14` (ten ranks, the threshold formula, the names/lore table as approved in the FRD)
- `FR-12-15` (every surface prints `"Rango N de 10"`, enforced here as a stable index the UI slices consume, not rendered by this slice)
- `FR-12-16` (permanent highest rank)
- `FR-12-17` (merit lock, ranks 9-10, visible from rank 6, denominator excludes event medals whose window closed and medals dependent on another user's action)
- `FR-12-18` (rank visible only to its owner, enforced by every query in this domain already being scoped to `userId`; no new enforcement needed here, restated for completeness)
- `BR-12-06` (highest rank index never decreases)

## Blueprints

- [`BP-01`](../bp-01-collector-progression.md) — Architecture Decisions on the permanent-rank ADR and the merit-lock's live-recomputed denominator (Risks)

## Threshold Table

| #   | `rankKey`                | Threshold |
| --- | ------------------------ | --------- |
| 1   | `kohai`                  | 0         |
| 2   | `preorder-hunter`        | 200       |
| 3   | `volume-keeper`          | 670       |
| 4   | `guild-senpai`           | 1,370     |
| 5   | `first-print-hunter`     | 2,260     |
| 6   | `limited-run-curator`    | 3,340     |
| 7   | `club-sensei`            | 4,600     |
| 8   | `rare-edition-archivist` | 6,020     |
| 9   | `collection-shisho`      | 7,610     |
| 10  | `guild-legend`           | 9,350     |

Values are the FRD's approved figures (`FR-12-14`), computed here from the formula and asserted equal to this table in a unit test, so a future recalibration of the formula's constants is caught if it silently drifts from the approved numbers without an explicit FRD amendment.

## Merit Lock

```ts
function isMeritLockSatisfied(rankIndex: 9 | 10, unlockedMedalCount: number, shippedMedalCount: number): boolean {
  const requiredFraction = rankIndex === 9 ? 0.45 : 0.6;
  return unlockedMedalCount / shippedMedalCount >= requiredFraction;
}
```

`shippedMedalCount` excludes medals the collector cannot control by construction (a medal dependent on another user's action such as `store-mapped-1`, and any event medal whose window has closed) [superseded 2026-08-26: `store-mapped-1` was replaced by the controllable `store-charted-1`, so the accessor excludes nothing today and the denominator is the full 28; the exclusion contract itself still stands for a future event medal, see [`WO-05`](wo-05-medal-album.md)] — `medalCatalogue.ts`'s accessor (from `WO-05`) is responsible for that exclusion; `rankLadder.ts` only calls it and applies the fraction. A collector who has the points for rank 9/10 but not the album sits at the highest rank whose threshold and merit lock are both satisfied, with the lock counter shown for the next one, never at a half state (State Model, `FRD-12`).

## Technical Notes

- `rankLadder.ts` exports `pointsForRank(n: number): number` (the formula), a derived `RANK_LADDER` constant (the ten `{ rankKey, threshold }` entries generated from `pointsForRank` and asserted equal to the Threshold Table above in a unit test, so a future constant drift is caught without an explicit FRD amendment), `deriveRank(maturedPoints, shippedMedalCount, unlockedMedalCount): { currentRankIndex, meritLockSatisfied }`, and `isMeritLockSatisfied` (exported for the unit test, not consumed outside this module).
- `deriveRank` reads the merit lock's denominator from `medalCatalogue.getShippedMedalCount()`; it must never accept the count as a caller-supplied parameter and never hardcode `12`. `WO-01` already ships `src/lib/data/progression/medalCatalogue.ts` as a stub module (see its Module Structure table entry: "stub in this slice; real content in `WO-05`") whose stub returns `12`. This slice depends only on that stub existing with a `getShippedMedalCount(): number` export, not on `WO-05` having landed, since `BP-01`'s Implementation Plan allows `WO-03` to ship in parallel with `WO-05`.
- `WO-01`'s `recompute.ts` already calls `rankLadder.deriveRank` as an injected, swappable function so its own recompute tests do not depend on this slice landing first (`BP-01` Architecture Decisions; `wo-01-progression-engine-foundation.md` Module Structure notes). This slice replaces `rankLadder.ts`'s stub body only; `recompute.ts`'s call site, argument order, and control flow are unchanged.
- The `highestRankIndex` comparison and never-decreases enforcement stay in `recompute.ts` (`WO-01`). This module returns only the current-total-derived `currentRankIndex` for a given input; it never reads or writes `ProgressionSettings.lastCelebratedRankIndex` or any stored highest value.

## Security Notes

- `rankLadder.ts` is a pure module: `deriveRank` takes numeric aggregates (`maturedPoints`, `shippedMedalCount`, `unlockedMedalCount`) and returns a derived index, with no `userId` parameter and no direct database access. `FR-12-18`'s per-user scoping is enforced entirely by the caller (`recompute.ts`, already `userId`-scoped per `WO-01`); this module has nothing to enforce on its own, restated here so a reviewer does not go looking for a missing auth check in a module that cannot leak across users by construction.
- `medalCatalogue.getShippedMedalCount()` reads the global catalogue definition (a static list of medal types), never a per-user unlock count, so it carries no cross-user data exposure risk.

## Assumptions

- `ADR 0038` is authored by this slice, continuing `BP-01`'s numbering plan from `0036`, and documents the permanent-rank and merit-lock decisions already settled by `FR-12-16`/`FR-12-17`/`BR-12-06`. The ADR restates the approved decision rather than re-deciding it, since the FRD's numbers are already approved.
- `src/i18n/locales/{es,en}/progress.json` does not exist yet; this slice creates the file and seeds only the `ranks.*` keys it needs (`ranks.<rankKey>.name`, `ranks.<rankKey>.lore`, `ranks.<rankKey>.threshold`). Later slices (`WO-04` onward) extend the same file rather than opening a second progression namespace, per `.agents/rules/next-intl-translation-apis.mdc` and the existing one-namespace-per-domain convention (`deliveries.json`, `orders.json`, etc.).
- `rankKey` values are the ten slugs in the Threshold Table (`kohai` through `guild-legend`), used as stable translation keys and future analytics props; they are never the source of the displayed rank name, which always comes from the `ranks.<rankKey>.name` translation.

## E2E Acceptance Tests

- Given the ten thresholds computed from the formula
- When compared against the table above
- Then they match exactly and are strictly increasing (`AC-12-10`)

- Given a collector whose `maturedPoints` falls below their current rank's threshold after a deletion
- When `recomputeUserProgress` runs
- Then `rankIndex` (current) may drop but `highestRankIndex` does not, and the UI-facing name is always the one at `highestRankIndex` (`AC-12-10`, `BR-12-06`)

- Given a collector with enough points for rank 9 but fewer than 45% of the shipped medals unlocked
- When the rank is derived
- Then `currentRankIndex` stays at rank 8 and `meritLockSatisfied` is `false`, with the unlocked/shipped counts available for the UI's `"Llevas N de M"` copy

## Unit Test Matrix

### `rankLadder.test.ts`

| Scenario                                                                             | Expected                                                                                     |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `pointsForRank(1)` through `pointsForRank(10)`                                       | matches the Threshold Table exactly, strictly increasing                                     |
| `deriveRank` at rank 5's threshold (below rank 6, no lock)                           | `currentRankIndex = 5`                                                                       |
| `deriveRank` at rank 9's threshold, `unlockedMedalCount / shippedMedalCount < 0.45`  | `currentRankIndex = 8`, `meritLockSatisfied = false`                                         |
| `deriveRank` at rank 9's threshold, `unlockedMedalCount / shippedMedalCount >= 0.45` | `currentRankIndex = 9`, `meritLockSatisfied = true`                                          |
| `deriveRank` at rank 10's threshold, ratio between 0.45 and 0.6                      | `currentRankIndex = 9` (rank 9's lock satisfied, rank 10's is not)                           |
| `deriveRank` at rank 10's threshold, `unlockedMedalCount / shippedMedalCount >= 0.6` | `currentRankIndex = 10`, `meritLockSatisfied = true`                                         |
| `deriveRank` called twice with identical inputs                                      | identical output (pure function, no hidden state, `AC-12-14`'s idempotency restated)         |
| `deriveRank` with `maturedPoints` falling from rank 5's threshold to rank 3's        | `currentRankIndex = 3`; `highestRankIndex` is the caller's responsibility, not asserted here |
| `isMeritLockSatisfied(9, ...)` at exactly 45%                                        | `true` (inclusive boundary, `>=`)                                                            |
| `isMeritLockSatisfied(10, ...)` at exactly 60%                                       | `true` (inclusive boundary, `>=`)                                                            |
| `isMeritLockSatisfied` with `shippedMedalCount = 0`                                  | `false`, no division-by-zero throw                                                           |

## Implemented Artifacts

| File                                                          | What it delivers                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/data/progression/rankLadder.ts`                      | Real implementation replacing `WO-01`'s stub: `pointsForRank`, `RANK_LADDER` (ten `{ rankKey, rankIndex, threshold, meritLockFraction? }` entries), `isMeritLockSatisfied`, and `deriveRank` (`currentRankIndex` + `meritLockSatisfied`). Imports nothing; `shippedMedalCount` arrives as a caller-supplied number, matching `medalCatalogue.getShippedMedalCount()`'s value as read by `recompute.ts`. |
| `src/lib/data/progression/recompute.ts`                       | One-line surgical touch: destructures `deriveRank`'s renamed `currentRankIndex` field (aliased to the existing local `rankIndex`). No other change to the call site, argument order, or control flow.                                                                                                                                                                                                   |
| `src/i18n/locales/{es,en}/progress.json`                      | New namespace, `ranks.<rankKey>.{name,lore,threshold}` for all ten ranks, registered in `src/i18n/request.ts`.                                                                                                                                                                                                                                                                                          |
| `docs/design/decisions/0038-permanent-rank-and-merit-lock.md` | ADR restating the FRD-approved permanent-rank and merit-lock decisions (`FR-12-16`, `FR-12-17`, `BR-12-06`), indexed in `docs/design/decisions/README.md`.                                                                                                                                                                                                                                              |
| `docs/development/lib-utilities.md`                           | Inventory row for `rankLadder.ts`.                                                                                                                                                                                                                                                                                                                                                                      |

## Test Coverage

- Unit: `src/lib/data/progression/_tests/rankLadder.test.ts` — the ten thresholds against the approved table, strict monotonicity, `isMeritLockSatisfied` boundary/zero-denominator cases, and `deriveRank`'s merit-lock gating at ranks 9-10 (including the "9 unlocked, 10 locked" straddle case) and current-rank derivation independent of any stored highest value.
- Confirmed the formula and merit-lock assertions actually protect the behavior by breaking each in turn (a wrong curve constant, a wrong merit-lock fraction) and observing the suite go red before restoring the correct implementation.
- Existing `src/test/progression-money-guard.test.ts` continues to pass unmodified: `rankLadder.ts` still imports nothing and names no monetary field.
