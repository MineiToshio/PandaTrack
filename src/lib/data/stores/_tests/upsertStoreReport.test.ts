import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    store: { findUniqueOrThrow: vi.fn() },
    storeReport: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    txMock,
    prismaMock: {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { upsertStoreReport } from "../storeGovernanceMutations";

const INPUT = { storeId: "store-1", userId: "user-1", reason: "SPAM" as const, details: "New concern" };

beforeEach(() => {
  vi.clearAllMocks();
  txMock.store.findUniqueOrThrow.mockResolvedValue({ id: "store-1" });
});

describe("upsertStoreReport re-report path (AC-04-12, BR-04-14)", () => {
  it("creates a new report when the user has no OPEN report (e.g. the prior one was resolved)", async () => {
    // After a resolve/dismiss the prior report is REVIEWED/DISMISSED, so the OPEN lookup finds none.
    txMock.storeReport.findFirst.mockResolvedValue(null);
    txMock.storeReport.create.mockResolvedValue({
      id: "report-new",
      reason: "SPAM",
      details: "New concern",
      status: "OPEN",
      updatedAt: new Date(),
    });

    const result = await upsertStoreReport(INPUT);

    expect(txMock.storeReport.create).toHaveBeenCalledTimes(1);
    expect(txMock.storeReport.update).not.toHaveBeenCalled();
    expect(result.status).toBe("OPEN");
  });

  it("updates the existing OPEN report instead of creating a second one (one open report per user)", async () => {
    txMock.storeReport.findFirst.mockResolvedValue({ id: "report-open" });
    txMock.storeReport.update.mockResolvedValue({
      id: "report-open",
      reason: "SPAM",
      details: "New concern",
      status: "OPEN",
      updatedAt: new Date(),
    });

    await upsertStoreReport(INPUT);

    expect(txMock.storeReport.update).toHaveBeenCalledTimes(1);
    expect(txMock.storeReport.create).not.toHaveBeenCalled();
  });
});
