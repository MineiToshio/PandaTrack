import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    storePayment: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    paymentAllocation: { findMany: vi.fn(), aggregate: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import {
  getStoreDebtByCurrency,
  getStoreDebtMinor,
  getStorePaymentsForStore,
  resolveInheritedStoreCurrency,
  type StoreDebtRow,
} from "../storePaymentQueries";

/**
 * One row of the `order.groupBy` the debt query issues, in the shape Prisma really returns it:
 * grouped by store, currency AND status, summing both the cost and the declared money, so the
 * lifetime commitment and the still-active slice come out of one round trip.
 */
function orderGroup(
  overrides: Partial<{
    storeId: string;
    currencyCode: string;
    status: OrderStatus;
    totalCost: number;
    allocatedAmountMinor: number;
  }> = {},
) {
  const { storeId, currencyCode, status, totalCost, allocatedAmountMinor } = {
    storeId: "store-1",
    currencyCode: "USD",
    status: OrderStatus.OPEN,
    totalCost: 0,
    allocatedAmountMinor: 0,
    ...overrides,
  };
  return { storeId, currencyCode, status, _sum: { totalCost, allocatedAmountMinor } };
}

/** One complete `StoreDebtRow`, so a field cannot drift out of these expectations unnoticed. */
function debtRow(overrides: Partial<StoreDebtRow> = {}): StoreDebtRow {
  return {
    storeId: "store-1",
    currencyCode: "USD",
    committedMinor: 0,
    paidMinor: 0,
    debtMinor: 0,
    lostMinor: 0,
    activeCommittedMinor: 0,
    activePaidMinor: 0,
    ...overrides,
  };
}

describe("getStoreDebtByCurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a delivered order in the store's debt while leaving it out of the bar's pair", async () => {
    // The state the collector's base was just cleaned out of, and one "Ya me llegó" on a half-paid
    // order away from returning: 300.00 owed on a COMPLETED order plus 200.00 owed on an OPEN one.
    // The debt has to stay 500.00 (it is what `createStorePayment` checks against and what enables
    // "Registrar pago"), while the bar measures only the 200.00 still in flight.
    prismaMock.order.groupBy.mockResolvedValue([
      orderGroup({ status: OrderStatus.COMPLETED, totalCost: 60000, allocatedAmountMinor: 30000 }),
      orderGroup({ status: OrderStatus.PARTIALLY_DELIVERED, totalCost: 40000, allocatedAmountMinor: 20000 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "USD", _sum: { amount: 50000 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      debtRow({
        committedMinor: 100000,
        paidMinor: 50000,
        debtMinor: 50000,
        activeCommittedMinor: 40000,
        activePaidMinor: 20000,
      }),
    ]);
  });

  it("counts every non-terminal status as active, not just OPEN", async () => {
    prismaMock.order.groupBy.mockResolvedValue([
      orderGroup({ status: OrderStatus.OPEN, totalCost: 1000, allocatedAmountMinor: 100 }),
      orderGroup({ status: OrderStatus.PARTIALLY_IN_TRANSIT, totalCost: 2000, allocatedAmountMinor: 200 }),
      orderGroup({ status: OrderStatus.IN_TRANSIT, totalCost: 4000, allocatedAmountMinor: 400 }),
      orderGroup({ status: OrderStatus.PARTIALLY_DELIVERED, totalCost: 8000, allocatedAmountMinor: 800 }),
      orderGroup({ status: OrderStatus.COMPLETED, totalCost: 16000, allocatedAmountMinor: 16000 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const [row] = await getStoreDebtByCurrency("user-1");

    // The four in-flight statuses, and only those. `IN_TRANSIT` and `PARTIALLY_IN_TRANSIT` have
    // never occurred in the real collection, which is exactly why they are asserted here.
    expect(row.activeCommittedMinor).toBe(15000);
    expect(row.activePaidMinor).toBe(1500);
    expect(row.committedMinor).toBe(31000);
  });

  it("excludes CANCELLED orders from the committed side but counts every payment", async () => {
    prismaMock.order.groupBy.mockResolvedValue([
      orderGroup({ status: OrderStatus.OPEN, totalCost: 8000, allocatedAmountMinor: 3000 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "USD", _sum: { amount: 3000 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(prismaMock.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", status: { not: OrderStatus.CANCELLED } } }),
    );
    expect(prismaMock.storePayment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(rows).toEqual([
      debtRow({
        committedMinor: 8000,
        paidMinor: 3000,
        debtMinor: 5000,
        activeCommittedMinor: 8000,
        activePaidMinor: 3000,
      }),
    ]);
  });

  it("leaves money handed over on account out of the bar's numerator while it pays down the debt", async () => {
    // The shape the store detail's "A cuenta" line is derived from, produced here by the query
    // itself rather than assumed: one active order of 250.00 with nothing declared against it
    // (`allocatedAmountMinor` 0) and a payment of 100.00 that declares nothing, which is what an
    // allocation-less submit writes. The debt drops to 150.00 while the bar's pair stays 0 of
    // 250.00, and the 100.00 is only nameable as the difference between the two.
    prismaMock.order.groupBy.mockResolvedValue([
      orderGroup({ currencyCode: "PEN", status: OrderStatus.OPEN, totalCost: 25000, allocatedAmountMinor: 0 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "PEN", _sum: { amount: 10000 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      debtRow({
        currencyCode: "PEN",
        committedMinor: 25000,
        paidMinor: 10000,
        debtMinor: 15000,
        activeCommittedMinor: 25000,
        activePaidMinor: 0,
      }),
    ]);
  });

  it("does not clamp a negative debt when payments exceed what is committed", async () => {
    prismaMock.order.groupBy.mockResolvedValue([
      orderGroup({ status: OrderStatus.OPEN, totalCost: 1000, allocatedAmountMinor: 1000 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "USD", _sum: { amount: 4000 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      debtRow({
        committedMinor: 1000,
        paidMinor: 4000,
        debtMinor: -3000,
        activeCommittedMinor: 1000,
        activePaidMinor: 1000,
      }),
    ]);
  });

  it("surfaces a store/currency pair backed only by payments (nothing currently committed)", async () => {
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "PEN", _sum: { amount: 1500 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([debtRow({ currencyCode: "PEN", committedMinor: 0, paidMinor: 1500, debtMinor: -1500 })]);
  });

  it("surfaces a store/currency pair backed only by committed orders (nothing paid yet)", async () => {
    prismaMock.order.groupBy.mockResolvedValue([
      orderGroup({ currencyCode: "PEN", status: OrderStatus.OPEN, totalCost: 2000 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      debtRow({ currencyCode: "PEN", committedMinor: 2000, debtMinor: 2000, activeCommittedMinor: 2000 }),
    ]);
  });

  it("narrows both queries to a single store when one is given", async () => {
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.storePayment.groupBy.mockResolvedValue([]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    await getStoreDebtByCurrency("user-1", "store-1");

    expect(prismaMock.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", status: { not: OrderStatus.CANCELLED }, storeId: "store-1" },
      }),
    );
    expect(prismaMock.storePayment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", storeId: "store-1" } }),
    );
    expect(prismaMock.paymentAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          order: { status: OrderStatus.CANCELLED },
          payment: { storeId: "store-1" },
        },
      }),
    );
  });

  it("excludes money left declared lost against a cancelled order from the debt (Baul Jare case)", async () => {
    // Synthetic reproduction of the real Baul Jare bug: 16,000 minor units were paid and then left
    // declared against a cancelled order (paymentsChoice: "lost"). The store had only 25,000
    // committed and 41,000 total paid, so the old formula (committed - paid) read as -16,000 ("a
    // favor"), while the money is actually gone, not a credit.
    prismaMock.order.groupBy.mockResolvedValue([
      orderGroup({
        storeId: "store-baul-jare",
        currencyCode: "PEN",
        status: OrderStatus.OPEN,
        totalCost: 25000,
        allocatedAmountMinor: 25000,
      }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-baul-jare", currencyCode: "PEN", _sum: { amount: 41000 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([
      { amountMinor: 16000, payment: { storeId: "store-baul-jare", currencyCode: "PEN" } },
    ]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      debtRow({
        storeId: "store-baul-jare",
        currencyCode: "PEN",
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        lostMinor: 16000,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
      }),
    ]);
  });

  it("raises a store's live debt once lost-on-cancelled money is excluded from what is paid (Kenshin case)", async () => {
    // Synthetic reproduction of the Kenshin bug: 900 minor units were left declared lost against a
    // cancelled order. The old formula silently let that 900 count as if it still paid down the
    // store's live debt; it must not.
    prismaMock.order.groupBy.mockResolvedValue([
      orderGroup({
        storeId: "store-kenshin",
        currencyCode: "PEN",
        status: OrderStatus.COMPLETED,
        totalCost: 1097120,
        allocatedAmountMinor: 1074120,
      }),
      orderGroup({
        storeId: "store-kenshin",
        currencyCode: "PEN",
        status: OrderStatus.OPEN,
        totalCost: 21150,
        allocatedAmountMinor: 11850,
      }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-kenshin", currencyCode: "PEN", _sum: { amount: 1086870 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([
      { amountMinor: 900, payment: { storeId: "store-kenshin", currencyCode: "PEN" } },
    ]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      debtRow({
        storeId: "store-kenshin",
        currencyCode: "PEN",
        committedMinor: 1118270,
        paidMinor: 1085970,
        debtMinor: 32300,
        lostMinor: 900,
        // The two COMPLETED groups fold into `committedMinor` and stay out of the active pair.
        activeCommittedMinor: 21150,
        activePaidMinor: 11850,
      }),
    ]);
  });
});

describe("getStoreDebtMinor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subtracts what has been paid from what is committed, scoped to one store and currency", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 9000 } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 4000 } }) },
      paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0 } }) },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    expect(debt).toBe(5000);
    expect(tx.order.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1", storeId: "store-1", currencyCode: "USD", status: { not: OrderStatus.CANCELLED } },
      _sum: { totalCost: true },
    });
    expect(tx.storePayment.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1", storeId: "store-1", currencyCode: "USD" },
      _sum: { amount: true },
    });
    expect(tx.paymentAllocation.aggregate).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        payment: { storeId: "store-1", currencyCode: "USD" },
        order: { status: OrderStatus.CANCELLED },
      },
      _sum: { amountMinor: true },
    });
  });

  it("returns a negative debt uncapped when the store was overpaid", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 1000 } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 6000 } }) },
      paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0 } }) },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    expect(debt).toBe(-5000);
  });

  it("treats missing aggregates as zero", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: null } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
      paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: null } }) },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    expect(debt).toBe(0);
  });

  it("excludes money left declared lost against a cancelled order from what counts as paid", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 9000 } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 4000 } }) },
      paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 900 } }) },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    // 9000 committed - (4000 paid - 900 lost) = 5900, not the 5000 the old formula would give.
    expect(debt).toBe(5900);
  });
});

describe("getStorePaymentsForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps each payment with its allocation lines, in the shape the card renders", async () => {
    prismaMock.storePayment.findMany.mockResolvedValue([
      {
        id: "pay-1",
        amount: 1000,
        currencyCode: "USD",
        paymentDate: new Date("2024-02-01T00:00:00.000Z"),
        note: "Adelanto",
        allocations: [
          {
            orderId: "order-1",
            orderItemId: "item-1",
            amountMinor: 300,
            settlesTarget: false,
            order: { humanReadableId: "ORD-20240201-01", status: OrderStatus.OPEN },
            orderItem: { name: "Chainsaw Man Vol. 3" },
          },
          {
            orderId: "order-1",
            orderItemId: null,
            amountMinor: 200,
            settlesTarget: false,
            order: { humanReadableId: "ORD-20240201-01", status: OrderStatus.OPEN },
            orderItem: null,
          },
        ],
      },
      {
        id: "pay-2",
        amount: 500,
        currencyCode: "USD",
        paymentDate: new Date("2024-01-01T00:00:00.000Z"),
        note: null,
        allocations: [],
      },
    ]);
    prismaMock.storePayment.count.mockResolvedValue(2);

    const result = await getStorePaymentsForStore("user-1", "store-1");

    expect(result.totalCount).toBe(2);
    expect(result.payments).toEqual([
      {
        id: "pay-1",
        amount: 1000,
        currencyCode: "USD",
        paymentDate: new Date("2024-02-01T00:00:00.000Z"),
        note: "Adelanto",
        allocatedTotal: 500,
        // ONE order, though the payment carries two lines against it (a product plus the
        // undetailed remainder), which is the exact shape a breakdown writes. The delete-confirm
        // modal fed by this figure names pedidos, so counting lines told the collector a payment
        // touching one order would cost him "su asignación con 2 pedidos".
        claimingOrdersCount: 1,
        allocations: [
          {
            orderId: "order-1",
            orderHumanReadableId: "ORD-20240201-01",
            orderCancelled: false,
            orderActive: true,
            orderItemId: "item-1",
            orderItemName: "Chainsaw Man Vol. 3",
            amountMinor: 300,
            settlesTarget: false,
          },
          {
            orderId: "order-1",
            orderHumanReadableId: "ORD-20240201-01",
            orderCancelled: false,
            orderActive: true,
            orderItemId: null,
            orderItemName: null,
            amountMinor: 200,
            settlesTarget: false,
          },
        ],
      },
      {
        id: "pay-2",
        amount: 500,
        currencyCode: "USD",
        paymentDate: new Date("2024-01-01T00:00:00.000Z"),
        note: null,
        allocatedTotal: 0,
        claimingOrdersCount: 0,
        allocations: [],
      },
    ]);
  });

  it("flags a line declared against an order that was cancelled (the money the bar nets out)", async () => {
    prismaMock.storePayment.findMany.mockResolvedValue([
      {
        id: "pay-lost",
        amount: 16000,
        currencyCode: "PEN",
        paymentDate: new Date("2023-01-30T00:00:00.000Z"),
        note: null,
        allocations: [
          {
            orderId: "order-cancelled",
            orderItemId: null,
            amountMinor: 16000,
            settlesTarget: false,
            order: { humanReadableId: "ORD-20230130-01", status: OrderStatus.CANCELLED },
            orderItem: null,
          },
        ],
      },
    ]);
    prismaMock.storePayment.count.mockResolvedValue(1);

    const result = await getStorePaymentsForStore("user-1", "store-1");

    expect(result.payments[0].allocations[0]).toMatchObject({
      orderHumanReadableId: "ORD-20230130-01",
      orderCancelled: true,
      orderActive: false,
    });
  });

  it("marks a line against a delivered order as neither cancelled nor active", async () => {
    // The third state, and the one that would be lost if `orderActive` were derived from
    // `orderCancelled`: a real payment against a real order, on money the bar does not measure.
    prismaMock.storePayment.findMany.mockResolvedValue([
      {
        id: "pay-settled",
        amount: 30000,
        currencyCode: "PEN",
        paymentDate: new Date("2026-02-01T00:00:00.000Z"),
        note: null,
        allocations: [
          {
            orderId: "order-completed",
            orderItemId: null,
            amountMinor: 30000,
            settlesTarget: false,
            order: { humanReadableId: "ORD-20260201-01", status: OrderStatus.COMPLETED },
            orderItem: null,
          },
        ],
      },
    ]);
    prismaMock.storePayment.count.mockResolvedValue(1);

    const result = await getStorePaymentsForStore("user-1", "store-1");

    expect(result.payments[0].allocations[0]).toMatchObject({ orderCancelled: false, orderActive: false });
  });

  it("caps the list at the display limit but reports the true total separately", async () => {
    prismaMock.storePayment.findMany.mockResolvedValue([]);
    prismaMock.storePayment.count.mockResolvedValue(37);

    const result = await getStorePaymentsForStore("user-1", "store-1");

    expect(prismaMock.storePayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", storeId: "store-1" }, take: 20 }),
    );
    expect(result.totalCount).toBe(37);
  });

  it('drops the cap entirely for the card\'s explicit "see all" request', async () => {
    prismaMock.storePayment.findMany.mockResolvedValue([]);
    prismaMock.storePayment.count.mockResolvedValue(102);

    await getStorePaymentsForStore("user-1", "store-1", { limit: null });

    const args = prismaMock.storePayment.findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("take");
  });
});

describe("resolveInheritedStoreCurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the single currency every standing order agrees on", async () => {
    const tx = { order: { findMany: vi.fn().mockResolvedValue([{ currencyCode: "PEN" }]) } };

    const currency = await resolveInheritedStoreCurrency(tx as never, "user-1", "store-1");

    expect(currency).toBe("PEN");
  });

  it("returns null when the store's orders span more than one currency", async () => {
    const tx = { order: { findMany: vi.fn().mockResolvedValue([{ currencyCode: "PEN" }, { currencyCode: "USD" }]) } };

    const currency = await resolveInheritedStoreCurrency(tx as never, "user-1", "store-1");

    expect(currency).toBeNull();
  });

  it("returns null when the store has no standing orders", async () => {
    const tx = { order: { findMany: vi.fn().mockResolvedValue([]) } };

    const currency = await resolveInheritedStoreCurrency(tx as never, "user-1", "store-1");

    expect(currency).toBeNull();
  });
});
