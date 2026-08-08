import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import { cancelOrder } from "../orderMutations";

type TxOverrides = { orderExists?: boolean; hasLiveDeliveryLink?: boolean };

function makeTx({ orderExists = true, hasLiveDeliveryLink = false }: TxOverrides = {}) {
  return {
    order: {
      findFirst: vi.fn().mockResolvedValue(orderExists ? { id: "order-1" } : null),
      update: vi.fn().mockResolvedValue({ id: "order-1" }),
    },
    deliveryOrderItem: {
      findFirst: vi.fn().mockResolvedValue(hasLiveDeliveryLink ? { deliveryId: "delivery-1" } : null),
    },
    paymentAllocation: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    orderHistory: {
      create: vi.fn().mockResolvedValue({ id: "history-1" }),
    },
  };
}

function runWith(tx: ReturnType<typeof makeTx>) {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

describe("cancelOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats the money as lost by default: cancels the order without touching the declarations", async () => {
    const tx = makeTx();
    runWith(tx);

    const result = await cancelOrder("order-1", "user-1", "changed my mind");

    expect(result).toEqual({ ok: true });
    // Single status update, no allocation deletion and no cache reset: the declarations stay
    // pinned to the cancelled order, which is what makes the money readable as sunk.
    expect(tx.order.update).toHaveBeenCalledTimes(1);
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.CANCELLED, cancellationReason: "changed my mind" },
    });
    expect(tx.paymentAllocation.deleteMany).not.toHaveBeenCalled();
    expect(tx.orderHistory.create).toHaveBeenCalledTimes(1);
  });

  it("drops the declarations and zeroes the allocation cache when paymentsChoice is credit", async () => {
    const tx = makeTx();
    runWith(tx);

    const result = await cancelOrder("order-1", "user-1", null, "credit");

    expect(result).toEqual({ ok: true });
    // Only the declarations go: the store payments themselves are never deleted by a cancellation,
    // which is what leaves the money available as credit with that store.
    expect(tx.paymentAllocation.deleteMany).toHaveBeenCalledWith({ where: { orderId: "order-1", userId: "user-1" } });
    // First update flips status; second update zeroes the allocation cache the orders list reads.
    expect(tx.order.update).toHaveBeenCalledTimes(2);
    expect(tx.order.update).toHaveBeenNthCalledWith(1, {
      where: { id: "order-1" },
      data: { status: OrderStatus.CANCELLED, cancellationReason: null },
    });
    expect(tx.order.update).toHaveBeenNthCalledWith(2, {
      where: { id: "order-1" },
      data: { allocatedAmountMinor: 0 },
    });
    expect(tx.orderHistory.create).toHaveBeenCalledTimes(1);
  });

  it("returns ORDER_NOT_FOUND without mutating anything", async () => {
    const tx = makeTx({ orderExists: false });
    runWith(tx);

    const result = await cancelOrder("order-1", "user-1", null, "credit");

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_FOUND" });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses when the order still has live delivery links, even on credit", async () => {
    const tx = makeTx({ hasLiveDeliveryLink: true });
    runWith(tx);

    const result = await cancelOrder("order-1", "user-1", null, "credit");

    expect(result).toEqual({ ok: false, error: "HAS_LIVE_DELIVERY_LINKS" });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.paymentAllocation.deleteMany).not.toHaveBeenCalled();
  });
});
