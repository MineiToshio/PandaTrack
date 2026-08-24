import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    progressionSettings: { upsert: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    pointLedgerEntry: { findFirst: vi.fn(), deleteMany: vi.fn() },
    medalUnlock: { count: vi.fn(), deleteMany: vi.fn() },
    userProgress: { findUnique: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { claimRankCelebration, purgeProgressionLedger, setProgressionVisibility } from "../progressionMutations";
import { getProgressionShellState, getWelcomeCelebrationContent } from "../progressionQueries";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.progressionSettings.upsert.mockResolvedValue({});
});

describe("claimRankCelebration", () => {
  it("claims a rank above the watermark and advances it in the same statement", async () => {
    prismaMock.progressionSettings.updateMany.mockResolvedValue({ count: 1 });

    await expect(claimRankCelebration("user-1", 4)).resolves.toBe(true);
    expect(prismaMock.progressionSettings.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", lastCelebratedRankIndex: { lt: 4 } },
      data: { lastCelebratedRankIndex: 4 },
    });
  });

  it("refuses a rank the watermark already covers, so a recompute cannot replay it", async () => {
    prismaMock.progressionSettings.updateMany.mockResolvedValue({ count: 0 });

    await expect(claimRankCelebration("user-1", 4)).resolves.toBe(false);
  });

  it("creates the settings row before claiming, without disturbing an existing one", async () => {
    prismaMock.progressionSettings.updateMany.mockResolvedValue({ count: 1 });

    await claimRankCelebration("user-1", 2);
    expect(prismaMock.progressionSettings.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1" },
      update: {},
    });
  });
});

describe("setProgressionVisibility", () => {
  it("writes the flag, creating the row the first time the layer is switched off", async () => {
    prismaMock.progressionSettings.upsert.mockResolvedValue({});

    await setProgressionVisibility("user-1", true);
    expect(prismaMock.progressionSettings.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1", hideProgression: true },
      update: { hideProgression: true },
    });
  });
});

describe("purgeProgressionLedger", () => {
  function runTransaction() {
    const tx = {
      pointLedgerEntry: { deleteMany: vi.fn().mockResolvedValue({ count: 12 }) },
      medalUnlock: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      userProgress: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      progressionSettings: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prismaMock.$transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));
    return tx;
  }

  it("deletes the ledger, the unlocks and the cache for that collector only", async () => {
    const tx = runTransaction();

    await expect(purgeProgressionLedger("user-1")).resolves.toEqual({ deletedEntries: 12, deletedUnlocks: 3 });
    for (const call of [tx.pointLedgerEntry.deleteMany, tx.medalUnlock.deleteMany, tx.userProgress.deleteMany]) {
      expect(call).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    }
  });

  it("resets the celebration watermark so the way back up is celebrated again", async () => {
    const tx = runTransaction();

    await purgeProgressionLedger("user-1");
    expect(tx.progressionSettings.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { lastCelebratedRankIndex: 0 },
    });
  });
});

describe("getWelcomeCelebrationContent", () => {
  it("offers the welcome to a migrated history that has never celebrated anything", async () => {
    prismaMock.progressionSettings.findUnique.mockResolvedValue({ lastCelebratedRankIndex: 0 });
    prismaMock.pointLedgerEntry.findFirst.mockResolvedValue({ id: "entry-1" });
    prismaMock.userProgress.findUnique.mockResolvedValue({ highestRankIndex: 4 });
    prismaMock.medalUnlock.count.mockResolvedValue(7);

    await expect(getWelcomeCelebrationContent("user-1")).resolves.toMatchObject({ rankIndex: 4, medalCount: 7 });
    expect(prismaMock.pointLedgerEntry.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", source: "BACKFILL", voidedAt: null },
      select: { id: true },
    });
  });

  it("offers nothing once any celebration has been claimed", async () => {
    prismaMock.progressionSettings.findUnique.mockResolvedValue({ lastCelebratedRankIndex: 2 });

    await expect(getWelcomeCelebrationContent("user-1")).resolves.toBeNull();
    expect(prismaMock.pointLedgerEntry.findFirst).not.toHaveBeenCalled();
  });

  it("offers nothing to a history that came in through the app rather than the migration", async () => {
    prismaMock.progressionSettings.findUnique.mockResolvedValue({ lastCelebratedRankIndex: 0 });
    prismaMock.pointLedgerEntry.findFirst.mockResolvedValue(null);

    await expect(getWelcomeCelebrationContent("user-1")).resolves.toBeNull();
  });
});

describe("getProgressionShellState", () => {
  it("answers both shell facts out of one settings read", async () => {
    prismaMock.progressionSettings.findUnique.mockResolvedValue({
      hideProgression: false,
      lastCelebratedRankIndex: 0,
    });
    prismaMock.pointLedgerEntry.findFirst.mockResolvedValue({ id: "entry-1" });
    prismaMock.userProgress.findUnique.mockResolvedValue({ highestRankIndex: 4 });
    prismaMock.medalUnlock.count.mockResolvedValue(7);

    await expect(getProgressionShellState("user-1")).resolves.toEqual({
      hideProgression: false,
      welcomeCelebrationPending: true,
    });
    expect(prismaMock.progressionSettings.findUnique).toHaveBeenCalledTimes(1);
  });

  it("spends nothing on the welcome probe while the layer is hidden", async () => {
    prismaMock.progressionSettings.findUnique.mockResolvedValue({
      hideProgression: true,
      lastCelebratedRankIndex: 0,
    });

    await expect(getProgressionShellState("user-1")).resolves.toEqual({
      hideProgression: true,
      welcomeCelebrationPending: false,
    });
    expect(prismaMock.pointLedgerEntry.findFirst).not.toHaveBeenCalled();
  });
});
