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
    await applyOrderExchangeRates("user-1", "PEN", [
      { orderId: "order-1", exchangeRate: 1.5 },
      { orderId: "order-2", exchangeRate: 2 },
    ]);

    for (const call of prismaMock.order.updateMany.mock.calls) {
      expect(call[0].where.userId).toBe("user-1");
    }
  });

  it("stamps the confirmed rate with the base it was entered against, which is what ends the pending state", async () => {
    await applyOrderExchangeRates("user-1", "PEN", [{ orderId: "order-1", exchangeRate: 3.25 }]);

    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1"] }, userId: "user-1" },
      data: { exchangeRate: 3.25, exchangeRateBaseCode: "PEN" },
    });
  });

  it("records no base for a rate confirmed while the collector has no base currency", async () => {
    await applyOrderExchangeRates("user-1", null, [{ orderId: "order-1", exchangeRate: 3.25 }]);

    expect(prismaMock.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { exchangeRate: 3.25, exchangeRateBaseCode: null } }),
    );
  });

  it("runs every statement in a single transaction and returns the total updated count", async () => {
    const updatedCount = await applyOrderExchangeRates("user-1", "PEN", [
      { orderId: "order-1", exchangeRate: 1.5 },
      { orderId: "order-2", exchangeRate: 2 },
    ]);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledWith([{ __op: "updateMany" }, { __op: "updateMany" }]);
    expect(updatedCount).toBe(2);
  });

  it("sends one statement per distinct rate rather than one per order", async () => {
    // The reconciliation screen assigns one rate per currency pair, so a whole collection collapses
    // to a couple of statements. One per order is what used to time the bulk apply out.
    prismaMock.$transaction.mockResolvedValue([{ count: 3 }, { count: 2 }]);

    const updatedCount = await applyOrderExchangeRates("user-1", "PEN", [
      { orderId: "order-1", exchangeRate: 3.7 },
      { orderId: "order-2", exchangeRate: 3.7 },
      { orderId: "order-3", exchangeRate: 4.1 },
      { orderId: "order-4", exchangeRate: 3.7 },
      { orderId: "order-5", exchangeRate: 4.1 },
    ]);

    expect(prismaMock.order.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.order.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ["order-1", "order-2", "order-4"] }, userId: "user-1" },
      data: { exchangeRate: 3.7, exchangeRateBaseCode: "PEN" },
    });
    expect(prismaMock.order.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["order-3", "order-5"] }, userId: "user-1" },
      data: { exchangeRate: 4.1, exchangeRateBaseCode: "PEN" },
    });
    expect(updatedCount).toBe(5);
  });

  it("keeps a whole collection of one currency pair to a single statement", async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 500 }]);

    const updates = Array.from({ length: 500 }, (_, index) => ({
      orderId: `order-${index}`,
      exchangeRate: 3.7,
    }));

    const updatedCount = await applyOrderExchangeRates("user-1", "PEN", updates);

    expect(prismaMock.order.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.order.updateMany.mock.calls[0][0].where.id.in).toHaveLength(500);
    expect(updatedCount).toBe(500);
  });

  it("lets the last rate win for a repeated order, without writing it twice", async () => {
    // A statement per update let the later write land on top; merging must not resurrect the first.
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }]);

    await applyOrderExchangeRates("user-1", "PEN", [
      { orderId: "order-1", exchangeRate: 3.7 },
      { orderId: "order-1", exchangeRate: 4.1 },
    ]);

    expect(prismaMock.order.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1"] }, userId: "user-1" },
      data: { exchangeRate: 4.1, exchangeRateBaseCode: "PEN" },
    });
  });

  it("opens no transaction when there is nothing to apply", async () => {
    const updatedCount = await applyOrderExchangeRates("user-1", "PEN", []);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(updatedCount).toBe(0);
  });
});
