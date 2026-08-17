import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { deleteOrder } from "../orderMutations";

/**
 * D3 — deleting an order must not leave an orphan `StorePayment` behind.
 *
 * `getStoreDebtByCurrency` sums `StorePayment.amount`, not allocations, so a payment left with zero
 * declarations keeps counting as money paid to the store forever, and the store's debt reads
 * permanently low with nothing on screen to explain it. The old rule ("this payment has exactly one
 * declaration and its amount equals the payment's") matched NOTHING once a payment could be broken
 * down across an order's products, so every such payment survived as exactly that orphan.
 */

type AllocationFixture = { amountMinor: number; paymentId: string; paymentTotal: number };

function makeDeleteOrderTx(
  overrides: {
    orderExists?: boolean;
    liveLink?: boolean;
    /** This order's own allocations. */
    allocations?: AllocationFixture[];
    /** Allocations of the same payments belonging to OTHER orders. */
    otherOrdersAllocations?: Array<{ paymentId: string; orderId: string }>;
  } = {},
) {
  const { orderExists = true, liveLink = false, allocations = [], otherOrdersAllocations = [] } = overrides;

  return {
    order: {
      findFirst: vi.fn().mockResolvedValue(orderExists ? { id: "order-1" } : null),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    deliveryOrderItem: {
      findFirst: vi.fn().mockResolvedValue(liveLink ? { deliveryId: "delivery-1" } : null),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    paymentAllocation: {
      // Two different questions on the same method, told apart by the `where`: this order's own
      // lines, versus the same payments' lines belonging to somebody else.
      findMany: vi.fn().mockImplementation((args: { where: { orderId?: unknown } }) => {
        const isOtherOrders =
          args.where.orderId !== undefined && typeof args.where.orderId === "object" && args.where.orderId !== null;
        if (isOtherOrders) return Promise.resolve(otherOrdersAllocations);
        return Promise.resolve(
          allocations.map((allocation) => ({
            amountMinor: allocation.amountMinor,
            paymentId: allocation.paymentId,
            payment: { amount: allocation.paymentTotal },
          })),
        );
      }),
      groupBy: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    storePayment: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    orderPayment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    orderHistory: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    orderItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
}

function runTx(tx: unknown): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

describe("deleteOrder cleans up the payments it orphans (D3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a payment of 65.00 whose THREE lines on this order cover it in full", async () => {
    // 32.50 + 20.00 + 12.50 = 65.00, all on this order. Nothing else claims the transfer, so it
    // leaves with the order it was raised for.
    const tx = makeDeleteOrderTx({
      allocations: [
        { amountMinor: 3250, paymentId: "payment-1", paymentTotal: 6500 },
        { amountMinor: 2000, paymentId: "payment-1", paymentTotal: 6500 },
        { amountMinor: 1250, paymentId: "payment-1", paymentTotal: 6500 },
      ],
    });
    runTx(tx);

    const result = await deleteOrder("order-1", "user-1");

    expect(result).toEqual({ ok: true });
    expect(tx.storePayment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["payment-1"] }, userId: "user-1" },
    });
  });

  it("still deletes a single-line payment that covers its own amount (the N=1 case, unchanged)", async () => {
    const tx = makeDeleteOrderTx({
      allocations: [{ amountMinor: 6500, paymentId: "payment-1", paymentTotal: 6500 }],
    });
    runTx(tx);

    await deleteOrder("order-1", "user-1");

    expect(tx.storePayment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["payment-1"] }, userId: "user-1" },
    });
  });

  it("leaves a partly claimed payment alive, unassigned, because the transfer did happen", async () => {
    // 50.00 declared out of a 65.00 transfer, no other order involved. Deliberately DIFFERENT from
    // `deleteOrderPayment`, which deletes it: there the collector says "this money never existed",
    // here they say "this order never existed". The 65.00 stays reachable from the store detail.
    const tx = makeDeleteOrderTx({
      allocations: [
        { amountMinor: 3000, paymentId: "payment-1", paymentTotal: 6500 },
        { amountMinor: 2000, paymentId: "payment-1", paymentTotal: 6500 },
      ],
    });
    runTx(tx);

    await deleteOrder("order-1", "user-1");

    expect(tx.storePayment.deleteMany).not.toHaveBeenCalled();
  });

  it("leaves a payment alive when another order still claims part of it", async () => {
    const tx = makeDeleteOrderTx({
      allocations: [
        { amountMinor: 3250, paymentId: "payment-1", paymentTotal: 6500 },
        { amountMinor: 1250, paymentId: "payment-1", paymentTotal: 6500 },
      ],
      otherOrdersAllocations: [{ paymentId: "payment-1", orderId: "order-2" }],
    });
    runTx(tx);

    await deleteOrder("order-1", "user-1");

    expect(tx.storePayment.deleteMany).not.toHaveBeenCalled();
  });

  it("sorts one payment from another instead of judging them as a batch", async () => {
    // Two transfers on the same dying order: one fully claimed by it, one only half. Only the first
    // may go, so the decision has to be per payment and not per order.
    const tx = makeDeleteOrderTx({
      allocations: [
        { amountMinor: 3250, paymentId: "payment-full", paymentTotal: 6500 },
        { amountMinor: 3250, paymentId: "payment-full", paymentTotal: 6500 },
        { amountMinor: 1000, paymentId: "payment-partial", paymentTotal: 5000 },
      ],
    });
    runTx(tx);

    await deleteOrder("order-1", "user-1");

    expect(tx.storePayment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["payment-full"] }, userId: "user-1" },
    });
  });
});
