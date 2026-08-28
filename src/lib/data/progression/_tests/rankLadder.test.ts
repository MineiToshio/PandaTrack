import { describe, expect, it } from "vitest";
import { FIRST_RANK_INDEX, RANK_LADDER, deriveRank, isMeritLockSatisfied, pointsForRank } from "../rankLadder";

/**
 * The approved figures from the FRD's rank table (`FR-12-14`), asserted against the formula so a
 * future recalibration of the formula's constants is caught if it silently drifts from the approved
 * numbers without an explicit FRD amendment.
 */
const APPROVED_THRESHOLDS = [0, 200, 670, 1370, 2260, 3340, 4600, 6020, 7610, 9350];

describe("pointsForRank", () => {
  it("matches the approved threshold table exactly", () => {
    const thresholds = APPROVED_THRESHOLDS.map((_, index) => pointsForRank(index + 1));

    expect(thresholds).toEqual(APPROVED_THRESHOLDS);
  });

  it("is strictly increasing across all ten ranks", () => {
    for (let rankIndex = 2; rankIndex <= APPROVED_THRESHOLDS.length; rankIndex += 1) {
      expect(pointsForRank(rankIndex)).toBeGreaterThan(pointsForRank(rankIndex - 1));
    }
  });
});

describe("RANK_LADDER", () => {
  it("has ten entries whose rankKey and threshold match the approved table", () => {
    expect(RANK_LADDER).toHaveLength(10);
    expect(RANK_LADDER.map((entry) => entry.threshold)).toEqual(APPROVED_THRESHOLDS);
    expect(RANK_LADDER.map((entry) => entry.rankKey)).toEqual([
      "kohai",
      "preorder-hunter",
      "volume-keeper",
      "guild-senpai",
      "first-print-hunter",
      "limited-run-curator",
      "club-sensei",
      "rare-edition-archivist",
      "collection-shisho",
      "guild-legend",
    ]);
  });

  it("marks only ranks 9 and 10 with a merit-lock fraction", () => {
    const locked = RANK_LADDER.filter((entry) => entry.meritLockFraction !== undefined);

    expect(locked.map((entry) => entry.rankIndex)).toEqual([9, 10]);
    expect(locked.map((entry) => entry.meritLockFraction)).toEqual([0.45, 0.6]);
  });
});

describe("isMeritLockSatisfied", () => {
  it("is satisfied at exactly 45% for rank 9 (inclusive boundary)", () => {
    expect(isMeritLockSatisfied(9, 9, 20)).toBe(true);
  });

  it("is not satisfied just below 45% for rank 9", () => {
    expect(isMeritLockSatisfied(9, 8, 20)).toBe(false);
  });

  it("is satisfied at exactly 60% for rank 10 (inclusive boundary)", () => {
    expect(isMeritLockSatisfied(10, 12, 20)).toBe(true);
  });

  it("is not satisfied just below 60% for rank 10", () => {
    expect(isMeritLockSatisfied(10, 11, 20)).toBe(false);
  });

  it("never throws on a zero shipped count, and reports unsatisfied", () => {
    expect(isMeritLockSatisfied(9, 0, 0)).toBe(false);
    expect(isMeritLockSatisfied(10, 0, 0)).toBe(false);
  });
});

describe("deriveRank", () => {
  it("resolves rank 1 for a collector with no points", () => {
    const result = deriveRank({ maturedPoints: 0, unlockedMedalCount: 0, shippedMedalCount: 12 });

    expect(result).toEqual({ currentRankIndex: FIRST_RANK_INDEX, meritLockSatisfied: true });
  });

  it("resolves rank 5 at exactly rank 5's threshold, below rank 6, no lock involved", () => {
    const result = deriveRank({ maturedPoints: 2260, unlockedMedalCount: 0, shippedMedalCount: 12 });

    expect(result.currentRankIndex).toBe(5);
    expect(result.meritLockSatisfied).toBe(true);
  });

  it("stays at rank 8 when rank 9's threshold is met but the merit lock is not (below 45%)", () => {
    const result = deriveRank({ maturedPoints: 7610, unlockedMedalCount: 5, shippedMedalCount: 12 });

    expect(result.currentRankIndex).toBe(8);
    expect(result.meritLockSatisfied).toBe(false);
  });

  it("reaches rank 9 when its threshold and its merit lock (>= 45%) are both met", () => {
    const result = deriveRank({ maturedPoints: 7610, unlockedMedalCount: 6, shippedMedalCount: 12 });

    expect(result.currentRankIndex).toBe(9);
    expect(result.meritLockSatisfied).toBe(true);
  });

  it("stays at rank 9 when rank 10's threshold is met but its lock sits between 45% and 60%", () => {
    const result = deriveRank({ maturedPoints: 9350, unlockedMedalCount: 6, shippedMedalCount: 12 });

    expect(result.currentRankIndex).toBe(9);
    expect(result.meritLockSatisfied).toBe(false);
  });

  it("reaches rank 10 when its threshold and its merit lock (>= 60%) are both met", () => {
    const result = deriveRank({ maturedPoints: 9350, unlockedMedalCount: 8, shippedMedalCount: 12 });

    expect(result.currentRankIndex).toBe(10);
    expect(result.meritLockSatisfied).toBe(true);
  });

  it("is a pure function: identical inputs produce identical output", () => {
    const input = { maturedPoints: 4600, unlockedMedalCount: 3, shippedMedalCount: 12 };

    expect(deriveRank(input)).toEqual(deriveRank(input));
  });

  it("derives the rank for the current total alone; the caller owns the never-decreases rule", () => {
    const atRank5 = deriveRank({ maturedPoints: 2260, unlockedMedalCount: 0, shippedMedalCount: 12 });
    const fallenToRank3 = deriveRank({ maturedPoints: 670, unlockedMedalCount: 0, shippedMedalCount: 12 });

    expect(atRank5.currentRankIndex).toBe(5);
    expect(fallenToRank3.currentRankIndex).toBe(3);
  });

  it("never falls below rank 1 even with a negative or zero point total", () => {
    const result = deriveRank({ maturedPoints: 0, unlockedMedalCount: 0, shippedMedalCount: 0 });

    expect(result.currentRankIndex).toBe(FIRST_RANK_INDEX);
  });
});
