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
 *
 * FR-05-68 (WO-11) widens `editOrder`'s three guards to count a `StoreAccountAdjustmentLine`
 * alongside a `PaymentAllocation`: a line is deliberately not an allocation, so without this
 * widening all three guards pass an order that has been written off (see the work order's
 * Technical Notes). `hasAdjustmentLine` / `adjustmentLineMinor` below feed exactly that gap.
 */

type EditOrderTx = {
  order: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  store: { findFirst: ReturnType<typeof vi.fn> };
  paymentAllocation: { findFirst: ReturnType<typeof vi.fn> };
  storeAccountAdjustmentLine: { findFirst: ReturnType<typeof vi.fn>; groupBy: ReturnType<typeof vi.fn> };
  deliveryOrderItem: { findFirst: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeEditOrderTx(
  overrides: {
    storeId?: string;
    currencyCode?: string;
    totalCost?: number;
    allocatedAmountMinor?: number;
    hasAllocations?: boolean;
    /** Whether `order-1` carries a `StoreAccountAdjustmentLine` (the widened existence read). */
    hasAdjustmentLine?: boolean;
    /**
     * `Σ StoreAccountAdjustmentLine.amountMinor` against `order-1`, fed to the
     * `storeAccountAdjustmentLine.groupBy` read `declaredAgainstOrderMinor` performs through
     * `openBalanceMinorByOrderId`. Independent of `hasAdjustmentLine`: the existence guard and the
     * ceiling arithmetic are two different reads in the real code, so a test can exercise either.
     */
    adjustmentLineMinor?: number;
  } = {},
): EditOrderTx {
  const {
    storeId = "store-1",
    currencyCode = "USD",
    totalCost = 100000,
    allocatedAmountMinor = 0,
    hasAllocations = false,
    hasAdjustmentLine = false,
    adjustmentLineMinor = 0,
  } = overrides;
  return {
    order: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ status: OrderStatus.OPEN, storeId, currencyCode, allocatedAmountMinor, totalCost }),
      update: vi.fn().mockResolvedValue({}),
    },
    // Only reached once the store-change guard has already let the edit through; kept resolvable
    // so a guard failing to fire surfaces as a clean `{ ok: true }` rather than a crash here.
    store: { findFirst: vi.fn().mockResolvedValue({ id: "store-2" }) },
    paymentAllocation: {
      findFirst: vi.fn().mockResolvedValue(hasAllocations ? { id: "alloc-1" } : null),
    },
    storeAccountAdjustmentLine: {
      findFirst: vi.fn().mockResolvedValue(hasAdjustmentLine ? { id: "line-1" } : null),
      groupBy: vi
        .fn()
        .mockResolvedValue(
          adjustmentLineMinor > 0 ? [{ orderId: "order-1", _sum: { amountMinor: adjustmentLineMinor } }] : [],
        ),
    },
    deliveryOrderItem: { findFirst: vi.fn().mockResolvedValue(null) },
    // Read by the base-currency FX guard when the edit restates the currency.
    user: { findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: "PEN" }) },
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

describe("editOrder order-edit guards count adjustment lines (FR-05-68, WO-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses TOTAL_BELOW_PAID against Σ allocations + Σ lines (150), not allocatedAmountMinor (50) alone", async () => {
    // Order of 180: allocation 50 + adjustment line 100 = 150 declared against it. Lowering the
    // total to 120 must be refused: the OLD comparison (against 50 alone) would accept it and drive
    // `openBalanceMinor` to 180 - 50 - 100 - ... negative, with nothing left to catch it.
    const tx = makeEditOrderTx({
      totalCost: 180,
      allocatedAmountMinor: 50,
      hasAllocations: true,
      hasAdjustmentLine: true,
      adjustmentLineMinor: 100,
    });
    runWith(tx);

    const result = await editOrder("order-1", "user-1", { totalCost: 120 } as OrderEditInput);

    expect(result).toEqual({ ok: false, error: "TOTAL_BELOW_PAID" });
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("refuses CURRENCY_CHANGE_BLOCKED on an order that carries only an adjustment line", async () => {
    // No PaymentAllocation at all: the OLD `hasAllocations`-only condition would let this edit pass
    // and carry the write-off across currencies.
    const tx = makeEditOrderTx({ currencyCode: "USD", hasAllocations: false, hasAdjustmentLine: true });
    runWith(tx);

    const result = await editOrder("order-1", "user-1", { currencyCode: "PEN" } as OrderEditInput);

    expect(result).toEqual({ ok: false, error: "CURRENCY_CHANGE_BLOCKED" });
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("refuses STORE_CHANGE_BLOCKED on an order that carries only an adjustment line", async () => {
    // No PaymentAllocation at all: the OLD `hasAllocations`-only condition would let the order move,
    // leaving the line reducing a store that never declared it.
    const tx = makeEditOrderTx({ storeId: "store-1", hasAllocations: false, hasAdjustmentLine: true });
    runWith(tx);

    const result = await editOrder("order-1", "user-1", { storeId: "store-2" } as OrderEditInput);

    expect(result).toEqual({ ok: false, error: "STORE_CHANGE_BLOCKED" });
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("fires none of the three guards on an order that carries neither an allocation nor a line", async () => {
    const tx = makeEditOrderTx({
      currencyCode: "USD",
      totalCost: 180,
      allocatedAmountMinor: 0,
      hasAllocations: false,
      hasAdjustmentLine: false,
    });
    runWith(tx);

    const result = await editOrder("order-1", "user-1", {
      currencyCode: "PEN",
      totalCost: 0,
    } as OrderEditInput);

    expect(result).toEqual({ ok: true });
    expect(tx.order.update).toHaveBeenCalled();
  });

  it("accepts the total edited down to exactly Σ allocations + Σ lines (openBalanceMinor lands on 0)", async () => {
    const tx = makeEditOrderTx({
      totalCost: 180,
      allocatedAmountMinor: 50,
      hasAllocations: true,
      hasAdjustmentLine: true,
      adjustmentLineMinor: 100,
    });
    runWith(tx);

    const result = await editOrder("order-1", "user-1", { totalCost: 150 } as OrderEditInput);

    expect(result).toEqual({ ok: true });
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalCost: 150 }) }),
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
        findMany: vi.fn().mockResolvedValue([{ id: "existing-item", paidDeclaredAt: null }]),
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
        findMany: vi.fn().mockResolvedValue([{ id: "item-1", paidDeclaredAt: null }]),
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
        findMany: vi.fn().mockResolvedValue([{ id: "item-1", paidDeclaredAt: null }]),
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
