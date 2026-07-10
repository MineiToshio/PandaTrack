import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    delivery: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { flagDeliveriesForFxReconciliation } from "../deliveryMutations";

describe("flagDeliveriesForFxReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // updateMany returns a placeholder query; the function passes both into $transaction([...]).
    prismaMock.delivery.updateMany.mockReturnValue({ __op: "updateMany" });
    prismaMock.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
  });

  it("flags every delivery whose currency differs from the new base", async () => {
    await flagDeliveriesForFxReconciliation("user-1", "USD");

    expect(prismaMock.delivery.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", currencyCode: { not: "USD" } },
      data: { needsExchangeRateUpdate: true },
    });
  });

  it("clears the flag on deliveries that already match the new base currency", async () => {
    await flagDeliveriesForFxReconciliation("user-1", "USD");

    expect(prismaMock.delivery.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", currencyCode: "USD" },
      data: { needsExchangeRateUpdate: false },
    });
  });

  it("runs both updates inside a single transaction", async () => {
    await flagDeliveriesForFxReconciliation("user-1", "EUR");

    expect(prismaMock.delivery.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledWith([{ __op: "updateMany" }, { __op: "updateMany" }]);
  });

  it("uses the caller transaction client when provided, without opening its own", async () => {
    const tx = { delivery: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };

    await flagDeliveriesForFxReconciliation("user-1", "USD", tx as never);

    expect(tx.delivery.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
