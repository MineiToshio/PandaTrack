import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatus } from "../../../../../generated/prisma/client";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findMany: vi.fn() },
    paymentAllocation: { findMany: vi.fn() },
    storeAccountAdjustmentLine: { groupBy: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { computeRestCeilingMinor, getAssignableOrdersByStore } from "../storePaymentAssignableOrdersQueries";

/**
 * The "Resto del pedido" ceiling. The rule this pins down is that it keys off ARITHMETIC, never off
 * how many products an order has: `resolveBasePagableMinor` reads `unitPrice` before it falls back
 * to the order total, so a single-product order with a price plus shipping already has a base
 * smaller than its total and would strand its shipping outside every reachable ceiling without it.
 */
describe("computeRestCeilingMinor", () => {
  it("is 0 when the products' bases add up to the whole assignable balance", () => {
    expect(
      computeRestCeilingMinor({
        assignableMinor: 10000,
        items: [
          { basePagableMinor: 6000, allocatedMinor: 0 },
          { basePagableMinor: 4000, allocatedMinor: 0 },
        ],
      }),
    ).toBe(0);
  });

  it("opens the rest line for a SINGLE product with a price plus shipping", () => {
    // Unit price 100.00 on an order that cost 118.00 — the 18.00 of shipping has nowhere else to go.
    expect(
      computeRestCeilingMinor({ assignableMinor: 11800, items: [{ basePagableMinor: 10000, allocatedMinor: 0 }] }),
    ).toBe(1800);
  });

  it("opens the rest line across several products that under-cover their order", () => {
    expect(
      computeRestCeilingMinor({
        assignableMinor: 10000,
        items: [
          { basePagableMinor: 3000, allocatedMinor: 0 },
          { basePagableMinor: 2000, allocatedMinor: 0 },
        ],
      }),
    ).toBe(5000);
  });

  it("closes the rest line when a product has no price, because it can absorb the whole order", () => {
    expect(
      computeRestCeilingMinor({ assignableMinor: 10000, items: [{ basePagableMinor: null, allocatedMinor: 0 }] }),
    ).toBe(0);
  });

  it("counts only what a product still has left of its base", () => {
    expect(
      computeRestCeilingMinor({ assignableMinor: 4000, items: [{ basePagableMinor: 6000, allocatedMinor: 5000 }] }),
    ).toBe(3000);
  });

  it("never lets an over-allocated product borrow ceiling from its siblings", () => {
    expect(
      computeRestCeilingMinor({
        assignableMinor: 5000,
        items: [
          { basePagableMinor: 1000, allocatedMinor: 4000 },
          { basePagableMinor: 2000, allocatedMinor: 0 },
        ],
      }),
    ).toBe(3000);
  });

  it("opens the rest line for an order with no products at all", () => {
    expect(computeRestCeilingMinor({ assignableMinor: 7500, items: [] })).toBe(7500);
  });
});

/**
 * MAJOR F6 (eighth-consumer audit, 2026-08-20 review): the per-order `assignableMinor` this query
 * offers the store payment sheet used to be gross (`totalCost - allocatedAmountMinor`), never
 * subtracting a `StoreAccountAdjustmentLine` written off against the order. The collector could be
 * offered a balance to fill in that a store reconciliation had already written down. Per-ITEM bases
 * stay gross on purpose (items are not adjustment-aware by design); only the order-level figure goes
 * net.
 */
describe("getAssignableOrdersByStore reads the net balance (F6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
  });

  function orderRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "order-1",
      humanReadableId: "ORD-20260801-01",
      orderDate: new Date("2026-08-01T00:00:00.000Z"),
      currencyCode: "USD",
      status: OrderStatus.OPEN,
      totalCost: 10000,
      allocatedAmountMinor: 0,
      items: [{ id: "item-1", name: "Figure", unitPrice: 10000, quantity: 1, paidDeclaredAt: null }],
      ...overrides,
    };
  }

  /**
   * Red-first: against the pre-fix code (gross `totalCost - allocatedAmountMinor`), this order's
   * offered `assignableMinor` came back `10000` (the full total), not `7000`, because the gross
   * figure never saw the 3000 written off in the store reconciliation. Captured failure (pre-fix):
   *   expect(received).toBe(expected) // Object.is equality
   *   Expected: 7000
   *   Received: 10000
   */
  it("nets a StoreAccountAdjustmentLine out of the offered order-level amount, dropping it below the gross remainder", async () => {
    prismaMock.order.findMany.mockResolvedValue([orderRow()]);
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([
      { orderId: "order-1", _sum: { amountMinor: 3000 } },
    ]);

    const [order] = await getAssignableOrdersByStore("user-1", "store-1");

    expect(order.assignableMinor).toBe(7000); // not 10000
  });

  it("drops an order from the list entirely once it is written off down to zero, even though it is still gross-unpaid", async () => {
    prismaMock.order.findMany.mockResolvedValue([orderRow()]);
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([
      { orderId: "order-1", _sum: { amountMinor: 10000 } },
    ]);

    const orders = await getAssignableOrdersByStore("user-1", "store-1");

    expect(orders).toEqual([]);
  });

  it("keeps the per-item base gross: an item's own basePagableMinor is unaffected by the order-level write-off", async () => {
    prismaMock.order.findMany.mockResolvedValue([orderRow()]);
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([
      { orderId: "order-1", _sum: { amountMinor: 3000 } },
    ]);

    const [order] = await getAssignableOrdersByStore("user-1", "store-1");

    expect(order.items[0].basePagableMinor).toBe(10000); // still the item's own gross base
  });
});
