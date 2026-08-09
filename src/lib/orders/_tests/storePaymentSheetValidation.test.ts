import { describe, expect, it } from "vitest";
import {
  buildAllocationInputs,
  computeUnallocatedMinor,
  doesAllocationSumExceedPayment,
  doesPaymentExceedDebt,
  isItemOverRemainingBase,
  isOrderDateBeforeOrder,
  isOrderOverAssignable,
  sumAllOrders,
  sumOrderDraft,
  validateStorePaymentSheetDraft,
  type SheetItemDraft,
  type SheetOrderDraft,
  type StorePaymentSheetDraft,
} from "../storePaymentSheetValidation";

const ORDER_DATE = new Date("2024-01-15T00:00:00.000Z");

function makeItem(overrides: Partial<SheetItemDraft> = {}): SheetItemDraft {
  return { itemId: "item-1", remainingBaseMinor: 1000, amountMinor: 0, settled: false, ...overrides };
}

function makeOrder(overrides: Partial<SheetOrderDraft> = {}): SheetOrderDraft {
  return { orderId: "order-1", orderDate: ORDER_DATE, assignableMinor: 2000, amountMinor: 0, items: [], ...overrides };
}

describe("sumOrderDraft / sumAllOrders", () => {
  it("sums the order's own line plus every product line", () => {
    const order = makeOrder({
      amountMinor: 300,
      items: [makeItem({ amountMinor: 200 }), makeItem({ amountMinor: 100 })],
    });
    expect(sumOrderDraft(order)).toBe(600);
  });

  it("sums across every order in the draft", () => {
    const orders = [makeOrder({ amountMinor: 100 }), makeOrder({ orderId: "order-2", amountMinor: 250 })];
    expect(sumAllOrders(orders)).toBe(350);
  });
});

describe("computeUnallocatedMinor (sum cap, never negative)", () => {
  it("subtracts declared amounts from the payment total", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 1000,
      debtMinor: 5000,
      paymentDate: null,
      orders: [makeOrder({ amountMinor: 400 })],
    };
    expect(computeUnallocatedMinor(draft)).toBe(600);
  });

  it("clamps at 0 instead of going negative when the draft over-allocates", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 500,
      debtMinor: 5000,
      paymentDate: null,
      orders: [makeOrder({ amountMinor: 800 })],
    };
    expect(computeUnallocatedMinor(draft)).toBe(0);
    expect(doesAllocationSumExceedPayment(draft)).toBe(true);
  });
});

describe("doesPaymentExceedDebt (deuda cap)", () => {
  it("is false when the payment is within the store's debt", () => {
    expect(doesPaymentExceedDebt(1000, 1000)).toBe(false);
    expect(doesPaymentExceedDebt(999, 1000)).toBe(false);
  });

  it("is true once the payment goes over the debt", () => {
    expect(doesPaymentExceedDebt(1001, 1000)).toBe(true);
  });
});

describe("isOrderOverAssignable (per-pedido cap)", () => {
  it("is false when declared total is within the order's assignable balance", () => {
    const order = makeOrder({ assignableMinor: 1000, amountMinor: 1000 });
    expect(isOrderOverAssignable(order)).toBe(false);
  });

  it("is true once the order's own line plus its items' lines exceed its balance", () => {
    const order = makeOrder({ assignableMinor: 1000, amountMinor: 600, items: [makeItem({ amountMinor: 500 })] });
    expect(isOrderOverAssignable(order)).toBe(true);
  });
});

describe("isItemOverRemainingBase (per-ítem cap)", () => {
  it("is false when the amount fits inside the remaining base", () => {
    expect(isItemOverRemainingBase(makeItem({ remainingBaseMinor: 500, amountMinor: 500 }))).toBe(false);
  });

  it("is true once the amount exceeds the remaining base", () => {
    expect(isItemOverRemainingBase(makeItem({ remainingBaseMinor: 500, amountMinor: 501 }))).toBe(true);
  });

  it("never fails when the item has no known base", () => {
    expect(isItemOverRemainingBase(makeItem({ remainingBaseMinor: null, amountMinor: 999_999 }))).toBe(false);
  });
});

describe("settlesTarget without an amount", () => {
  it("a settled item with amountMinor 0 is a legal declaration line", () => {
    const item = makeItem({ amountMinor: 0, settled: true, remainingBaseMinor: 500 });
    expect(isItemOverRemainingBase(item)).toBe(false);
    const inputs = buildAllocationInputs([makeOrder({ items: [item] })]);
    expect(inputs).toEqual([{ orderId: "order-1", orderItemId: "item-1", amountMinor: 0, settlesTarget: true }]);
  });

  it("an untouched item (amountMinor 0, not settled) produces no allocation line", () => {
    const item = makeItem({ amountMinor: 0, settled: false });
    const inputs = buildAllocationInputs([makeOrder({ items: [item] })]);
    expect(inputs).toEqual([]);
  });
});

describe("validateStorePaymentSheetDraft", () => {
  it("allows submission when every rule passes", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 1000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [makeOrder({ assignableMinor: 1000, amountMinor: 1000 })],
    };
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.canSubmit).toBe(true);
    expect(result.unallocatedMinor).toBe(0);
    expect(result.orderErrors.size).toBe(0);
    expect(result.itemErrors.size).toBe(0);
    expect(result.dateErrors.size).toBe(0);
  });

  it("blocks submission at 0 amount", () => {
    const draft: StorePaymentSheetDraft = { paymentAmountMinor: 0, debtMinor: 5000, paymentDate: null, orders: [] };
    expect(validateStorePaymentSheetDraft(draft).canSubmit).toBe(false);
  });

  it("blocks submission when the amount exceeds the store's debt", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 6000,
      debtMinor: 5000,
      paymentDate: null,
      orders: [],
    };
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.exceedsDebt).toBe(true);
    expect(result.canSubmit).toBe(false);
  });

  it("blocks submission and flags the order when a declaration exceeds its balance", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 5000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [makeOrder({ orderId: "order-9", assignableMinor: 1000, amountMinor: 1500 })],
    };
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.orderErrors.has("order-9")).toBe(true);
    expect(result.canSubmit).toBe(false);
  });

  it("blocks submission and flags the item when its declaration exceeds its remaining base", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 5000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [
        makeOrder({
          assignableMinor: 5000,
          items: [makeItem({ itemId: "item-9", remainingBaseMinor: 200, amountMinor: 300 })],
        }),
      ],
    };
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.itemErrors.has("item-9")).toBe(true);
    expect(result.canSubmit).toBe(false);
  });

  it("blocks submission and flags the order when the payment date is before an assigned order's own date", () => {
    const dayBeforeOrder = new Date("2024-01-14T00:00:00.000Z");
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 500,
      debtMinor: 5000,
      paymentDate: dayBeforeOrder,
      orders: [makeOrder({ orderId: "order-9", assignableMinor: 1000, amountMinor: 500 })],
    };
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.dateErrors.has("order-9")).toBe(true);
    expect(result.canSubmit).toBe(false);
  });

  it("does not flag an order with no declaration even when the payment predates it", () => {
    const dayBeforeOrder = new Date("2024-01-14T00:00:00.000Z");
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 500,
      debtMinor: 5000,
      paymentDate: dayBeforeOrder,
      // Untouched order (amountMinor 0, no items) — nothing declared against it yet, so the date
      // rule stays silent even though the picked date is before this order's own date.
      orders: [makeOrder({ orderId: "order-9", assignableMinor: 1000, amountMinor: 0 })],
    };
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.dateErrors.has("order-9")).toBe(false);
  });

  it("allows a payment dated exactly on the order's own date", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 500,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [makeOrder({ assignableMinor: 1000, amountMinor: 500 })],
    };
    expect(validateStorePaymentSheetDraft(draft).dateErrors.size).toBe(0);
  });
});

describe("isOrderDateBeforeOrder", () => {
  it("is false with no payment date yet", () => {
    expect(isOrderDateBeforeOrder(makeOrder({ amountMinor: 500 }), null)).toBe(false);
  });

  it("is false when nothing is declared against the order", () => {
    const before = new Date("2024-01-01T00:00:00.000Z");
    expect(isOrderDateBeforeOrder(makeOrder({ amountMinor: 0 }), before)).toBe(false);
  });

  it("is true once a declared order's payment date predates its own order date", () => {
    const before = new Date("2024-01-01T00:00:00.000Z");
    expect(isOrderDateBeforeOrder(makeOrder({ amountMinor: 500 }), before)).toBe(true);
  });

  it("is false when the payment date is on or after the order date", () => {
    expect(isOrderDateBeforeOrder(makeOrder({ amountMinor: 500 }), ORDER_DATE)).toBe(false);
  });
});

describe("buildAllocationInputs", () => {
  it("builds one line per order with a direct amount and one per declared product", () => {
    const orders: SheetOrderDraft[] = [
      makeOrder({
        orderId: "order-1",
        amountMinor: 200,
        items: [
          makeItem({ itemId: "item-1", amountMinor: 300 }),
          makeItem({ itemId: "item-2", amountMinor: 0, settled: false }),
        ],
      }),
    ];
    expect(buildAllocationInputs(orders)).toEqual([
      { orderId: "order-1", amountMinor: 200 },
      { orderId: "order-1", orderItemId: "item-1", amountMinor: 300, settlesTarget: false },
    ]);
  });
});
