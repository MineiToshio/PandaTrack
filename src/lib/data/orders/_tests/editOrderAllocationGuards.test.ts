import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import { editOrder } from "../orderMutations";
import { replaceOrderItems } from "../orderItemMutations";
import type { Prisma } from "../../../../../generated/prisma/client";
import type { OrderEditInput } from "@/lib/orders/orderValidation";

/**
 * A declaration pins the store, the currency, and the item it names in place. These are the
 * three guards `editOrder`/`replaceOrderItems` added for that: moving currency, deleting a
 * declared-against item, or dropping an item's price below what is already declared on it.
 */

type EditOrderTx = {
  order: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  paymentAllocation: { findFirst: ReturnType<typeof vi.fn> };
  deliveryOrderItem: { findFirst: ReturnType<typeof vi.fn> };
};

function makeEditOrderTx(
  overrides: {
    storeId?: string;
    currencyCode?: string;
    allocatedAmountMinor?: number;
    hasAllocations?: boolean;
  } = {},
): EditOrderTx {
  const { storeId = "store-1", currencyCode = "USD", allocatedAmountMinor = 0, hasAllocations = false } = overrides;
  return {
    order: {
      findFirst: vi.fn().mockResolvedValue({ status: OrderStatus.OPEN, storeId, currencyCode, allocatedAmountMinor }),
      update: vi.fn().mockResolvedValue({}),
    },
    paymentAllocation: {
      findFirst: vi.fn().mockResolvedValue(hasAllocations ? { id: "alloc-1" } : null),
    },
    deliveryOrderItem: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

function runWith(tx: EditOrderTx): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

describe("editOrder allocation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses CURRENCY_CHANGE_BLOCKED when the order carries a declaration and the edit restates the currency", async () => {
    const tx = makeEditOrderTx({ currencyCode: "USD", hasAllocations: true });
    runWith(tx);

    const result = await editOrder("order-1", "user-1", { currencyCode: "PEN" } as OrderEditInput);

    expect(result).toEqual({ ok: false, error: "CURRENCY_CHANGE_BLOCKED" });
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("allows a currency change when nothing has been declared against the order yet", async () => {
    const tx = makeEditOrderTx({ currencyCode: "USD", hasAllocations: false });
    runWith(tx);

    const result = await editOrder("order-1", "user-1", { currencyCode: "PEN" } as OrderEditInput);

    expect(result).toEqual({ ok: true });
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currencyCode: "PEN" }) }),
    );
  });
});

describe("replaceOrderItems allocation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function asTransactionClient(tx: unknown): Prisma.TransactionClient {
    return tx as Prisma.TransactionClient;
  }

  it("refuses ITEM_HAS_ALLOCATION when a removed item already has money declared against it", async () => {
    const tx = {
      storeProductType: { findMany: vi.fn().mockResolvedValue([]) },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([{ id: "existing-item" }]),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      paymentAllocation: {
        groupBy: vi.fn().mockResolvedValue([{ orderItemId: "existing-item", _sum: { amountMinor: 500 } }]),
      },
      deliveryOrderItem: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    // "existing-item" is absent from the submitted list, so the replace would delete it.
    const result = await replaceOrderItems(asTransactionClient(tx), "order-1", "user-1", [
      { name: "New item", quantity: 1, position: 1 },
    ]);

    expect(result).toEqual({ ok: false, error: "ITEM_HAS_ALLOCATION", detail: "existing-item" });
    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses ITEM_PRICE_BELOW_ALLOCATED when a kept item's new price is under what is already declared", async () => {
    const tx = {
      storeProductType: { findMany: vi.fn().mockResolvedValue([]) },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([{ id: "item-1" }]),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      paymentAllocation: {
        groupBy: vi.fn().mockResolvedValue([{ orderItemId: "item-1", _sum: { amountMinor: 900 } }]),
      },
      deliveryOrderItem: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    // 800 declared-and-kept price is below the 900 already allocated to it.
    const result = await replaceOrderItems(asTransactionClient(tx), "order-1", "user-1", [
      { id: "item-1", name: "Figure", quantity: 1, unitPrice: 800, position: 1 },
    ]);

    expect(result).toEqual({ ok: false, error: "ITEM_PRICE_BELOW_ALLOCATED", detail: "item-1" });
    expect(tx.orderItem.update).not.toHaveBeenCalled();
  });

  it("allows the price to stay at or above what is already allocated", async () => {
    const tx = {
      storeProductType: { findMany: vi.fn().mockResolvedValue([]) },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([{ id: "item-1" }]),
        deleteMany: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      paymentAllocation: {
        groupBy: vi.fn().mockResolvedValue([{ orderItemId: "item-1", _sum: { amountMinor: 900 } }]),
      },
      deliveryOrderItem: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    const result = await replaceOrderItems(asTransactionClient(tx), "order-1", "user-1", [
      { id: "item-1", name: "Figure", quantity: 1, unitPrice: 900, position: 1 },
    ]);

    expect(result).toEqual({ ok: true });
    expect(tx.orderItem.update).toHaveBeenCalled();
  });
});
