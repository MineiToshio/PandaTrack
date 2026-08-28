import type { Prisma, PointLedgerSource } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getTodayStart } from "../dashboard/dashboardPeriods";
import { getMeritLockDenominator } from "./medalCatalogue";
import { POINT_RULE_GROUP_ORDER, findPointRule, type PointRuleGroup } from "./pointRules";
import {
  FIRST_RANK_INDEX,
  RANK_LADDER,
  isMeritLockSatisfied,
  type MeritLockedRankIndex,
  type RankKey,
  type RankLadderEntry,
} from "./rankLadder";
import { applyCapsDetailed, civilMonthKey, isEntryEligible, loadProgressionFacts } from "./recompute";

/** Read side of the progression domain. */

export type UserProgressCache = {
  userId: string;
  maturedPoints: number;
  rankIndex: number;
  highestRankIndex: number;
  lastRecomputedAt: Date;
};

export type PointLedgerEntryDto = {
  id: string;
  ruleKey: string;
  entityType: string;
  entityId: string;
  points: number;
  occurredOn: Date;
  source: PointLedgerSource;
  createdAt: Date;
  voidedAt: Date | null;
  voidedReason: string | null;
  voidedByUserId: string | null;
};

/**
 * The cached progression figures, or `null` when this collector has never been recomputed.
 *
 * `null` is a first-run state, not an error: the caller shows a loading state and triggers a
 * recompute rather than reporting that something is missing.
 */
export async function getUserProgressCache(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<UserProgressCache | null> {
  const db = tx ?? prisma;
  return db.userProgress.findUnique({
    where: { userId },
    select: { userId: true, maturedPoints: true, rankIndex: true, highestRankIndex: true, lastRecomputedAt: true },
  });
}

/**
 * Every ledger entry for one collector, voided rows included, newest first.
 *
 * Read-only by design, and there is deliberately no sibling that edits, reorders or deletes an
 * entry. An administrator can see why a total is what it is and can void it; nothing anywhere grants
 * points by hand.
 */
export async function listUserPointLedger(
  targetUserId: string,
  tx?: Prisma.TransactionClient,
): Promise<PointLedgerEntryDto[]> {
  const db = tx ?? prisma;
  return db.pointLedgerEntry.findMany({
    where: { userId: targetUserId },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      ruleKey: true,
      entityType: true,
      entityId: true,
      points: true,
      occurredOn: true,
      source: true,
      createdAt: true,
      voidedAt: true,
      voidedReason: true,
      voidedByUserId: true,
    },
  });
}

/**
 * The civil day a credit happening right now belongs to, pinned to UTC midnight.
 *
 * Not the entity's own date and not the wall-clock instant. At 21:00 in Lima a bare `new Date()`
 * already reads as tomorrow in UTC, which would file the entry under the wrong day and, on the last
 * evening of a month, under the wrong monthly cap. This goes through the same resolver the budget
 * cycle and the overdue chips use, so a timezone control shipping later moves all of them together.
 */
export async function resolveProgressionOccurredOn(
  userId: string,
  now: Date,
  tx?: Prisma.TransactionClient,
): Promise<Date> {
  const db = tx ?? prisma;
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return getTodayStart(now, user?.timezone);
}

/** Hours after which opening the section triggers a background recompute (`FR-12-11`). */
export const PROGRESS_CACHE_STALE_HOURS = 6;

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const PERCENT = 100;

/** Rank from which the merit-lock counter becomes visible (`FR-12-17`). */
export const MERIT_LOCK_VISIBLE_FROM_RANK_INDEX = 6;

/** Whether the whole layer is hidden for this collector. Read on every surface that renders it. */
export async function getProgressionVisibility(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<{ hideProgression: boolean }> {
  const db = tx ?? prisma;
  const settings = await db.progressionSettings.findUnique({
    where: { userId },
    select: { hideProgression: true },
  });
  // No row is the default state, not a missing one: the layer ships on, and the settings toggle
  // writes the row the first time it is switched off (`FR-12-38`).
  return { hideProgression: settings?.hideProgression ?? false };
}

/** One line of the monthly breakdown: a rule group and what it credited this civil month. */
export type ProgressMonthlyGroup = {
  group: PointRuleGroup;
  points: number;
};

/** The merit lock as the counter renders it: never a bare percentage (`FR-12-17`). */
export type ProgressMeritLock = {
  rankKey: RankKey;
  rankIndex: number;
  /** Required share of the album, `0..1`. Rendered as a whole percentage beside the counter. */
  requiredFraction: number;
  unlockedMedalCount: number;
  /** Album size the share is measured against: what this collector can still reach, not the raw 24. */
  denominator: number;
  /** Medals the share resolves to, so the copy can say "you hold N of M" with a reachable M. */
  requiredMedalCount: number;
  satisfied: boolean;
};

export type ProgressSummary = {
  /** `false` before any point exists, which is an honest empty state, not a zero dashboard. */
  hasPoints: boolean;
  /**
   * `true` when the collector has a rank above the first rung, or holds a medal, even though
   * `hasPoints` is `false` right now. An admin voiding every live entry (`BR-12-06`) zeroes the
   * live total without erasing the permanent high-water mark, so this is what tells the `Resumen`
   * tab apart from a brand-new account: the same "no points" state, but reached from history
   * rather than never having started.
   */
  hasHistoricalProgress: boolean;
  totalPoints: number;
  /** The rank every surface names, which is the permanent high-water mark, never the live one. */
  currentRankIndex: number;
  currentRankKey: RankKey;
  /** The same high-water mark, kept as its own field for the ladder's `conquered` banding. */
  highestRankIndex: number;
  /** `null` at the top of the ladder, where there is nothing left to progress toward. */
  nextRank: { rankKey: RankKey; rankIndex: number; threshold: number } | null;
  pointsToNextRank: number;
  /** Progress from the current rank's threshold to the next one, `0..100`. `100` at rank ten. */
  nextRankProgressPercent: number;
  pointsThisMonth: number;
  monthlyGroups: ProgressMonthlyGroup[];
  meritLock: ProgressMeritLock | null;
  /** `true` when the cache is older than `PROGRESS_CACHE_STALE_HOURS`, or was never written. */
  stale: boolean;
  lastRecomputedAt: Date | null;
};

/** Whether a cached row is old enough that opening the section should refresh it (`FR-12-11`). */
export function isProgressCacheStale(lastRecomputedAt: Date | null, now: Date = new Date()): boolean {
  if (!lastRecomputedAt) return true;
  return now.getTime() - lastRecomputedAt.getTime() > PROGRESS_CACHE_STALE_HOURS * MILLISECONDS_PER_HOUR;
}

/** Points still missing for the next rung, floored at zero at the top of the ladder. */
function resolvePointsToNextRank(totalPoints: number, nextRank: RankLadderEntry | undefined): number {
  if (!nextRank) return 0;
  return Math.max(0, nextRank.threshold - totalPoints);
}

/**
 * How far along the current rung the collector stands, measured between the two thresholds that
 * bound it rather than from zero: a bar that fills from zero every time makes rank nine look like a
 * beginner's, since the thresholds are superlinear and each rung is wider than the last.
 */
function resolveNextRankProgressPercent(
  totalPoints: number,
  currentRank: RankLadderEntry,
  nextRank: RankLadderEntry | undefined,
): number {
  if (!nextRank) return PERCENT;
  const span = nextRank.threshold - currentRank.threshold;
  if (span <= 0) return PERCENT;
  const walked = totalPoints - currentRank.threshold;
  return Math.min(PERCENT, Math.max(0, (walked / span) * PERCENT));
}

/**
 * Everything the `Progreso` section's `Resumen` tab renders, for the session collector only.
 *
 * There is no user parameter beyond the authenticated id on purpose: a progression surface belonging
 * to somebody else is not addressable, by URL or by argument (`BR-12-02`).
 *
 * The monthly breakdown is derived from the CREDITED figure each entry contributed, not from its
 * face value: replaying the eligibility filter and the cap pass over the whole ledger and then
 * keeping this civil month's share is the only way the four lines add up to a number the collector
 * can reconcile against the total above them. The cached `maturedPoints` stays the authority for
 * that total, so a breakdown computed a moment before a recompute never contradicts the rank.
 */
export async function getProgressSummary(
  userId: string,
  now: Date = new Date(),
  tx?: Prisma.TransactionClient,
): Promise<ProgressSummary> {
  const db = tx ?? prisma;

  const [cache, entries, unlocks] = await Promise.all([
    getUserProgressCache(userId, db),
    db.pointLedgerEntry.findMany({
      where: { userId, voidedAt: null },
      select: {
        id: true,
        ruleKey: true,
        entityType: true,
        entityId: true,
        points: true,
        occurredOn: true,
        createdAt: true,
      },
    }),
    db.medalUnlock.findMany({ where: { userId }, select: { medalKey: true } }),
  ]);

  const facts = await loadProgressionFacts(db, userId, entries);
  const eligible = entries.filter((entry) => isEntryEligible(entry, facts));
  const { total: derivedTotal, creditedByEntryId } = applyCapsDetailed(eligible);

  // The cache is the authority while it exists; the derived total covers the first-run gap before
  // any recompute has written a row.
  const totalPoints = cache?.maturedPoints ?? derivedTotal;
  // The rank the collector is SHOWN is the highest one they ever reached, never the one their
  // current total would resolve to right now. A total that fell because an order was deleted moves
  // the bar backwards inside the band and nothing else: the title, its index, the next threshold and
  // the lock counter all stay pinned to the high-water mark (`BR-12-06`, `FR-12-16`). Taking the
  // maximum of the two cached figures rather than trusting `highestRankIndex` alone keeps a cache
  // row written before that invariant existed from displaying a rank below the live one.
  const displayedRankIndex = Math.max(
    cache?.highestRankIndex ?? FIRST_RANK_INDEX,
    cache?.rankIndex ?? FIRST_RANK_INDEX,
  );
  const currentRank = RANK_LADDER[displayedRankIndex - 1] ?? RANK_LADDER[0];
  const nextRank = RANK_LADDER[currentRank.rankIndex];

  const monthKey = civilMonthKey(startOfCivilMonth(now));
  const pointsByGroup = new Map<PointRuleGroup, number>();
  for (const entry of eligible) {
    if (civilMonthKey(entry.occurredOn) !== monthKey) continue;
    const credited = creditedByEntryId.get(entry.id);
    if (credited === undefined) continue;
    const rule = findPointRule(entry.ruleKey);
    if (!rule) continue;
    pointsByGroup.set(rule.group, (pointsByGroup.get(rule.group) ?? 0) + credited);
  }

  const monthlyGroups = POINT_RULE_GROUP_ORDER.filter((group) => (pointsByGroup.get(group) ?? 0) > 0).map((group) => ({
    group,
    points: pointsByGroup.get(group) ?? 0,
  }));

  return {
    hasPoints: totalPoints > 0 || entries.length > 0,
    hasHistoricalProgress: displayedRankIndex > FIRST_RANK_INDEX || unlocks.length > 0,
    totalPoints,
    currentRankIndex: currentRank.rankIndex,
    currentRankKey: currentRank.rankKey,
    highestRankIndex: displayedRankIndex,
    nextRank: nextRank
      ? { rankKey: nextRank.rankKey, rankIndex: nextRank.rankIndex, threshold: nextRank.threshold }
      : null,
    pointsToNextRank: resolvePointsToNextRank(totalPoints, nextRank),
    nextRankProgressPercent: resolveNextRankProgressPercent(totalPoints, currentRank, nextRank),
    pointsThisMonth: monthlyGroups.reduce((sum, line) => sum + line.points, 0),
    monthlyGroups,
    meritLock: resolveMeritLock(
      currentRank.rankIndex,
      unlocks.map((unlock) => unlock.medalKey),
      now,
    ),
    stale: isProgressCacheStale(cache?.lastRecomputedAt ?? null, now),
    lastRecomputedAt: cache?.lastRecomputedAt ?? null,
  };
}

/** UTC midnight of the first day of `now`'s civil month, matching how entries are bucketed. */
function startOfCivilMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * The merit lock the counter should be pointed at, or `null` while it is not yet visible.
 *
 * It is deliberately not shown before rank six (`FR-12-17`): a collector three ranks away from the
 * gate reads it as one more thing they are behind on, not as a goal. Once visible, it points at the
 * next merit-locked rank the collector has not cleared, so it stops moving the moment it is passed.
 */
function resolveMeritLock(
  currentRankIndex: number,
  unlockedMedalKeys: readonly string[],
  now: Date,
): ProgressMeritLock | null {
  if (currentRankIndex < MERIT_LOCK_VISIBLE_FROM_RANK_INDEX) return null;

  const target = RANK_LADDER.find((rank) => rank.meritLockFraction !== undefined && rank.rankIndex > currentRankIndex);
  if (!target?.meritLockFraction) return null;

  const denominator = getMeritLockDenominator(unlockedMedalKeys, now);
  return {
    rankKey: target.rankKey,
    rankIndex: target.rankIndex,
    requiredFraction: target.meritLockFraction,
    unlockedMedalCount: unlockedMedalKeys.length,
    denominator,
    requiredMedalCount: Math.ceil(denominator * target.meritLockFraction),
    satisfied: isMeritLockSatisfied(target.rankIndex as MeritLockedRankIndex, unlockedMedalKeys.length, denominator),
  };
}

/** Everything the rank celebration renders, resolved once alongside the claim that gates it. */
export type RankCelebrationContent = {
  rankKey: RankKey;
  rankIndex: number;
  /** The rank left behind, so the modal can show the jump rather than only the destination. */
  previousRankIndex: number;
  totalPoints: number;
  nextRank: { rankKey: RankKey; rankIndex: number; threshold: number } | null;
  /** Progress along the new rung, `0..100`. `100` at the top of the ladder. */
  nextRankProgressPercent: number;
};

/**
 * The content of the celebration for a rank the collector has just reached.
 *
 * Resolved server-side rather than derived on the client for one reason only: the point total is
 * not in the credited action's payload, and the progress bar the celebration shows would otherwise
 * have to be guessed. The ladder itself is pure, so nothing else here needs a query.
 */
export async function getRankCelebrationContent(
  userId: string,
  rankIndex: number,
  previousRankIndex: number,
  tx?: Prisma.TransactionClient,
): Promise<RankCelebrationContent | null> {
  const rank = RANK_LADDER[rankIndex - 1];
  if (!rank) return null;

  const cache = await getUserProgressCache(userId, tx);
  const totalPoints = cache?.maturedPoints ?? rank.threshold;
  const nextRank = RANK_LADDER[rank.rankIndex];

  return {
    rankKey: rank.rankKey,
    rankIndex: rank.rankIndex,
    previousRankIndex,
    totalPoints,
    nextRank: nextRank
      ? { rankKey: nextRank.rankKey, rankIndex: nextRank.rankIndex, threshold: nextRank.threshold }
      : null,
    nextRankProgressPercent: resolveNextRankProgressPercent(totalPoints, rank, nextRank),
  };
}

/** The one-time welcome the migrated history earns instead of a replay of its unlocks. */
export type WelcomeCelebrationContent = {
  rankKey: RankKey;
  rankIndex: number;
  medalCount: number;
};

/**
 * The aggregated welcome celebration, or `null` when there is nothing to welcome (`FR-12-43`).
 *
 * Derived rather than stored, from two facts that already exist: the collector holds at least one
 * `BACKFILL` entry, and their celebration watermark is still at zero. A collector whose history
 * came in through the app has no backfilled entry and therefore never sees this; one whose history
 * was migrated sees it exactly once, because showing it claims the watermark like any other
 * celebration. Nothing needed a column of its own.
 *
 * It names the rank and how many medals came with it, and nothing else: no amount and no store
 * (`BR-12-01`, `BR-12-02`).
 */
export async function getWelcomeCelebrationContent(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<WelcomeCelebrationContent | null> {
  const db = tx ?? prisma;

  const settings = await db.progressionSettings.findUnique({
    where: { userId },
    select: { lastCelebratedRankIndex: true },
  });
  return resolveWelcomeCelebration(db, userId, settings?.lastCelebratedRankIndex ?? 0);
}

/** The half of the welcome check that runs once the watermark is already in hand. */
async function resolveWelcomeCelebration(
  db: Prisma.TransactionClient,
  userId: string,
  lastCelebratedRankIndex: number,
): Promise<WelcomeCelebrationContent | null> {
  // A watermark above zero means some celebration already ran, welcome or otherwise.
  if (lastCelebratedRankIndex > 0) return null;

  const backfilled = await db.pointLedgerEntry.findFirst({
    where: { userId, source: "BACKFILL", voidedAt: null },
    select: { id: true },
  });
  if (!backfilled) return null;

  const [cache, medalCount] = await Promise.all([
    getUserProgressCache(userId, db),
    db.medalUnlock.count({ where: { userId } }),
  ]);

  const rankIndex = Math.max(FIRST_RANK_INDEX, cache?.highestRankIndex ?? FIRST_RANK_INDEX);
  const rank = RANK_LADDER[rankIndex - 1];
  if (!rank) return null;

  return { rankKey: rank.rankKey, rankIndex: rank.rankIndex, medalCount };
}

/** What the app shell needs from this domain, in one read. */
export type ProgressionShellState = {
  hideProgression: boolean;
  /** A migrated history still owed its single aggregated welcome (`FR-12-43`). */
  welcomeCelebrationPending: boolean;
};

/**
 * The two progression facts the authenticated shell renders from, resolved together.
 *
 * Deliberately one function rather than two calls: both answers come out of the same
 * `progression_settings` row, and this runs on every authenticated page render, so asking for that
 * row twice would be a second round trip per navigation for nothing. The ledger probe behind the
 * welcome only runs when the watermark says a welcome is still possible, and never at all while the
 * layer is hidden, since a hidden layer raises nothing (`FR-12-38`).
 */
export async function getProgressionShellState(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<ProgressionShellState> {
  const db = tx ?? prisma;

  const settings = await db.progressionSettings.findUnique({
    where: { userId },
    select: { hideProgression: true, lastCelebratedRankIndex: true },
  });
  const hideProgression = settings?.hideProgression ?? false;
  if (hideProgression) {
    return { hideProgression, welcomeCelebrationPending: false };
  }

  const welcome = await resolveWelcomeCelebration(db, userId, settings?.lastCelebratedRankIndex ?? 0);
  return { hideProgression, welcomeCelebrationPending: welcome !== null };
}
