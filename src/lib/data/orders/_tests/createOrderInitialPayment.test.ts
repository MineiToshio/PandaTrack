import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { createOrder } from "../orderMutations";
import type { OrderCreateInput } from "@/lib/orders/orderValidation";

/**
 * `createOrder`'s optional `initialPayment` (a deposit reported at creation time) is validated
 * while the order row is still unwritten, and written in the same transaction via
 * `writeStorePaymentWithAllocations`. These tests cover the two things unique to that path: the
 * advance's own ceiling (the order's `totalCost`, not the store's outstanding debt), and that a
 * refusal on it leaves no phantom order behind — the same all-or-nothing guarantee the rest of
 * `createOrder`'s refusals already have (ADR 0022).
 */

type FakeTx = {
  store: { findFirst: ReturnType<typeof vi.fn> };
  storeProductType: { findMany: ReturnType<typeof vi.fn> };
  order: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  orderItem: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  orderHistory: { create: ReturnType<typeof vi.fn> };
  storePayment: { create: ReturnType<typeof vi.fn> };
  paymentAllocation: { createMany: ReturnType<typeof vi.fn>; groupBy: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeFakeTx(createdItemIds: string[] = []): FakeTx {
  return {
    store: { findFirst: vi.fn().mockResolvedValue({ id: "store-1" }) },
    storeProductType: { findMany: vi.fn().mockResolvedValue([]) },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "order-1", humanReadableId: "ORD-20260808-01" }),
      // `recalculateOrderAllocationCache`'s own write, scoped to `{ id, userId }` (defense in depth).
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue(createdItemIds.map((id) => ({ id }))),
      createMany: vi.fn().mockResolvedValue({ count: createdItemIds.length }),
    },
    orderHistory: { create: vi.fn().mockResolvedValue({}) },
    storePayment: { create: vi.fn().mockResolvedValue({ id: "payment-new" }) },
    paymentAllocation: { createMany: vi.fn().mockResolvedValue({ count: 0 }), groupBy: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: null }) },
  };
}

function useTx(tx: FakeTx): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

const baseInput: OrderCreateInput = {
  storeId: "store-1",
  orderDate: new Date("2026-08-01T00:00:00.000Z"),
  currencyCode: "USD",
  totalCost: 10000,
};

describe("createOrder with an initial payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the order and its advance in the same transaction", async () => {
    const tx = makeFakeTx();
    useTx(tx);

    const result = await createOrder("user-1", {
      ...baseInput,
      initialPayment: { amount: 4000, paymentDate: new Date("2026-08-01T00:00:00.000Z") },
    });

    expect(result).toEqual({
      ok: true,
      orderId: "order-1",
      humanReadableId: "ORD-20260808-01",
      // An advance was declared with the order, so `order-registered` already ran in this same
      // transaction: nothing is left to defer (`FR-12-05`).
      progression: { pointsDelta: 0, rankUp: null, medalsUnlocked: [], deferredOrderPoints: null },
    });
    expect(tx.storePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storeId: "store-1", amount: 4000, currencyCode: "USD" }),
      }),
    );
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ orderId: "order-1", orderItemId: null, amountMinor: 4000, settlesTarget: false }),
      ],
    });
  });

  it("declares the advance against the order's single item when it has exactly one", async () => {
    const tx = makeFakeTx(["item-1"]);
    useTx(tx);

    await createOrder("user-1", {
      ...baseInput,
      items: [{ name: "Figure", quantity: 1, position: 1 }],
      initialPayment: { amount: 4000, paymentDate: new Date("2026-08-01T00:00:00.000Z") },
    });

    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ orderItemId: "item-1" })],
    });
  });

  it("refuses INITIAL_PAYMENT_INVALID when the advance exceeds the order's total, creating nothing", async () => {
    const tx = makeFakeTx();
    useTx(tx);

    const result = await createOrder("user-1", {
      ...baseInput,
      totalCost: 3000,
      initialPayment: { amount: 3001, paymentDate: new Date("2026-08-01T00:00:00.000Z") },
    });

    expect(result).toEqual({ ok: false, error: "INITIAL_PAYMENT_INVALID" });
    // The refusal is decided before `order.create`, so nothing at all is written: not the order,
    // not the deposit. A refusal placed after the write would COMMIT the transaction it returned
    // from normally, phantom-creating the order while reporting failure (ADR 0022).
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.storePayment.create).not.toHaveBeenCalled();
    expect(tx.orderHistory.create).not.toHaveBeenCalled();
  });

  it("accepts an advance exactly equal to the order's total", async () => {
    const tx = makeFakeTx();
    useTx(tx);

    const result = await createOrder("user-1", {
      ...baseInput,
      totalCost: 3000,
      initialPayment: { amount: 3000, paymentDate: new Date("2026-08-01T00:00:00.000Z") },
    });

    expect(result).toMatchObject({ ok: true });
    expect(tx.storePayment.create).toHaveBeenCalled();
  });

  it("refuses INITIAL_PAYMENT_INVALID for a non-positive advance, creating nothing", async () => {
    const tx = makeFakeTx();
    useTx(tx);

    const result = await createOrder("user-1", {
      ...baseInput,
      initialPayment: { amount: 0, paymentDate: new Date("2026-08-01T00:00:00.000Z") },
    });

    expect(result).toEqual({ ok: false, error: "INITIAL_PAYMENT_INVALID" });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("creates the order normally with no advance at all", async () => {
    const tx = makeFakeTx();
    useTx(tx);

    const result = await createOrder("user-1", baseInput);

    expect(result).toMatchObject({ ok: true });
    expect(tx.storePayment.create).not.toHaveBeenCalled();
  });
});
