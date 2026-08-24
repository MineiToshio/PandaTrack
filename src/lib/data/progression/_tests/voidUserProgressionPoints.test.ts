import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POINT_RULE_KEYS, PROGRESSION_ENTITY_TYPES } from "../pointRules";
import { voidUserProgressionPoints } from "../progressionMutations";
import { eligibleStore, ledgerEntry, makeFakeDb, USER_ID, type FakeWorld } from "./progressionFixtures";

const CREDITED_WORLD: FakeWorld = {
  stores: [eligibleStore("store-1")],
  orders: [{ id: "order-1", storeId: "store-1" }],
  progress: { highestRankIndex: 4 },
  ledger: [
    ledgerEntry({
      ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
      entityType: PROGRESSION_ENTITY_TYPES.ORDER,
      entityId: "order-1",
      points: 5,
    }),
  ],
};

/** Runs the void against a fake world, wiring `$transaction` to hand the callback the fake client. */
function arrange(world: FakeWorld = CREDITED_WORLD) {
  const fake = makeFakeDb(world);
  prismaMock.$transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work(fake.db));
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("voidUserProgressionPoints", () => {
  it("marks the entries, re-derives the total and writes the trail together (AC-12-16)", async () => {
    const { db, auditEntries, upserts, voidUpdates } = arrange();

    const result = await voidUserProgressionPoints({
      actorId: "admin-1",
      targetUserId: USER_ID,
      reason: "Points farmed through a self-created store",
    });

    expect(result).toEqual({ ok: true, voidedEntryCount: 1, maturedPoints: 0, highestRankIndex: 4 });

    // The reversal marks rather than deletes, so the answer to "why did my points change" survives.
    expect(db.pointLedgerEntry.updateMany).toHaveBeenCalledTimes(1);
    expect(voidUpdates[0]).toMatchObject({
      voidedReason: "Points farmed through a self-created store",
      voidedByUserId: "admin-1",
    });
    expect(voidUpdates[0]?.voidedAt).toBeInstanceOf(Date);

    // The recomputed figures are persisted, and the rank already reached is not taken back.
    expect(upserts.at(-1)).toMatchObject({ maturedPoints: 0, highestRankIndex: 4 });

    // Actor, action, target and reason, on the same client, so it commits with the void.
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({
      actorId: "admin-1",
      action: "progression.void",
      targetType: "user",
      targetId: USER_ID,
      reason: "Points farmed through a self-created store",
    });
  });

  it("writes no negative entry (BR-12-05)", async () => {
    const { db } = arrange();

    await voidUserProgressionPoints({ actorId: "admin-1", targetUserId: USER_ID, reason: "Investigated and reversed" });

    // The only write to the ledger is the marking; nothing creates a compensating row.
    expect(db.pointLedgerEntry.updateMany).toHaveBeenCalledTimes(1);
  });

  it.each(["", "   "])("refuses a blank reason before touching anything", async (reason) => {
    const { db } = arrange();

    await expect(voidUserProgressionPoints({ actorId: "admin-1", targetUserId: USER_ID, reason })).resolves.toEqual({
      ok: false,
      error: "VOID_REASON_REQUIRED",
    });
    expect(db.pointLedgerEntry.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an unknown target before touching anything", async () => {
    const { db } = arrange();

    await expect(
      voidUserProgressionPoints({ actorId: "admin-1", targetUserId: "nobody", reason: "Investigated" }),
    ).resolves.toEqual({ ok: false, error: "USER_NOT_FOUND" });
    expect(db.pointLedgerEntry.updateMany).not.toHaveBeenCalled();
  });

  it("rolls the whole void back when the trail cannot be written", async () => {
    const { db } = arrange();
    db.adminAuditLog.create.mockRejectedValueOnce(new Error("audit table unavailable"));

    const result = await voidUserProgressionPoints({
      actorId: "admin-1",
      targetUserId: USER_ID,
      reason: "Investigated",
    });

    expect(result).toEqual({ ok: false, error: "AUDIT_WRITE_FAILED" });
    // The refusal must reach the caller by THROWING out of the transaction: a plain return would
    // have committed the void, leaving points reversed with no record of who did it.
    await expect(prismaMock.$transaction.mock.results.at(-1)?.value).rejects.toThrow();
  });

  it("lets an unrelated failure propagate instead of reporting it as an audit failure", async () => {
    const { db } = arrange();
    db.pointLedgerEntry.updateMany.mockRejectedValueOnce(new Error("connection reset"));

    await expect(
      voidUserProgressionPoints({ actorId: "admin-1", targetUserId: USER_ID, reason: "Investigated" }),
    ).rejects.toThrow("connection reset");
  });
});
