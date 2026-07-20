import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { updateMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { flagOrdersForFxReconciliation } from "../orderMutations";
import { countOrdersPendingFxReconciliation } from "../orderQueries";

describe("flagOrdersForFxReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // updateMany returns a placeholder query; the function passes both into $transaction([...]).
    prismaMock.order.updateMany.mockReturnValue({ __op: "updateMany" });
    prismaMock.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
  });

  it("flags every order whose currency differs from the new base", async () => {
    await flagOrdersForFxReconciliation("user-1", "USD");

    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", currencyCode: { not: "USD" } },
      data: { needsExchangeRateUpdate: true },
    });
  });

  it("clears the flag on orders that already match the new base currency", async () => {
    await flagOrdersForFxReconciliation("user-1", "USD");

    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", currencyCode: "USD" },
      data: { needsExchangeRateUpdate: false },
    });
  });

  it("runs both updates inside a single transaction", async () => {
    await flagOrdersForFxReconciliation("user-1", "EUR");

    expect(prismaMock.order.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledWith([{ __op: "updateMany" }, { __op: "updateMany" }]);
  });
});

describe("countOrdersPendingFxReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 without querying when there is no base currency", async () => {
    const result = await countOrdersPendingFxReconciliation("user-1", null);

    expect(result).toBe(0);
    expect(prismaMock.order.count).not.toHaveBeenCalled();
  });

  it("counts only non-cancelled foreign-currency orders flagged for reconciliation", async () => {
    prismaMock.order.count.mockResolvedValue(3);

    const result = await countOrdersPendingFxReconciliation("user-1", "USD");

    expect(result).toBe(3);
    expect(prismaMock.order.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        needsExchangeRateUpdate: true,
        status: { not: "CANCELLED" },
        currencyCode: { not: "USD" },
      },
    });
  });
});
