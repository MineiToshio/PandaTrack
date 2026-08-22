import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { createOrder, editOrder } from "../orderMutations";
import { OrderStatus } from "../../../../../generated/prisma/client";
import type { OrderCreateInput, OrderEditInput } from "@/lib/orders/orderValidation";

/**
 * Write-side half of the FX single-source-of-truth model: every path that persists a rate must also
 * persist the base currency it was entered against, because that pair is what the dashboard rollup
 * and the `?fxPending=true` list both derive "needs reconciliation" from (ADR 0024).
 */

type FakeTx = {
  store: { findFirst: ReturnType<typeof vi.fn> };
  storeProductType: { findMany: ReturnType<typeof vi.fn> };
  order: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  orderItem: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  orderHistory: { create: ReturnType<typeof vi.fn> };
  paymentAllocation: {
    findFirst: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  deliveryOrderItem: { findFirst: ReturnType<typeof vi.fn> };
  storeAccountAdjustmentLine: {
    findFirst: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeFakeTx(baseCurrencyCode: string | null): FakeTx {
  return {
    store: { findFirst: vi.fn().mockResolvedValue({ id: "store-1" }) },
    storeProductType: { findMany: vi.fn().mockResolvedValue([]) },
    order: {
      findFirst: vi.fn().mockResolvedValue({ status: OrderStatus.OPEN, storeId: "store-1", currencyCode: "USD" }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "order-1", humanReadableId: "ORD-20260803-01" }),
      update: vi.fn().mockResolvedValue({}),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: "item-1" }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    orderHistory: { create: vi.fn().mockResolvedValue({}) },
    paymentAllocation: {
      findFirst: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    deliveryOrderItem: { findFirst: vi.fn().mockResolvedValue(null) },
    storeAccountAdjustmentLine: {
      findFirst: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode }) },
  };
}

function useTx(tx: FakeTx): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

const createInput: OrderCreateInput = {
  storeId: "store-1",
  orderDate: new Date("2026-08-03T00:00:00.000Z"),
  currencyCode: "USD",
  totalCost: 10000,
};

describe("createOrder rate provenance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps a supplied rate with the collector's current base currency", async () => {
    const tx = makeFakeTx("PEN");
    useTx(tx);

    await createOrder("user-1", { ...createInput, exchangeRate: 3.39 });

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: 3.39, exchangeRateBaseCode: "PEN" }),
      }),
    );
  });

  it("records no base when the order is created without a rate, so it reads as FX-pending", async () => {
    const tx = makeFakeTx("PEN");
    useTx(tx);

    await createOrder("user-1", createInput);

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: null, exchangeRateBaseCode: null }),
      }),
    );
  });

  it("records no base when the collector has not configured a base currency yet", async () => {
    const tx = makeFakeTx(null);
    useTx(tx);

    await createOrder("user-1", { ...createInput, exchangeRate: 3.39 });

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ exchangeRateBaseCode: null }) }),
    );
  });

  it("drops a submitted rate when the order is in the base currency itself", async () => {
    // The 1.1 incident shape: a rate on a base-currency order is invisible to reconciliation
    // while the base stays put and a wrong "reconciled" claim if the base ever moves.
    const tx = makeFakeTx("PEN");
    useTx(tx);

    await createOrder("user-1", { ...createInput, currencyCode: "PEN", exchangeRate: 1.1 });

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: null, exchangeRateBaseCode: null }),
      }),
    );
  });
});

describe("editOrder rate provenance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("re-stamps the base when the edit submits a rate", async () => {
    const tx = makeFakeTx("PEN");
    useTx(tx);

    await editOrder("order-1", "user-1", { exchangeRate: 3.39 } as OrderEditInput);

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: 3.39, exchangeRateBaseCode: "PEN" }),
      }),
    );
  });

  it("clears the base when the edit removes the rate, leaving no stale claim of being reconciled", async () => {
    const tx = makeFakeTx("PEN");
    useTx(tx);

    await editOrder("order-1", "user-1", { exchangeRate: null } as OrderEditInput);

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: null, exchangeRateBaseCode: null }),
      }),
    );
  });

  it("leaves both fields untouched when the edit does not submit a rate", async () => {
    // Re-stamping here would be wrong: it would relabel an old rate as if it targeted the current
    // base, quietly marking an unreconciled order as reconciled.
    const tx = makeFakeTx("PEN");
    useTx(tx);

    await editOrder("order-1", "user-1", { note: "just a note" } as OrderEditInput);

    const data = tx.order.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("exchangeRate");
    expect(data).not.toHaveProperty("exchangeRateBaseCode");
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });

  it("drops a submitted rate when the order sits in the base currency", async () => {
    const tx = makeFakeTx("PEN");
    tx.order.findFirst.mockResolvedValue({ status: OrderStatus.OPEN, storeId: "store-1", currencyCode: "PEN" });
    useTx(tx);

    await editOrder("order-1", "user-1", { exchangeRate: 1.1 } as OrderEditInput);

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: null, exchangeRateBaseCode: null }),
      }),
    );
  });

  it("clears the old pair when the edit moves the order into the base currency without a rate", async () => {
    // Restating a USD order as PEN (base PEN) leaves the old USD rate meaningless; keeping it
    // would recreate the exact artifact the base-currency guard exists to prevent.
    const tx = makeFakeTx("PEN");
    useTx(tx);

    await editOrder("order-1", "user-1", { currencyCode: "PEN" } as OrderEditInput);

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exchangeRate: null, exchangeRateBaseCode: null }),
      }),
    );
  });
});
