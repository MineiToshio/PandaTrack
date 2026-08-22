import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    storePayment: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    paymentAllocation: { findMany: vi.fn(), aggregate: vi.fn() },
    storeAccountAdjustmentLine: { groupBy: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import {
  getOpenBalanceMinorByOrderIds,
  getStoreDebtByCurrency,
  getStoreDebtMinor,
  getStorePaymentsForStore,
  getUnassignedStoreMoneyMinor,
  resolveInheritedStoreCurrency,
  type StoreDebtRow,
} from "../storePaymentQueries";

/**
 * One row of the `order.findMany` this query now issues, in the shape Prisma really returns it.
 * `getStoreDebtByCurrency` folds these into the store/currency/status aggregates itself (it used to
 * be a `groupBy`), because `openOrderDebtMinor` and `unrecordedPaymentsMinor` need each order's own
 * `id` to read its `openBalanceMinor` (BR-05-32).
 */
function orderRow(
  overrides: Partial<{
    id: string;
    storeId: string;
    currencyCode: string;
    status: OrderStatus;
    totalCost: number;
    allocatedAmountMinor: number;
  }> = {},
) {
  return {
    id: "order-1",
    storeId: "store-1",
    currencyCode: "USD",
    status: OrderStatus.OPEN,
    totalCost: 0,
    allocatedAmountMinor: 0,
    ...overrides,
  };
}

/** One row of the `storeAccountAdjustmentLine.groupBy` `openBalanceMinorByOrderId` issues. */
function lineSumRow(orderId: string, amountMinor: number) {
  return { orderId, _sum: { amountMinor } };
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
    openOrderDebtMinor: 0,
    unrecordedPaymentsMinor: 0,
    unassignedMinor: 0,
    ...overrides,
  };
}

describe("getStoreDebtByCurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([]);
  });

  it("keeps a delivered order in the store's debt while leaving it out of the bar's pair", async () => {
    // The state the collector's base was just cleaned out of, and one "Ya me llegó" on a half-paid
    // order away from returning: 300.00 owed on a COMPLETED order plus 200.00 owed on an OPEN one.
    // The debt has to stay 500.00 (it is what `createStorePayment` checks against and what enables
    // "Registrar pago"), while the bar measures only the 200.00 still in flight.
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({ id: "order-completed", status: OrderStatus.COMPLETED, totalCost: 60000, allocatedAmountMinor: 30000 }),
      orderRow({
        id: "order-open",
        status: OrderStatus.PARTIALLY_DELIVERED,
        totalCost: 40000,
        allocatedAmountMinor: 20000,
      }),
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
        openOrderDebtMinor: 20000,
        unrecordedPaymentsMinor: 30000,
        unassignedMinor: 50000 - 50000,
      }),
    ]);
  });

  it("counts every non-terminal status as active, not just OPEN", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({ id: "o-open", status: OrderStatus.OPEN, totalCost: 1000, allocatedAmountMinor: 100 }),
      orderRow({ id: "o-pit", status: OrderStatus.PARTIALLY_IN_TRANSIT, totalCost: 2000, allocatedAmountMinor: 200 }),
      orderRow({ id: "o-it", status: OrderStatus.IN_TRANSIT, totalCost: 4000, allocatedAmountMinor: 400 }),
      orderRow({ id: "o-pd", status: OrderStatus.PARTIALLY_DELIVERED, totalCost: 8000, allocatedAmountMinor: 800 }),
      orderRow({ id: "o-completed", status: OrderStatus.COMPLETED, totalCost: 16000, allocatedAmountMinor: 16000 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const [row] = await getStoreDebtByCurrency("user-1");

    // The four in-flight statuses, and only those. `IN_TRANSIT` and `PARTIALLY_IN_TRANSIT` have
    // never occurred in the real collection, which is exactly why they are asserted here.
    expect(row.activeCommittedMinor).toBe(15000);
    expect(row.activePaidMinor).toBe(1500);
    expect(row.committedMinor).toBe(31000);
    // No adjustment lines, so open equals gross for the active slice; the COMPLETED order is fully
    // paid, so it contributes nothing to unrecordedPaymentsMinor.
    expect(row.openOrderDebtMinor).toBe(15000 - 1500);
    expect(row.unrecordedPaymentsMinor).toBe(0);
  });

  it("excludes CANCELLED orders from the committed side but counts every payment", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({ status: OrderStatus.OPEN, totalCost: 8000, allocatedAmountMinor: 3000 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "USD", _sum: { amount: 3000 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
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
        openOrderDebtMinor: 5000,
        unassignedMinor: 0,
      }),
    ]);
  });

  it("leaves money handed over on account out of the bar's numerator while it pays down the debt", async () => {
    // The shape the store detail's "A cuenta" line is derived from, produced here by the query
    // itself rather than assumed: one active order of 250.00 with nothing declared against it
    // (`allocatedAmountMinor` 0) and a payment of 100.00 that declares nothing, which is what an
    // allocation-less submit writes. The debt drops to 150.00 while the bar's pair stays 0 of
    // 250.00, and the 100.00 is only nameable as the difference between the two.
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({ currencyCode: "PEN", status: OrderStatus.OPEN, totalCost: 25000, allocatedAmountMinor: 0 }),
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
        openOrderDebtMinor: 25000,
        unassignedMinor: 10000,
      }),
    ]);
  });

  it("does not clamp a negative debt when payments exceed what is committed", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({ status: OrderStatus.OPEN, totalCost: 1000, allocatedAmountMinor: 1000 }),
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
        openOrderDebtMinor: 0,
        unassignedMinor: 3000,
      }),
    ]);
  });

  it("surfaces a store/currency pair backed only by payments (nothing currently committed)", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "PEN", _sum: { amount: 1500 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      debtRow({ currencyCode: "PEN", committedMinor: 0, paidMinor: 1500, debtMinor: -1500, unassignedMinor: 1500 }),
    ]);
  });

  it("surfaces a store/currency pair backed only by committed orders (nothing paid yet)", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({ currencyCode: "PEN", status: OrderStatus.OPEN, totalCost: 2000 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      debtRow({
        currencyCode: "PEN",
        committedMinor: 2000,
        debtMinor: 2000,
        activeCommittedMinor: 2000,
        openOrderDebtMinor: 2000,
        unassignedMinor: 0,
      }),
    ]);
  });

  it("narrows both queries to a single store when one is given", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.storePayment.groupBy.mockResolvedValue([]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    await getStoreDebtByCurrency("user-1", "store-1");

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
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
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({
        id: "order-baul-jare",
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
        openOrderDebtMinor: 0,
        unassignedMinor: 0,
      }),
    ]);
  });

  it("raises a store's live debt once lost-on-cancelled money is excluded from what is paid (Kenshin case)", async () => {
    // Synthetic reproduction of the Kenshin bug: 900 minor units were left declared lost against a
    // cancelled order. The old formula silently let that 900 count as if it still paid down the
    // store's live debt; it must not.
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({
        id: "order-kenshin-completed",
        storeId: "store-kenshin",
        currencyCode: "PEN",
        status: OrderStatus.COMPLETED,
        totalCost: 1097120,
        allocatedAmountMinor: 1074120,
      }),
      orderRow({
        id: "order-kenshin-open",
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
        openOrderDebtMinor: 21150 - 11850,
        unrecordedPaymentsMinor: 1097120 - 1074120,
        unassignedMinor: 1085970 - (1074120 + 11850),
      }),
    ]);
  });

  describe("openOrderDebtMinor / unrecordedPaymentsMinor (WO-09 unit test table)", () => {
    it("counts an OPEN order (100) and excludes a fully-paid COMPLETED order (BR-05-26)", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "o-open", status: OrderStatus.OPEN, totalCost: 100, allocatedAmountMinor: 0 }),
        orderRow({ id: "o-completed", status: OrderStatus.COMPLETED, totalCost: 500, allocatedAmountMinor: 500 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.openOrderDebtMinor).toBe(100);
      expect(row.unrecordedPaymentsMinor).toBe(0);
    });

    it("reads a COMPLETED order's own balance as unrecordedPaymentsMinor, not open debt", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "o-completed", status: OrderStatus.COMPLETED, totalCost: 100, allocatedAmountMinor: 70 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.openOrderDebtMinor).toBe(0);
      expect(row.unrecordedPaymentsMinor).toBe(30);
    });

    it("reads zero open debt when every order is CANCELLED (no rows at all)", async () => {
      // A CANCELLED order never reaches this query (it is filtered out at the `where` clause), so
      // "every order cancelled" surfaces here as no committed rows for the key at all.
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

      const rows = await getStoreDebtByCurrency("user-1");

      expect(rows).toEqual([]);
    });

    it("reads openOrderDebtMinor net of a partial adjustment line (180 - 100 = 80, not the gross 180)", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "o-written-off", status: OrderStatus.OPEN, totalCost: 180, allocatedAmountMinor: 0 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
      prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([lineSumRow("o-written-off", 100)]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.openOrderDebtMinor).toBe(80);
    });

    it("reads openOrderDebtMinor as zero when an OPEN order was fully written off (180 - 180 = 0)", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "o-written-off", status: OrderStatus.OPEN, totalCost: 180, allocatedAmountMinor: 0 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
      prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([lineSumRow("o-written-off", 180)]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.openOrderDebtMinor).toBe(0);
    });

    it("reads unrecordedPaymentsMinor as zero for a COMPLETED order fully written off before delivery", async () => {
      // The write-off must not be mistaken for a payment the collector forgot to record.
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({
          id: "o-completed-written-off",
          status: OrderStatus.COMPLETED,
          totalCost: 180,
          allocatedAmountMinor: 0,
        }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
      prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([lineSumRow("o-completed-written-off", 180)]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.unrecordedPaymentsMinor).toBe(0);
    });

    it("carries a forced-negative openOrderDebtMinor through unclamped (BR-05-32)", async () => {
      // Allocations plus an adjustment line exceed totalCost: a ceiling was bypassed upstream, and
      // asserting `>= 0` here would be asserting that bug, not this figure's contract.
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "o-over", status: OrderStatus.OPEN, totalCost: 100, allocatedAmountMinor: 80 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
      prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([lineSumRow("o-over", 50)]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.openOrderDebtMinor).toBe(100 - 80 - 50);
      expect(row.openOrderDebtMinor).toBeLessThan(0);
    });
  });

  describe("unassignedMinor (WO-09 unit test table)", () => {
    it("reads 30 for orders A(50) + B(50) with one unassigned payment of 30", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "order-a", status: OrderStatus.OPEN, totalCost: 50, allocatedAmountMinor: 0 }),
        orderRow({ id: "order-b", status: OrderStatus.OPEN, totalCost: 50, allocatedAmountMinor: 0 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([
        { storeId: "store-1", currencyCode: "USD", _sum: { amount: 30 } },
      ]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.unassignedMinor).toBe(30);
    });

    it("drops to zero once A is fully allocated by a subsequent declaration", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "order-a", status: OrderStatus.OPEN, totalCost: 50, allocatedAmountMinor: 30 }),
        orderRow({ id: "order-b", status: OrderStatus.OPEN, totalCost: 50, allocatedAmountMinor: 0 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([
        { storeId: "store-1", currencyCode: "USD", _sum: { amount: 30 } },
      ]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.unassignedMinor).toBe(0);
    });

    it("excludes a lost allocation against a cancelled order from both paidMinor and the pool", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "order-a", status: OrderStatus.OPEN, totalCost: 50, allocatedAmountMinor: 0 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([
        { storeId: "store-1", currencyCode: "USD", _sum: { amount: 80 } },
      ]);
      // 50 of the 80 was left declared against a now-cancelled order: sunk, not available.
      prismaMock.paymentAllocation.findMany.mockResolvedValue([
        { amountMinor: 50, payment: { storeId: "store-1", currencyCode: "USD" } },
      ]);

      const [row] = await getStoreDebtByCurrency("user-1");

      expect(row.paidMinor).toBe(30);
      expect(row.unassignedMinor).toBe(30);
    });
  });

  describe("debtMinor with adjustment lines (WO-11, validationCeilingMinor)", () => {
    it("subtracts a line against an OPEN order from the lifetime ceiling (not just openOrderDebtMinor)", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "o-written-off", status: OrderStatus.OPEN, totalCost: 9000, allocatedAmountMinor: 0 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
      prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([lineSumRow("o-written-off", 3000)]);

      const [row] = await getStoreDebtByCurrency("user-1");

      // 9000 committed - 0 paid - 3000 written off = 6000, not the pre-WO-11 gross 9000: the same
      // line that already nets `openOrderDebtMinor` must also net the base the payment ceiling reads.
      expect(row.debtMinor).toBe(6000);
      expect(row.openOrderDebtMinor).toBe(6000);
    });

    it("subtracts a line against a COMPLETED (delivered) order from the ceiling too, though openOrderDebtMinor never counted it", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({
          id: "o-delivered-written-off",
          status: OrderStatus.COMPLETED,
          totalCost: 9000,
          allocatedAmountMinor: 0,
        }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
      prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([lineSumRow("o-delivered-written-off", 9000)]);

      const [row] = await getStoreDebtByCurrency("user-1");

      // The write-off drops the ceiling and the diagnostic (unrecordedPaymentsMinor) together, while
      // openOrderDebtMinor is unaffected because a COMPLETED order was never in it to begin with.
      expect(row.debtMinor).toBe(0);
      expect(row.openOrderDebtMinor).toBe(0);
      expect(row.unrecordedPaymentsMinor).toBe(0);
    });

    it("matches getStoreDebtMinor's own figure for an identical fixture (one definition of the ceiling)", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        orderRow({ id: "o-a", status: OrderStatus.OPEN, totalCost: 5000, allocatedAmountMinor: 0 }),
      ]);
      prismaMock.storePayment.groupBy.mockResolvedValue([
        { storeId: "store-1", currencyCode: "USD", _sum: { amount: 1000 } },
      ]);
      prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
      prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([lineSumRow("o-a", 2000)]);

      const [batchRow] = await getStoreDebtByCurrency("user-1");

      const tx = {
        order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 5000 } }) },
        storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 1000 } }) },
        paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0 } }) },
        storeAccountAdjustmentLine: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 2000 } }) },
      };
      const singlePairMinor = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

      expect(batchRow.debtMinor).toBe(singlePairMinor);
      expect(singlePairMinor).toBe(2000);
    });
  });
});

describe("getStoreDebtMinor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Default `storeAccountAdjustmentLine.aggregate` mock: no lines anywhere (WO-11's own term). */
  function makeStoreAccountAdjustmentLineAggregate(amountMinor: number | null = 0) {
    return vi.fn().mockResolvedValue({ _sum: { amountMinor } });
  }

  it("subtracts what has been paid from what is committed, scoped to one store and currency", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 9000 } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 4000 } }) },
      paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0 } }) },
      storeAccountAdjustmentLine: { aggregate: makeStoreAccountAdjustmentLineAggregate() },
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
      storeAccountAdjustmentLine: { aggregate: makeStoreAccountAdjustmentLineAggregate() },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    expect(debt).toBe(-5000);
  });

  it("treats missing aggregates as zero", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: null } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
      paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: null } }) },
      storeAccountAdjustmentLine: { aggregate: makeStoreAccountAdjustmentLineAggregate(null) },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    expect(debt).toBe(0);
  });

  it("excludes money left declared lost against a cancelled order from what counts as paid", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 9000 } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 4000 } }) },
      paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 900 } }) },
      storeAccountAdjustmentLine: { aggregate: makeStoreAccountAdjustmentLineAggregate() },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    // 9000 committed - (4000 paid - 900 lost) = 5900, not the 5000 the old formula would give.
    expect(debt).toBe(5900);
  });

  describe("the adjustment-line term in the ceiling (WO-11, validationCeilingMinor)", () => {
    it("subtracts a line written against a non-cancelled order from the ceiling", async () => {
      const tx = {
        order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 9000 } }) },
        storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
        paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0 } }) },
        storeAccountAdjustmentLine: { aggregate: makeStoreAccountAdjustmentLineAggregate(3000) },
      };

      const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

      // 9000 committed - 0 paid - 3000 written off = 6000, not the 9000 the pre-WO-11 ceiling gives:
      // a written-off balance must not be payable a second time.
      expect(debt).toBe(6000);
      expect(tx.storeAccountAdjustmentLine.aggregate).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          order: { storeId: "store-1", currencyCode: "USD", status: { not: OrderStatus.CANCELLED } },
        },
        _sum: { amountMinor: true },
      });
    });

    it("keeps subtracting the line after the written-off order is delivered (survives status change)", async () => {
      // The scope is "non-cancelled", not "open": a delivered order still carries its own line, and
      // the query's own `status: { not: CANCELLED }` filter reaches it regardless of which
      // non-cancelled status it currently holds.
      const tx = {
        order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 9000 } }) },
        storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
        paymentAllocation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0 } }) },
        storeAccountAdjustmentLine: { aggregate: makeStoreAccountAdjustmentLineAggregate(3000) },
      };

      const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

      expect(debt).toBe(6000);
    });
  });
});

describe("getUnassignedStoreMoneyMinor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * A fake `tx` for the shared `getStorePaymentRemainders` helper (`MINOR-5/6`): one row of
   * `storePayment.findMany` per payment, and one row of `paymentAllocation.groupBy` (grouped by
   * `paymentId`) per payment that has anything allocated against it — regardless of the target
   * order's status, exactly like the real query (an allocation against a cancelled order is just as
   * much "no longer this payment's to give" as one against a live order).
   */
  function makeTx(payments: Array<{ id: string; amount: number; allocatedMinor?: number }>) {
    return {
      storePayment: {
        findMany: vi.fn().mockResolvedValue(
          payments.map((payment, index) => ({
            id: payment.id,
            amount: payment.amount,
            paymentDate: new Date(Date.UTC(2020, 0, index + 1)),
          })),
        ),
      },
      paymentAllocation: {
        groupBy: vi
          .fn()
          .mockResolvedValue(
            payments
              .filter((payment) => (payment.allocatedMinor ?? 0) !== 0)
              .map((payment) => ({ paymentId: payment.id, _sum: { amountMinor: payment.allocatedMinor } })),
          ),
      },
    };
  }

  it("matches the same figure getStoreDebtByCurrency computes for the same fixture (one implementation)", async () => {
    // Same shape as the batch "orders A(50)+B(50), unassigned payment of 30" case above.
    prismaMock.order.findMany.mockResolvedValue([
      orderRow({ id: "order-a", status: OrderStatus.OPEN, totalCost: 50, allocatedAmountMinor: 0 }),
      orderRow({ id: "order-b", status: OrderStatus.OPEN, totalCost: 50, allocatedAmountMinor: 0 }),
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "USD", _sum: { amount: 30 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([]);

    const [batchRow] = await getStoreDebtByCurrency("user-1");

    const tx = makeTx([{ id: "payment-1", amount: 30 }]);
    const singlePairMinor = await getUnassignedStoreMoneyMinor(tx as never, "user-1", "store-1", "USD");

    expect(singlePairMinor).toBe(batchRow.unassignedMinor);
    expect(singlePairMinor).toBe(30);
  });

  it("subtracts money already allocated against this payment from the pool", async () => {
    const tx = makeTx([{ id: "payment-1", amount: 8000, allocatedMinor: 5000 }]);

    const pool = await getUnassignedStoreMoneyMinor(tx as never, "user-1", "store-1", "PEN");

    expect(pool).toBe(3000);
    expect(tx.storePayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", storeId: "store-1", currencyCode: "PEN" } }),
    );
  });

  it("excludes money left declared against a cancelled order from the pool, same as any other allocation", async () => {
    // The unified per-payment remainder does not distinguish WHY a payment's own allocation is no
    // longer unassigned (cancelled-order "lost" money and live-order "assigned" money are both,
    // from this one payment's own point of view, simply money it no longer has to give).
    const tx = makeTx([{ id: "payment-1", amount: 8000, allocatedMinor: 1000 }]);

    const pool = await getUnassignedStoreMoneyMinor(tx as never, "user-1", "store-1", "PEN");

    expect(pool).toBe(7000);
  });

  it("reads zero when the pair has no payments at all", async () => {
    const tx = makeTx([]);

    const pool = await getUnassignedStoreMoneyMinor(tx as never, "user-1", "store-1", "PEN");

    expect(pool).toBe(0);
  });

  it("sums the RAW, unclamped remainder across several payments, even a negative one", async () => {
    // A payment over-allocated past its own amount (only reachable if a ceiling elsewhere was
    // bypassed) reads a negative remainder and is summed as-is, not floored at zero: this scalar
    // total is the same figure `consumeUnassignedStoreMoneyOnOrderClose` reads to decide whether to
    // abstain (MINOR-5/6).
    const tx = makeTx([
      { id: "payment-1", amount: 5000, allocatedMinor: 2000 },
      { id: "payment-2", amount: 3000, allocatedMinor: 4000 },
    ]);

    const pool = await getUnassignedStoreMoneyMinor(tx as never, "user-1", "store-1", "PEN");

    expect(pool).toBe(3000 + -1000);
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

describe("getOpenBalanceMinorByOrderIds (D1 support)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does its own scoped order read, then the net balance batch, in one bounded round trip", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { id: "order-1", totalCost: 10000, allocatedAmountMinor: 4000 },
      { id: "order-2", totalCost: 5000, allocatedAmountMinor: 0 },
    ]);
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([lineSumRow("order-2", 1000)]);

    const balances = await getOpenBalanceMinorByOrderIds("user-1", ["order-1", "order-2"]);

    expect(prismaMock.order.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-1", "order-2"] }, userId: "user-1" },
      select: { id: true, totalCost: true, allocatedAmountMinor: true },
    });
    // order-1: 10000 - 4000 - 0 = 6000. order-2: 5000 - 0 - 1000 (written off) = 4000.
    expect(balances).toEqual(
      new Map([
        ["order-1", 6000],
        ["order-2", 4000],
      ]),
    );
  });

  it("an order id the caller does not own (or that no longer exists) is simply absent from the map", async () => {
    // The caller asked for "order-foreign" too, but the scoped `findMany` never returns a row for it.
    prismaMock.order.findMany.mockResolvedValue([{ id: "order-1", totalCost: 10000, allocatedAmountMinor: 4000 }]);
    prismaMock.storeAccountAdjustmentLine.groupBy.mockResolvedValue([]);

    const balances = await getOpenBalanceMinorByOrderIds("user-1", ["order-1", "order-foreign"]);

    expect(balances.has("order-foreign")).toBe(false);
    expect(balances.get("order-1")).toBe(6000);
  });

  it("returns an empty map without querying anything for an empty id list", async () => {
    const balances = await getOpenBalanceMinorByOrderIds("user-1", []);

    expect(balances).toEqual(new Map());
    expect(prismaMock.order.findMany).not.toHaveBeenCalled();
  });
});
