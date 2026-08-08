import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    storePayment: { groupBy: vi.fn(), aggregate: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import { getStoreDebtByCurrency, getStoreDebtMinor, resolveInheritedStoreCurrency } from "../storePaymentQueries";

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

    const rows = await getStoreDebtByCurrency("user-1");

    expect(rows).toEqual([
      { storeId: "store-1", currencyCode: "PEN", committedMinor: 2000, paidMinor: 0, debtMinor: 2000 },
    ]);
  });

  it("narrows both queries to a single store when one is given", async () => {
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.storePayment.groupBy.mockResolvedValue([]);

    await getStoreDebtByCurrency("user-1", "store-1");

    expect(prismaMock.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", status: { not: OrderStatus.CANCELLED }, storeId: "store-1" },
      }),
    );
    expect(prismaMock.storePayment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", storeId: "store-1" } }),
    );
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
  });

  it("returns a negative debt uncapped when the store was overpaid", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 1000 } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 6000 } }) },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    expect(debt).toBe(-5000);
  });

  it("treats missing aggregates as zero", async () => {
    const tx = {
      order: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: null } }) },
      storePayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
    };

    const debt = await getStoreDebtMinor(tx as never, "user-1", "store-1", "USD");

    expect(debt).toBe(0);
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
