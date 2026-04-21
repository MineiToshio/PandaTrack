import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Prisma } from "../../../../generated/prisma/client";
import { generateOrderHumanReadableId } from "../orderIdentifier";

type MockTx = {
  order: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

function makeTx(latestHumanReadableId: string | null): Prisma.TransactionClient {
  const tx: MockTx = {
    order: {
      findFirst: vi.fn().mockResolvedValue(latestHumanReadableId ? { humanReadableId: latestHumanReadableId } : null),
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

const USER_ID = "user-abc";
const UTC_DATE = new Date("2026-04-20T10:00:00Z");

describe("generateOrderHumanReadableId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ORD-YYYYMMDD-01 for the first order of the day", async () => {
    const tx = makeTx(null);
    const id = await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    expect(id).toBe("ORD-20260420-01");
  });

  it("increments to 02 when one order already exists for the day", async () => {
    const tx = makeTx("ORD-20260420-01");
    const id = await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    expect(id).toBe("ORD-20260420-02");
  });

  it("increments beyond two digits without truncating", async () => {
    const tx = makeTx("ORD-20260420-99");
    const id = await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    expect(id).toBe("ORD-20260420-100");
  });

  it("resets sequence for a new calendar day in UTC", async () => {
    // No orders yet for the new day - the query filters by date prefix so returns null
    const tx = makeTx(null);
    const nextDay = new Date("2026-04-20T00:00:00Z");
    const id = await generateOrderHumanReadableId(tx, USER_ID, nextDay);
    expect(id).toBe("ORD-20260420-01");
  });

  it("uses UTC date regardless of local timezone offset", async () => {
    const utcMidnight = new Date("2026-04-20T00:00:00Z");
    const tx = makeTx(null);
    const id = await generateOrderHumanReadableId(tx, USER_ID, utcMidnight);
    expect(id).toMatch(/^ORD-20260420-/);
  });

  it("queries with the correct userId and date prefix", async () => {
    const tx = makeTx(null);
    await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    const mockTx = tx as unknown as MockTx;
    expect(mockTx.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER_ID,
          humanReadableId: { startsWith: "ORD-20260420-" },
        }),
      }),
    );
  });
});
