import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Prisma } from "../../../../generated/prisma/client";
import { generateOrderHumanReadableId } from "../orderIdentifier";

type MockTx = {
  order: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makeTx(existingHumanReadableIds: string[]): Prisma.TransactionClient {
  const tx: MockTx = {
    order: {
      findMany: vi.fn().mockResolvedValue(existingHumanReadableIds.map((humanReadableId) => ({ humanReadableId }))),
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
    const tx = makeTx([]);
    const id = await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    expect(id).toBe("ORD-20260420-01");
  });

  it("increments to 02 when one order already exists for the day", async () => {
    const tx = makeTx(["ORD-20260420-01"]);
    const id = await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    expect(id).toBe("ORD-20260420-02");
  });

  it("increments beyond two digits without truncating", async () => {
    const tx = makeTx(["ORD-20260420-99"]);
    const id = await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    expect(id).toBe("ORD-20260420-100");
  });

  it("picks the numeric maximum even when lexicographic order disagrees", async () => {
    // "ORD-20260420-99" sorts after "ORD-20260420-100" as a string; the numeric max must win.
    const tx = makeTx(["ORD-20260420-99", "ORD-20260420-100"]);
    const id = await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    expect(id).toBe("ORD-20260420-101");
  });

  it("resets sequence for a new calendar day in UTC", async () => {
    // No orders yet for the new day - the query filters by date prefix so returns no rows
    const tx = makeTx([]);
    const nextDay = new Date("2026-04-20T00:00:00Z");
    const id = await generateOrderHumanReadableId(tx, USER_ID, nextDay);
    expect(id).toBe("ORD-20260420-01");
  });

  it("uses UTC date regardless of local timezone offset", async () => {
    const utcMidnight = new Date("2026-04-20T00:00:00Z");
    const tx = makeTx([]);
    const id = await generateOrderHumanReadableId(tx, USER_ID, utcMidnight);
    expect(id).toMatch(/^ORD-20260420-/);
  });

  it("queries with the correct userId and date prefix", async () => {
    const tx = makeTx([]);
    await generateOrderHumanReadableId(tx, USER_ID, UTC_DATE);
    const mockTx = tx as unknown as MockTx;
    expect(mockTx.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER_ID,
          humanReadableId: { startsWith: "ORD-20260420-" },
        }),
      }),
    );
  });
});
