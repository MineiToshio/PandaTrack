import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { deriveItemizedTotal, reorderOrderItems, shouldShowDiscrepancyModal } from "../orderItemMutations";

// Mirrors POSITION_SHIFT_OFFSET in orderItemMutations: phase 1 moves every reordered item above
// the final 1..N range so the two-phase renumber never trips @@unique([orderId, position]).
const POSITION_SHIFT_OFFSET = 1_000_000;

type ReorderTx = {
  orderItem: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function makeReorderTx(existingIds: string[]): ReorderTx {
  return {
    orderItem: {
      findMany: vi.fn().mockResolvedValue(existingIds.map((id) => ({ id }))),
      updateMany: vi.fn().mockResolvedValue({ count: existingIds.length }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("reorderOrderItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renumbers items in two collision-safe phases (shift out, then write finals)", async () => {
    const tx = makeReorderTx(["a", "b", "c"]);
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));

    const result = await reorderOrderItems("order-1", "user-1", ["c", "a", "b"]);

    expect(result).toEqual({ ok: true });
    // Phase 1: a single scoped updateMany vacates the final range before any per-row write.
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", userId: "user-1", id: { in: ["c", "a", "b"] } },
      data: { position: { increment: POSITION_SHIFT_OFFSET } },
    });
    // Phase 2: final consecutive positions in the requested order.
    expect(tx.orderItem.update).toHaveBeenCalledWith({ where: { id: "c" }, data: { position: 1 } });
    expect(tx.orderItem.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { position: 2 } });
    expect(tx.orderItem.update).toHaveBeenCalledWith({ where: { id: "b" }, data: { position: 3 } });
    // Ordering guarantee: the shift runs before every final write.
    const shiftOrder = tx.orderItem.updateMany.mock.invocationCallOrder[0];
    const firstFinalWrite = Math.min(...tx.orderItem.update.mock.invocationCallOrder);
    expect(shiftOrder).toBeLessThan(firstFinalWrite);
  });

  it("rejects and writes nothing when an id does not belong to the order", async () => {
    const tx = makeReorderTx(["a", "b"]);
    prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));

    const result = await reorderOrderItems("order-1", "user-1", ["a", "x"]);

    expect(result).toEqual({ ok: false, error: "ITEM_NOT_FOUND" });
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    expect(tx.orderItem.update).not.toHaveBeenCalled();
  });
});

describe("deriveItemizedTotal", () => {
  it("returns null when no items have a unit price", () => {
    const items = [
      { quantity: 2, unitPrice: null },
      { quantity: 1, unitPrice: null },
    ];
    expect(deriveItemizedTotal(items)).toBeNull();
  });

  it("returns null for an empty items array", () => {
    expect(deriveItemizedTotal([])).toBeNull();
  });

  it("sums quantity × unitPrice for all priced items", () => {
    const items = [
      { quantity: 2, unitPrice: 2550 },
      { quantity: 1, unitPrice: 1000 },
    ];
    expect(deriveItemizedTotal(items)).toBe(6100);
  });

  it("excludes items with null unitPrice from the sum", () => {
    const items = [
      { quantity: 2, unitPrice: 2550 },
      { quantity: 1, unitPrice: null },
    ];
    expect(deriveItemizedTotal(items)).toBe(5100);
  });

  it("includes items with unitPrice of 0 (free items)", () => {
    const items = [
      { quantity: 1, unitPrice: 0 },
      { quantity: 2, unitPrice: 1000 },
    ];
    expect(deriveItemizedTotal(items)).toBe(2000);
  });

  it("uses integer arithmetic with no floating-point drift", () => {
    const items = [
      { quantity: 3, unitPrice: 3333 },
      { quantity: 3, unitPrice: 3334 },
    ];
    expect(deriveItemizedTotal(items)).toBe(20001);
  });
});

describe("shouldShowDiscrepancyModal", () => {
  it("returns false when items array is empty", () => {
    expect(shouldShowDiscrepancyModal([], 10000)).toBe(false);
  });

  it("returns false when any item lacks a unitPrice", () => {
    const items = [
      { quantity: 1, unitPrice: 5000 },
      { quantity: 1, unitPrice: null },
    ];
    expect(shouldShowDiscrepancyModal(items, 5000)).toBe(false);
  });

  it("returns false when itemizedTotal equals totalCost", () => {
    const items = [
      { quantity: 2, unitPrice: 2500 },
      { quantity: 1, unitPrice: 5000 },
    ];
    expect(shouldShowDiscrepancyModal(items, 10000)).toBe(false);
  });

  it("returns true when all items have unitPrice and totals differ", () => {
    const items = [
      { quantity: 2, unitPrice: 2500 },
      { quantity: 1, unitPrice: 4000 },
    ];
    // itemizedTotal = 9000, totalCost = 10000
    expect(shouldShowDiscrepancyModal(items, 10000)).toBe(true);
  });

  it("treats unitPrice of 0 as a valid price (all priced)", () => {
    const items = [
      { quantity: 1, unitPrice: 0 },
      { quantity: 1, unitPrice: 5000 },
    ];
    // itemizedTotal = 5000, totalCost = 6000 → show modal
    expect(shouldShowDiscrepancyModal(items, 6000)).toBe(true);
  });
});
