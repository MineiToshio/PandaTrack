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
} from "../storePaymentQueries";

describe("getStoreDebtByCurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes CANCELLED orders from the committed side but counts every payment", async () => {
    prismaMock.order.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "USD", _sum: { totalCost: 8000 } },
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
      { storeId: "store-1", currencyCode: "USD", committedMinor: 8000, paidMinor: 3000, debtMinor: 5000 },
    ]);
  });

  it("does not clamp a negative debt when payments exceed what is committed", async () => {
    prismaMock.order.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "USD", _sum: { totalCost: 1000 } },
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "USD", _sum: { amount: 4000 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      { storeId: "store-1", currencyCode: "USD", committedMinor: 1000, paidMinor: 4000, debtMinor: -3000 },
    ]);
  });

  it("surfaces a store/currency pair backed only by payments (nothing currently committed)", async () => {
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "PEN", _sum: { amount: 1500 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      { storeId: "store-1", currencyCode: "PEN", committedMinor: 0, paidMinor: 1500, debtMinor: -1500 },
    ]);
  });

  it("surfaces a store/currency pair backed only by committed orders (nothing paid yet)", async () => {
    prismaMock.order.groupBy.mockResolvedValue([
      { storeId: "store-1", currencyCode: "PEN", _sum: { totalCost: 2000 } },
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      { storeId: "store-1", currencyCode: "PEN", committedMinor: 2000, paidMinor: 0, debtMinor: 2000 },
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
      { storeId: "store-baul-jare", currencyCode: "PEN", _sum: { totalCost: 25000 } },
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-baul-jare", currencyCode: "PEN", _sum: { amount: 41000 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([
      { amountMinor: 16000, payment: { storeId: "store-baul-jare", currencyCode: "PEN" } },
    ]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      { storeId: "store-baul-jare", currencyCode: "PEN", committedMinor: 25000, paidMinor: 25000, debtMinor: 0 },
    ]);
  });

  it("raises a store's live debt once lost-on-cancelled money is excluded from what is paid (Kenshin case)", async () => {
    // Synthetic reproduction of the Kenshin bug: 900 minor units were left declared lost against a
    // cancelled order. The old formula silently let that 900 count as if it still paid down the
    // store's live debt; it must not.
    prismaMock.order.groupBy.mockResolvedValue([
      { storeId: "store-kenshin", currencyCode: "PEN", _sum: { totalCost: 1118270 } },
    ]);
    prismaMock.storePayment.groupBy.mockResolvedValue([
      { storeId: "store-kenshin", currencyCode: "PEN", _sum: { amount: 1086870 } },
    ]);
    prismaMock.paymentAllocation.findMany.mockResolvedValue([
      { amountMinor: 900, payment: { storeId: "store-kenshin", currencyCode: "PEN" } },
    ]);

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      { storeId: "store-kenshin", currencyCode: "PEN", committedMinor: 1118270, paidMinor: 1085970, debtMinor: 32300 },
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

  it("maps each payment with its allocated total and allocation count", async () => {
    prismaMock.storePayment.findMany.mockResolvedValue([
      {
        id: "pay-1",
        amount: 1000,
        currencyCode: "USD",
        paymentDate: new Date("2024-02-01T00:00:00.000Z"),
        note: "Adelanto",
        allocations: [{ amountMinor: 300 }, { amountMinor: 200 }],
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
        allocationsCount: 2,
      },
      {
        id: "pay-2",
        amount: 500,
        currencyCode: "USD",
        paymentDate: new Date("2024-01-01T00:00:00.000Z"),
        note: null,
        allocatedTotal: 0,
        allocationsCount: 0,
      },
    ]);
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
