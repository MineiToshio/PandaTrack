import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getStoreDebtByCurrencyMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findMany: vi.fn() },
    paymentAllocation: { findMany: vi.fn(), groupBy: vi.fn() },
    storeAccountAdjustmentLine: { groupBy: vi.fn() },
  },
  getStoreDebtByCurrencyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("../storePaymentQueries", () => ({ getStoreDebtByCurrency: getStoreDebtByCurrencyMock }));

import { getPendingProductsByStore } from "../pendingProductsByStoreQueries";

const STORE = {
  id: "store-1",
  slug: "pop-dealer",
  name: "Pop Dealer",
  logoUrl: null,
  sellerType: "RETAILER",
  status: "APPROVED",
};

/** One row in the shape `order.findMany` really returns it for this query. */
function orderRow(
  id: string,
  humanReadableId: string,
  items: Array<{ id: string; name: string; paidDeclaredAt?: Date | null }>,
  overrides: { totalCost?: number; allocatedAmountMinor?: number } = {},
): Record<string, unknown> {
  return {
    id,
    humanReadableId,
    orderDate: new Date("2026-01-05T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "PEN",
    totalCost: overrides.totalCost ?? 5000,
    allocatedAmountMinor: overrides.allocatedAmountMinor ?? 0,
    store: STORE,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: 1,
      unitPrice: 5000,
      deliveryState: "NONE",
      paidDeclaredAt: item.paidDeclaredAt ?? null,
      deliveryItems: [],
    })),
  };
}

describe("getPendingProductsByStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
    prismaMock.paymentAllocation.groupBy.mockResolvedValue([]);
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([]);
    getStoreDebtByCurrencyMock.mockResolvedValue([]);
  });

  /**
   * The store-scoped arrival modal groups the selected products by their source order, so it needs
   * the `PED-*` code on every pending row. Reading it off the item would mean a second query per
   * product; the order is already being selected here.
   */
  it("carries each product's source order code, so a store-scoped selection can group by order", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow("order-1", "PED-001", [{ id: "item-1", name: "Nendoroid Miku" }]),
      orderRow("order-2", "PED-002", [{ id: "item-2", name: "Figma Rem" }]),
    ]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups).toHaveLength(1);
    expect(groups[0].pendingProducts.map((product) => [product.itemId, product.orderHumanReadableId])).toEqual([
      ["item-1", "PED-001"],
      ["item-2", "PED-002"],
    ]);
  });

  /**
   * `StoreDebtEntry` gained `openOrderDebtMinor` alongside the unchanged lifetime `debtMinor`
   * (WO-09): this module trusts whatever `getStoreDebtByCurrency` returns and maps both fields
   * straight through, so a store's row must carry both rather than silently dropping the new one.
   */
  it("maps openOrderDebtMinor alongside debtMinor onto each store's debt entry", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow("order-1", "PED-001", [{ id: "item-1", name: "Nendoroid Miku" }]),
    ]);
    getStoreDebtByCurrencyMock.mockResolvedValue([
      {
        storeId: "store-1",
        currencyCode: "PEN",
        committedMinor: 5000,
        paidMinor: 0,
        debtMinor: 5000,
        lostMinor: 0,
        activeCommittedMinor: 5000,
        activePaidMinor: 0,
        openOrderDebtMinor: 3000,
        unrecordedPaymentsMinor: 0,
        unassignedMinor: 0,
      },
    ]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups[0].debts).toEqual([{ currencyCode: "PEN", debtMinor: 5000, openOrderDebtMinor: 3000 }]);
  });

  it("asks the database for the order code rather than deriving it", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);

    await getPendingProductsByStore("user-1");

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ humanReadableId: true }) }),
    );
  });

  /**
   * The gap this whole surface refuses to close by guessing: money declared against an ORDER, with
   * no product named. 293 such allocations exist in the collector's own data.
   *
   * Asserting it by feeding a `{ orderItemId: null }` row into the per-item fold would prove
   * nothing: the `where` narrows on `orderItemId`, so Prisma could never return that row, and the
   * assert would run against a dead branch and stay green through exactly the "fix" that is feared
   * (a SECOND query bringing the order-level money in and spreading it). So the money is injected
   * through the query the module really does emit for it, and every product must still read zero.
   */
  it("never lets order-level money reach a product's own figure", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow(
        "order-1",
        "PED-001",
        [
          { id: "item-1", name: "Nendoroid Miku" },
          { id: "item-2", name: "Figma Rem" },
        ],
        { totalCost: 60000, allocatedAmountMinor: 50000 },
      ),
    ]);
    prismaMock.paymentAllocation.groupBy.mockResolvedValue([{ orderId: "order-1", _sum: { amountMinor: 50000 } }]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups[0].pendingProducts.map((product) => product.allocatedMinor)).toEqual([0, 0]);
    expect(groups[0].undetailedByOrder).toEqual([
      { orderId: "order-1", humanReadableId: "PED-001", amountMinor: 50000, currencyCode: "PEN" },
    ]);
  });

  it("narrows every allocation read by product, so no query can pull order-level money into the fold", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow("order-1", "PED-001", [{ id: "item-1", name: "Nendoroid Miku" }], {
        totalCost: 60000,
        allocatedAmountMinor: 10000,
      }),
    ]);

    await getPendingProductsByStore("user-1");

    // The per-product read is narrowed to the pending item ids.
    for (const call of prismaMock.paymentAllocation.findMany.mock.calls) {
      expect(call[0].where.orderItemId).toEqual({ in: expect.any(Array) });
    }
    // The order-level read exists, and it is pinned to `orderItemId: null` so its rows can only
    // ever feed the block that NAMES them, never a per-product sum.
    for (const call of prismaMock.paymentAllocation.groupBy.mock.calls) {
      expect(call[0].where.orderItemId).toBeNull();
    }
    expect(prismaMock.paymentAllocation.groupBy).toHaveBeenCalled();
  });

  it("leaves an order that owes nothing out of the undetailed block", async () => {
    // Without the balance filter the block would announce S/ 2.723,60 across 4 fully paid orders
    // against S/ 1.090,60 across 7 that still owe: loudest exactly where nothing is left to solve.
    // And those orders already read as "Saldado" product by product, from their own arithmetic.
    prismaMock.order.findMany.mockResolvedValue([
      orderRow("order-paid", "PED-PAID", [{ id: "item-1", name: "Nendoroid Miku" }], {
        totalCost: 60000,
        allocatedAmountMinor: 60000,
      }),
      orderRow("order-owing", "PED-OWING", [{ id: "item-2", name: "Figma Rem" }], {
        totalCost: 60000,
        allocatedAmountMinor: 10000,
      }),
    ]);
    prismaMock.paymentAllocation.groupBy.mockResolvedValue([
      { orderId: "order-paid", _sum: { amountMinor: 60000 } },
      { orderId: "order-owing", _sum: { amountMinor: 10000 } },
    ]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups[0].undetailedByOrder.map((entry) => entry.humanReadableId)).toEqual(["PED-OWING"]);
    // The BLOCK is what the balance filter governs, and it still does. The READ behind it is now
    // wider on purpose: `orderHasUndetailedMoney` has to be answered for every contributing order,
    // settled ones included, so the field is a fact about the order rather than a fact that happens
    // to be true only where some other rule already outranks it.
    const [groupByCall] = prismaMock.paymentAllocation.groupBy.mock.calls;
    expect(groupByCall[0].where.orderId).toEqual({ in: ["order-paid", "order-owing"] });
  });

  /**
   * MAJOR F6 (eighth-consumer audit, 2026-08-20 review): the same undetailed block above filtered
   * "still owes money" on the GROSS remainder (`totalCost - allocatedAmountMinor`), contradicting the
   * `openOrderDebtMinor` chip rendered right above it on the same screen, which is already net of any
   * `StoreAccountAdjustmentLine`. An order a store reconciliation wrote off in full still read as
   * "owing" here and could show an undetailed-money line for money that no longer represents a debt.
   *
   * Red-first: against the pre-fix gross filter, "order-written-off" (gross remainder 10000, net 0)
   * still passed the `> 0` gate and showed up in `undetailedByOrder`. Captured failure (pre-fix):
   *   expect(received).toEqual(expected)
   *   Expected: []
   *   Received: [{ orderId: 'order-written-off', humanReadableId: 'PED-WRITTEN-OFF', ... }]
   */
  it("nets a StoreAccountAdjustmentLine out of the undetailed block's own balance test, aligning it with the openOrderDebtMinor chip", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow("order-written-off", "PED-WRITTEN-OFF", [{ id: "item-1", name: "Nendoroid Miku" }], {
        totalCost: 60000,
        allocatedAmountMinor: 50000,
      }),
    ]);
    prismaMock.paymentAllocation.groupBy.mockResolvedValue([
      { orderId: "order-written-off", _sum: { amountMinor: 10000 } },
    ]);
    // Fully written off: net balance is 60000 - 50000 - 10000 = 0.
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([
      { orderId: "order-written-off", _sum: { amountMinor: 10000 } },
    ]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups[0].undetailedByOrder).toEqual([]);
  });

  /**
   * D7 in the data layer, and the part that does not announce itself.
   *
   * `PendingProductRow` cannot DERIVE this: it carries the line's own `allocatedMinor` and the
   * order's `orderAllocatedAmountMinor`, but never the sum of the order's item-level lines. And the
   * obvious shortcut, summing the rows on screen, is wrong in a way that is easy to miss: this view
   * lists only PENDING products, so an order with a delivered product would look like it had
   * unattributed money it does not have. Hence a field, computed here.
   */
  it("flags every product of an order that holds money naming no product", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow(
        "order-1",
        "PED-001",
        [
          { id: "item-1", name: "Kingdom 23" },
          { id: "item-2", name: "Kingdom 24" },
        ],
        { totalCost: 24490, allocatedAmountMinor: 21990 },
      ),
    ]);
    prismaMock.paymentAllocation.groupBy.mockResolvedValue([{ orderId: "order-1", _sum: { amountMinor: 19990 } }]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups[0].pendingProducts.map((product) => product.orderHasUndetailedMoney)).toEqual([true, true]);
  });

  it("leaves the flag false on an order whose money is fully attributed to its products", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow(
        "order-1",
        "PED-001",
        [
          { id: "item-1", name: "Kingdom 23" },
          { id: "item-2", name: "Kingdom 24" },
        ],
        { totalCost: 24490, allocatedAmountMinor: 6500 },
      ),
    ]);
    // Every line of this order names a product, so the order-level groupBy returns nothing for it.
    prismaMock.paymentAllocation.groupBy.mockResolvedValue([]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([
      { orderItemId: "item-1", amountMinor: 3250 },
      { orderItemId: "item-2", amountMinor: 3250 },
    ]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups[0].pendingProducts.map((product) => product.orderHasUndetailedMoney)).toEqual([false, false]);
    // And the per-product money still landed, so the fixture is exercising the real fold.
    expect(groups[0].pendingProducts.map((product) => product.allocatedMinor)).toEqual([3250, 3250]);
  });

  it("does not leak one order's unattributed money onto another order's products", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow("order-pozo", "PED-POZO", [{ id: "item-1", name: "Kingdom 23" }], {
        totalCost: 24490,
        allocatedAmountMinor: 19990,
      }),
      orderRow("order-clean", "PED-CLEAN", [{ id: "item-2", name: "Figma Rem" }], {
        totalCost: 6000,
        allocatedAmountMinor: 0,
      }),
    ]);
    prismaMock.paymentAllocation.groupBy.mockResolvedValue([{ orderId: "order-pozo", _sum: { amountMinor: 19990 } }]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups[0].pendingProducts.map((product) => [product.orderId, product.orderHasUndetailedMoney])).toEqual([
      ["order-pozo", true],
      ["order-clean", false],
    ]);
  });

  it("reads the paid mark from the item's own column, not from a legacy settlesTarget row", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow("order-1", "PED-001", [
        { id: "item-1", name: "Nendoroid Miku", paidDeclaredAt: new Date("2026-08-01T12:00:00.000Z") },
        { id: "item-2", name: "Figma Rem" },
      ]),
    ]);

    const groups = await getPendingProductsByStore("user-1");

    expect(groups[0].pendingProducts.map((product) => product.paidDeclared)).toEqual([true, false]);
  });
});
