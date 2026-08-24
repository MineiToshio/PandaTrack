import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    userProgress: { findUnique: vi.fn() },
    medalUnlock: { count: vi.fn() },
    pointLedgerEntry: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  DEFAULT_LEDGER_PAGE_SIZE,
  getAdminProgressionOverview,
  getProgressionAccount,
  listUserPointLedgerPage,
  PROGRESSION_ACCOUNT_SEARCH_LIMIT,
  searchProgressionAccounts,
} from "../adminProgressionQueries";
import { getShippedMedalCount } from "../medalCatalogue";
import { RANK_LADDER } from "../rankLadder";

const USER_ID = "user-1";

const ACCOUNT_ROW = {
  id: USER_ID,
  username: "toshio",
  name: "Toshio Minei",
  email: "toshio@example.com",
  role: "user",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([ACCOUNT_ROW]);
  prismaMock.user.findUnique.mockResolvedValue(ACCOUNT_ROW);
  prismaMock.userProgress.findUnique.mockResolvedValue(null);
  prismaMock.medalUnlock.count.mockResolvedValue(0);
  prismaMock.pointLedgerEntry.count.mockResolvedValue(0);
  prismaMock.pointLedgerEntry.findMany.mockResolvedValue([]);
});

describe("searchProgressionAccounts", () => {
  it("matches username and email case-insensitively, bounded by the search limit", async () => {
    await searchProgressionAccounts({ query: "  Tosh  " });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { username: { contains: "Tosh", mode: "insensitive" } },
            { email: { contains: "Tosh", mode: "insensitive" } },
          ],
        },
        take: PROGRESSION_ACCOUNT_SEARCH_LIMIT,
      }),
    );
  });

  it("returns nothing for a blank term rather than listing every account", async () => {
    await expect(searchProgressionAccounts({ query: "   " })).resolves.toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("resolves the admin flag from the stored role", async () => {
    prismaMock.user.findMany.mockResolvedValue([ACCOUNT_ROW, { ...ACCOUNT_ROW, id: "user-2", role: "user,admin" }]);

    const accounts = await searchProgressionAccounts({ query: "tosh" });

    expect(accounts.map((account) => account.isAdmin)).toEqual([false, true]);
  });
});

describe("getProgressionAccount", () => {
  it("returns the identity a selection names", async () => {
    await expect(getProgressionAccount(USER_ID)).resolves.toMatchObject({ userId: USER_ID, username: "toshio" });
  });

  it("returns null when the id matches nobody", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(getProgressionAccount("ghost")).resolves.toBeNull();
  });
});

describe("listUserPointLedgerPage", () => {
  it("reads the requested page newest first, scoped to the one collector", async () => {
    prismaMock.pointLedgerEntry.count.mockResolvedValue(60);

    const page = await listUserPointLedgerPage({ targetUserId: USER_ID, page: 2 });

    expect(prismaMock.pointLedgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
        skip: DEFAULT_LEDGER_PAGE_SIZE,
        take: DEFAULT_LEDGER_PAGE_SIZE,
      }),
    );
    expect(page).toMatchObject({ totalCount: 60, currentPage: 2, totalPages: 3 });
  });

  it("clamps a page past the end to the last real page", async () => {
    prismaMock.pointLedgerEntry.count.mockResolvedValue(10);

    const page = await listUserPointLedgerPage({ targetUserId: USER_ID, page: 99 });

    expect(page.currentPage).toBe(1);
    expect(prismaMock.pointLedgerEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it("treats a zero, negative or absent page as the first one", async () => {
    prismaMock.pointLedgerEntry.count.mockResolvedValue(10);

    await expect(listUserPointLedgerPage({ targetUserId: USER_ID, page: 0 })).resolves.toMatchObject({
      currentPage: 1,
    });
    await expect(listUserPointLedgerPage({ targetUserId: USER_ID })).resolves.toMatchObject({ currentPage: 1 });
  });

  it("reports one page for an empty ledger rather than zero", async () => {
    await expect(listUserPointLedgerPage({ targetUserId: USER_ID })).resolves.toMatchObject({
      totalCount: 0,
      totalPages: 1,
    });
  });
});

describe("getAdminProgressionOverview", () => {
  it("resolves the rank keys from the cached indexes and counts live and voided separately", async () => {
    prismaMock.userProgress.findUnique.mockResolvedValue({
      maturedPoints: 420,
      rankIndex: 2,
      highestRankIndex: 3,
      lastRecomputedAt: new Date("2026-08-20T00:00:00.000Z"),
    });
    prismaMock.medalUnlock.count.mockResolvedValue(5);
    prismaMock.pointLedgerEntry.count.mockResolvedValueOnce(12).mockResolvedValueOnce(4);

    const overview = await getAdminProgressionOverview(USER_ID);

    expect(overview).toMatchObject({
      maturedPoints: 420,
      rankIndex: 2,
      rankKey: RANK_LADDER[1].rankKey,
      highestRankIndex: 3,
      highestRankKey: RANK_LADDER[2].rankKey,
      unlockedMedalCount: 5,
      shippedMedalCount: getShippedMedalCount(),
      liveEntryCount: 12,
      voidedEntryCount: 4,
    });
  });

  it("counts the voided entries with a separate predicate, not by subtraction", async () => {
    await getAdminProgressionOverview(USER_ID);

    expect(prismaMock.pointLedgerEntry.count).toHaveBeenCalledWith({ where: { userId: USER_ID, voidedAt: null } });
    expect(prismaMock.pointLedgerEntry.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, voidedAt: { not: null } },
    });
  });

  it("reads as first-run rather than as zero when the collector was never recomputed", async () => {
    const overview = await getAdminProgressionOverview(USER_ID);

    expect(overview.maturedPoints).toBeNull();
    expect(overview.rankKey).toBeNull();
    expect(overview.highestRankKey).toBeNull();
    expect(overview.lastRecomputedAt).toBeNull();
  });

  it("does not invent a rank for an index outside the ladder", async () => {
    prismaMock.userProgress.findUnique.mockResolvedValue({
      maturedPoints: 0,
      rankIndex: 99,
      highestRankIndex: 99,
      lastRecomputedAt: new Date(),
    });

    const overview = await getAdminProgressionOverview(USER_ID);

    expect(overview.rankKey).toBeNull();
    expect(overview.highestRankKey).toBeNull();
  });
});
