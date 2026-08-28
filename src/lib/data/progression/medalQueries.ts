import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  MEDAL_SERIES_ORDER,
  findMedal,
  getShippedMedalCount,
  isShippedMedal,
  listMedalsBySeries,
  type MedalDefinition,
  type MedalRarity,
  type MedalSeries,
} from "./medalCatalogue";
import { resolveStatefulMedalCurrency } from "./medalEvaluation";

/**
 * Read side of the album.
 *
 * Every query here is scoped to the session `userId` and takes no user parameter of its own, so a
 * collector's album is not addressable by anybody else (`BR-12-02`, `FR-12-18`). The catalogue is
 * the source of what EXISTS; `MedalUnlock` is the source of what this collector HOLDS. The two are
 * joined here rather than in the page, which is what lets the album render locked silhouettes for
 * medals that have no row at all.
 */

/** One medal as the album renders it: the catalogue entry plus this collector's relationship to it. */
export type MedalAlbumEntry = {
  medalKey: string;
  series: MedalSeries;
  rarity: MedalRarity;
  /** A secret piece hides its name and condition until it is held (`FR-12-25`). */
  secret: boolean;
  /** Whether this build can award it at all. Every catalogue row currently can. */
  shipped: boolean;
  unlocked: boolean;
  unlockedAt: Date | null;
  numbered: boolean;
  serialNumber: number | null;
  imageKey: string | null;
  /**
   * `null` for a medal whose condition is an event. For a `stateful` one, whether that state still
   * holds right now. Never a reason to withdraw the unlock (`BR-12-08`).
   */
  isCurrentlyValid: boolean | null;
};

/** One album page: a series, its medals, and its own counter (`FR-12-26`). */
export type MedalAlbumPage = {
  series: MedalSeries;
  medals: MedalAlbumEntry[];
  unlockedCount: number;
  /** Medals of this series this build can award, which is currently all of them. */
  shippedCount: number;
};

export type MedalAlbum = {
  pages: MedalAlbumPage[];
  unlockedCount: number;
  /** The global denominator: what this build ships, which is the whole catalogue. */
  shippedCount: number;
};

type UnlockRow = { medalKey: string; unlockedAt: Date; serialNumber: number | null };

async function loadUnlocks(userId: string, db: Prisma.TransactionClient): Promise<Map<string, UnlockRow>> {
  const rows = await db.medalUnlock.findMany({
    where: { userId },
    select: { medalKey: true, unlockedAt: true, serialNumber: true },
  });
  return new Map(rows.map((row) => [row.medalKey, row]));
}

function toAlbumEntry(
  medal: MedalDefinition,
  unlock: UnlockRow | undefined,
  currency: ReadonlyMap<string, boolean>,
): MedalAlbumEntry {
  return {
    medalKey: medal.medalKey,
    series: medal.series,
    rarity: medal.rarity,
    secret: medal.secret,
    shipped: isShippedMedal(medal),
    unlocked: unlock !== undefined,
    unlockedAt: unlock?.unlockedAt ?? null,
    numbered: medal.numbered,
    serialNumber: unlock?.serialNumber ?? null,
    imageKey: medal.imageKey,
    isCurrentlyValid: medal.stateful && unlock ? (currency.get(medal.medalKey) ?? false) : null,
  };
}

/**
 * The whole album for one collector, grouped into its six pages.
 *
 * Every row is awardable, so nothing renders as a promise and the counters divide by the whole
 * catalogue. A row this build could NOT award would still be drawn, and still be left out of the
 * counters (`FR-12-20`): telling a collector they are "3 de 28" against medals nobody can earn yet
 * would be a lie.
 */
export async function getMedalAlbum(userId: string, tx?: Prisma.TransactionClient): Promise<MedalAlbum> {
  const db = tx ?? prisma;
  const unlocks = await loadUnlocks(userId, db);
  const currency = await resolveStatefulMedalCurrency(userId, [...unlocks.keys()], db);

  const pages = listMedalsBySeries().map(({ series, medals }) => {
    const entries = medals.map((medal) => toAlbumEntry(medal, unlocks.get(medal.medalKey), currency));
    return {
      series,
      medals: entries,
      unlockedCount: entries.filter((entry) => entry.unlocked).length,
      shippedCount: entries.filter((entry) => entry.shipped).length,
    };
  });

  return {
    pages,
    unlockedCount: pages.reduce((total, page) => total + page.unlockedCount, 0),
    shippedCount: getShippedMedalCount(),
  };
}

export type MedalDetail = {
  medal: MedalAlbumEntry;
  /** Whether the collector may still earn it. `false` for an unshipped row or a closed window. */
  obtainable: boolean;
  /** The next piece of the same series the collector does not hold yet, for the preview row. */
  nextInSeries: MedalAlbumEntry | null;
};

/**
 * One medal's detail, always resolved together with this collector's own unlock state.
 *
 * Never a bare catalogue lookup: answering "is this unlocked" for a key without a `userId` would be
 * answering it for somebody. An unknown key returns `null` and the route turns that into a 404.
 */
export async function getMedalDetail(
  medalKey: string,
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<MedalDetail | null> {
  const medal = findMedal(medalKey);
  if (!medal) {
    return null;
  }

  const db = tx ?? prisma;
  const unlocks = await loadUnlocks(userId, db);
  const currency = await resolveStatefulMedalCurrency(userId, [...unlocks.keys()], db);

  const siblings = listMedalsBySeries().find((page) => page.series === medal.series)?.medals ?? [];
  const next =
    siblings.find((sibling) => sibling.medalKey !== medal.medalKey && !unlocks.has(sibling.medalKey)) ?? null;

  return {
    medal: toAlbumEntry(medal, unlocks.get(medal.medalKey), currency),
    obtainable: isShippedMedal(medal),
    nextInSeries: next ? toAlbumEntry(next, undefined, currency) : null,
  };
}

/** Series in album order, for a caller that needs the page list without loading any unlock. */
export function listAlbumSeries(): readonly MedalSeries[] {
  return MEDAL_SERIES_ORDER;
}

export type MedalShowcase = {
  /** Newest first. Album entries, so the strips and the album grid render the same shape. */
  entries: MedalAlbumEntry[];
  unlockedCount: number;
  shippedCount: number;
};

/**
 * The last few medals a collector unlocked, plus the two counters the strips print beside them.
 *
 * Deliberately not `getMedalAlbum().pages.flatMap(...)`: the dashboard renders on every visit and
 * only needs a handful of rows, so this reads exactly those rows and a count instead of walking the
 * whole catalogue for medals nobody is about to look at. Stateful currency is still resolved for
 * the few it returns, so a medal whose condition stopped holding is labelled here exactly as it is
 * in the album rather than silently reading as current.
 */
export async function getMedalShowcase(
  userId: string,
  limit: number,
  tx?: Prisma.TransactionClient,
): Promise<MedalShowcase> {
  const db = tx ?? prisma;
  const [rows, unlockedCount] = await Promise.all([
    db.medalUnlock.findMany({
      where: { userId },
      orderBy: [{ unlockedAt: "desc" }, { medalKey: "asc" }],
      take: limit,
      select: { medalKey: true, unlockedAt: true, serialNumber: true },
    }),
    db.medalUnlock.count({ where: { userId } }),
  ]);

  const currency = await resolveStatefulMedalCurrency(
    userId,
    rows.map((row) => row.medalKey),
    db,
  );

  const entries = rows.flatMap((row) => {
    const medal = findMedal(row.medalKey);
    // A key with no catalogue row is a medal a later build stopped describing. It is skipped rather
    // than rendered as a blank tile, and its unlock row stays untouched (`BR-12-08`).
    return medal ? [toAlbumEntry(medal, row, currency)] : [];
  });

  return { entries, unlockedCount, shippedCount: getShippedMedalCount() };
}
