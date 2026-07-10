import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { applyOrderExchangeRates } from "../orderMutations";

describe("applyOrderExchangeRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.order.updateMany.mockReturnValue({ __op: "updateMany" });
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { count: 1 }]);
  });

  it("scopes every update by userId so a tampered payload cannot touch another user's orders", async () => {
    await applyOrderExchangeRates("user-1", [
      { orderId: "order-1", exchangeRate: 1.5 },
      { orderId: "order-2", exchangeRate: 2 },
    ]);

    expect(prismaMock.order.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "order-1", userId: "user-1" },
      data: { exchangeRate: 1.5, needsExchangeRateUpdate: false },
    });
    expect(prismaMock.order.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "order-2", userId: "user-1" },
      data: { exchangeRate: 2, needsExchangeRateUpdate: false },
    });
  });

  it("clears the pending flag while applying the confirmed rate", async () => {
    await applyOrderExchangeRates("user-1", [{ orderId: "order-1", exchangeRate: 3.25 }]);

    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { exchangeRate: 3.25, needsExchangeRateUpdate: false } }),
    );
  });

  it("runs all updates in a single transaction and returns the total updated count", async () => {
    const updatedCount = await applyOrderExchangeRates("user-1", [
      { orderId: "order-1", exchangeRate: 1.5 },
      { orderId: "order-2", exchangeRate: 2 },
    ]);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledWith([{ __op: "updateMany" }, { __op: "updateMany" }]);
    expect(updatedCount).toBe(2);
  });
});
