/**
 * Rank derivation.
 *
 * The ten-rank ladder is a pure function of a point total and two album counters: `deriveRank`
 * reads no database and no clock, so recompute can call it as often as it likes without changing
 * what it returns for the same inputs.
 *
 * Like `pointRules.ts` this module imports nothing and never reads a monetary field; the same static
 * guard scans it. `shippedMedalCount` and `unlockedMedalCount` arrive as plain numbers the caller
 * already resolved (`recompute.ts` reads `shippedMedalCount` from `medalCatalogue.getShippedMedalCount()`
 * before calling in), which is what keeps this module a leaf.
 */

/** Number of ranks the ladder exposes. Fixed by the product definition. */
export const RANK_COUNT = 10;

/** The rank every collector starts at, and the floor the derivation can never fall below. */
export const FIRST_RANK_INDEX = 1;

/** The highest rank index, the floor for `RANK_COUNT` staying in sync with the ladder below. */
export const LAST_RANK_INDEX = RANK_COUNT;

/** The two ranks whose threshold alone is not enough; the album share of `FR-12-17` gates them too. */
const FIRST_MERIT_LOCKED_RANK_INDEX = 9;
const LAST_MERIT_LOCKED_RANK_INDEX = 10;

/** Required share of the shipped medal catalogue, one entry per merit-locked rank (`FR-12-17`). */
const MERIT_LOCK_FRACTION_RANK_9 = 0.45;
const MERIT_LOCK_FRACTION_RANK_10 = 0.6;

/** A rank index that additionally requires the merit lock of `FR-12-17`. */
export type MeritLockedRankIndex = typeof FIRST_MERIT_LOCKED_RANK_INDEX | typeof LAST_MERIT_LOCKED_RANK_INDEX;

/** Stable, English translation keys for the ten ranks, in ascending order. Never the display name. */
export const RANK_KEYS = [
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
] as const;

export type RankKey = (typeof RANK_KEYS)[number];

export type RankLadderEntry = {
  rankKey: RankKey;
  /** 1-based position in the ladder, matching the `"Rango N de 10"` copy of `FR-12-15`. */
  rankIndex: number;
  threshold: number;
  /** Present only on the two merit-locked ranks; their required share of the shipped catalogue. */
  meritLockFraction?: number;
};

const MERIT_LOCK_FRACTION_BY_RANK_INDEX: Readonly<Record<MeritLockedRankIndex, number>> = {
  [FIRST_MERIT_LOCKED_RANK_INDEX]: MERIT_LOCK_FRACTION_RANK_9,
  [LAST_MERIT_LOCKED_RANK_INDEX]: MERIT_LOCK_FRACTION_RANK_10,
};

function isMeritLockedRankIndex(rankIndex: number): rankIndex is MeritLockedRankIndex {
  return rankIndex === FIRST_MERIT_LOCKED_RANK_INDEX || rankIndex === LAST_MERIT_LOCKED_RANK_INDEX;
}

/**
 * The threshold curve approved by `FR-12-14`, calibrated so the base profile of 210 points a month
 * reaches rank 10 in roughly forty-five months. Superlinear on purpose: each rank costs a larger
 * jump than the last, so the ladder stays meaningful across years of recordkeeping instead of
 * flattening out.
 */
export function pointsForRank(rankIndex: number): number {
  return Math.round((200 * (rankIndex - 1) ** 1.75) / 10) * 10;
}

/**
 * The ten `{ rankKey, rankIndex, threshold }` entries, generated from `pointsForRank` rather than
 * hand-copied, so a future recalibration of the formula's constants is caught by the threshold-table
 * unit test instead of silently drifting from the approved figures.
 */
export const RANK_LADDER: readonly RankLadderEntry[] = RANK_KEYS.map((rankKey, position) => {
  const rankIndex = position + 1;
  const threshold = pointsForRank(rankIndex);
  return isMeritLockedRankIndex(rankIndex)
    ? { rankKey, rankIndex, threshold, meritLockFraction: MERIT_LOCK_FRACTION_BY_RANK_INDEX[rankIndex] }
    : { rankKey, rankIndex, threshold };
});

/**
 * Whether the merit lock for a locked rank is satisfied: the collector's unlocked share of the
 * currently shipped catalogue meets the rank's required fraction. `>=` so the boundary itself
 * counts, and a zero (or negative, defensively) `shippedMedalCount` always fails rather than
 * dividing by zero, since a share of an empty album is not a gate anybody can pass.
 */
export function isMeritLockSatisfied(
  rankIndex: MeritLockedRankIndex,
  unlockedMedalCount: number,
  shippedMedalCount: number,
): boolean {
  if (shippedMedalCount <= 0) return false;
  const requiredFraction = MERIT_LOCK_FRACTION_BY_RANK_INDEX[rankIndex];
  return unlockedMedalCount / shippedMedalCount >= requiredFraction;
}

/** Whether a rank's gate is satisfied: always true for the eight unlocked ranks. */
function isRankGateSatisfied(rankIndex: number, unlockedMedalCount: number, shippedMedalCount: number): boolean {
  if (!isMeritLockedRankIndex(rankIndex)) return true;
  return isMeritLockSatisfied(rankIndex, unlockedMedalCount, shippedMedalCount);
}

export type DeriveRankInput = {
  maturedPoints: number;
  /**
   * Medals this collector has unlocked, and medals actually shipped in this build. The top two
   * ranks additionally require a share of the album, and the denominator has to be the CURRENT
   * shipped count so the gate does not move under a collector as the catalogue grows.
   */
  unlockedMedalCount: number;
  shippedMedalCount: number;
};

export type DeriveRankResult = {
  /**
   * The rank index the current point total and album resolve to right now. Never the stored
   * highest: a collector who loses points keeps their title, and enforcing that permanence is
   * `recompute.ts`'s job, not this module's (`BR-12-06`).
   */
  currentRankIndex: number;
  /**
   * Whether the merit lock is satisfied for the rank the point total alone would reach (the
   * "target" rank), regardless of whether `currentRankIndex` actually got there. This is what lets
   * the UI show "Llevas N de M" against the rank the collector is one album short of, not against
   * whichever rank they actually landed on.
   */
  meritLockSatisfied: boolean;
};

/**
 * Derives the current rank from a point total and the two album counters.
 *
 * First finds the highest rank whose threshold the point total meets, ignoring the merit lock.
 * Then, only if that target rank is merit-locked and the lock is not satisfied, steps back down the
 * ladder until it finds a rank whose gate the collector actually clears. A collector with the points
 * for rank 9 but not the album sits at rank 8, never at a half state.
 */
export function deriveRank(input: DeriveRankInput): DeriveRankResult {
  const { maturedPoints, unlockedMedalCount, shippedMedalCount } = input;

  let targetRankIndex = FIRST_RANK_INDEX;
  for (const rank of RANK_LADDER) {
    if (maturedPoints < rank.threshold) break;
    targetRankIndex = rank.rankIndex;
  }

  const meritLockSatisfied = isRankGateSatisfied(targetRankIndex, unlockedMedalCount, shippedMedalCount);

  let currentRankIndex = targetRankIndex;
  while (
    currentRankIndex > FIRST_RANK_INDEX &&
    !isRankGateSatisfied(currentRankIndex, unlockedMedalCount, shippedMedalCount)
  ) {
    currentRankIndex -= 1;
  }

  return { currentRankIndex, meritLockSatisfied };
}
