import { describe, expect, it } from "vitest";
import {
  buildAllocationInputs,
  buildBlockingLines,
  computeFillableMinor,
  buildDeclaredPaidItemIds,
  computeUnallocatedMinor,
  doesAllocationSumExceedPayment,
  doesPaymentExceedDebt,
  findOverAllocationCulprit,
  isDeclaredTotalCompleteAgainstPayment,
  isItemOverRemainingBase,
  isOrderDateBeforeOrder,
  isOrderOverAssignable,
  itemLineKey,
  resolveLineState,
  restLineKey,
  sumAllOrders,
  sumOrderDraft,
  validateStorePaymentSheetDraft,
  type SheetItemDraft,
  type SheetOrderDraft,
  type StorePaymentSheetDraft,
} from "../storePaymentSheetValidation";

const ORDER_DATE = new Date("2024-01-15T00:00:00.000Z");
const PAYMENT_DATE = new Date("2024-02-01T00:00:00.000Z");

function makeItem(overrides: Partial<SheetItemDraft> = {}): SheetItemDraft {
  return { itemId: "item-1", remainingBaseMinor: 1000, amountMinor: 0, declared: false, ...overrides };
}

function makeOrder(overrides: Partial<SheetOrderDraft> = {}): SheetOrderDraft {
  return {
    orderId: "order-1",
    orderDate: ORDER_DATE,
    assignableMinor: 2000,
    restCeilingMinor: 0,
    amountMinor: 0,
    items: [],
    ...overrides,
  };
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

describe("the sheet never emits a zero-amount line", () => {
  it("drops a product with nothing typed against it, however it got to zero", () => {
    const item = makeItem({ amountMinor: 0, remainingBaseMinor: 500 });
    expect(isItemOverRemainingBase(item)).toBe(false);
    expect(buildAllocationInputs([makeOrder({ items: [item] })])).toEqual([]);
  });

  it("drops an order whose rest line is empty", () => {
    expect(buildAllocationInputs([makeOrder({ amountMinor: 0 })])).toEqual([]);
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
        items: [makeItem({ itemId: "item-1", amountMinor: 300 }), makeItem({ itemId: "item-2", amountMinor: 0 })],
      }),
    ];
    expect(buildAllocationInputs(orders)).toEqual([
      { orderId: "order-1", amountMinor: 200 },
      { orderId: "order-1", orderItemId: "item-1", amountMinor: 300 },
    ]);
  });
});

describe("computeFillableMinor", () => {
  const base = {
    lineCeilingMinor: 5000,
    orderAssignableMinor: 5000,
    sumOtherLinesOfOrderMinor: 0,
    paymentAmountMinor: 5000,
    sumOtherLinesOfPaymentMinor: 0,
  };

  it("is capped by the line's own ceiling", () => {
    expect(computeFillableMinor({ ...base, lineCeilingMinor: 800 })).toBe(800);
  });

  it("is capped by what the order still has room for", () => {
    expect(computeFillableMinor({ ...base, orderAssignableMinor: 1200, sumOtherLinesOfOrderMinor: 400 })).toBe(800);
  });

  it("is capped by what is left of the payment", () => {
    expect(computeFillableMinor({ ...base, paymentAmountMinor: 1000, sumOtherLinesOfPaymentMinor: 700 })).toBe(300);
  });

  it("ignores a missing line ceiling (a product with no price on record)", () => {
    expect(computeFillableMinor({ ...base, lineCeilingMinor: null })).toBe(5000);
  });

  it("is 0 — which disables the button — once the payment is fully claimed elsewhere", () => {
    expect(computeFillableMinor({ ...base, sumOtherLinesOfPaymentMinor: 5000 })).toBe(0);
  });

  it("never goes negative when another line already overran a ceiling", () => {
    expect(computeFillableMinor({ ...base, sumOtherLinesOfOrderMinor: 9000 })).toBe(0);
  });
});

describe("resolveLineState", () => {
  it("is assignable while the product still owes something", () => {
    expect(resolveLineState({ remainingBaseMinor: 500 })).toBe("assignable");
  });

  it("is settled once the arithmetic says nothing is left", () => {
    expect(resolveLineState({ remainingBaseMinor: 0 })).toBe("settled");
    expect(resolveLineState({ remainingBaseMinor: -100 })).toBe("settled");
  });

  it("renders a legacy settlesTarget declaration exactly like an arithmetically paid product", () => {
    const byDeclaration = resolveLineState({ remainingBaseMinor: 500, settledByDeclaration: true });
    const byArithmetic = resolveLineState({ remainingBaseMinor: 0, settledByDeclaration: false });
    expect(byDeclaration).toBe(byArithmetic);
  });

  it("is unpriced when no base is known", () => {
    expect(resolveLineState({ remainingBaseMinor: null })).toBe("unpriced");
  });

  /**
   * The mark is its own state and must NEVER resolve to `settled`. `settled` is what makes the
   * row's amount field read-only, and a marked product that could no longer receive money would
   * push that money into "Resto del pedido", which names no product. The mark would then
   * MANUFACTURE the undetailed money the whole feature exists to reduce.
   */
  it("keeps a declared line out of `settled`, whatever its base", () => {
    expect(resolveLineState({ remainingBaseMinor: null, paidDeclared: true })).toBe("declared");
    expect(resolveLineState({ remainingBaseMinor: 500, paidDeclared: true })).toBe("declared");
    expect(resolveLineState({ remainingBaseMinor: 500, paidDeclared: true })).not.toBe("settled");
  });

  it("still lets the arithmetic outrank the mark when the base is already covered", () => {
    expect(resolveLineState({ remainingBaseMinor: 0, paidDeclared: true })).toBe("settled");
  });

  it("keeps a declared line's own ceiling exposed, so it can still receive money", () => {
    const declared = makeItem({ remainingBaseMinor: 500, amountMinor: 500, declared: true });
    // Right at its ceiling: legal. One over: refused, exactly as an unmarked line would be.
    expect(isItemOverRemainingBase(declared)).toBe(false);
    expect(isItemOverRemainingBase({ ...declared, amountMinor: 501 })).toBe(true);
  });
});

describe("buildDeclaredPaidItemIds", () => {
  it("collects only the products this payment declares, and no amounts", () => {
    const orders = [
      makeOrder({
        orderId: "order-1",
        items: [
          makeItem({ itemId: "item-1", declared: true }),
          makeItem({ itemId: "item-2", declared: false, amountMinor: 400 }),
        ],
      }),
      makeOrder({ orderId: "order-2", items: [makeItem({ itemId: "item-3", declared: true })] }),
    ];

    expect(buildDeclaredPaidItemIds(orders)).toEqual(["item-1", "item-3"]);
  });

  it("does not move a single money figure", () => {
    // The coverage axis enters no ceiling: the declared draft below allocates nothing, so
    // "Sin asignar" is the whole payment before anything is parked.
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 5000,
      debtMinor: 20000,
      paymentDate: PAYMENT_DATE,
      orders: [makeOrder({ items: [makeItem({ declared: true })] })],
    };

    expect(sumAllOrders(draft.orders)).toBe(0);
    expect(computeUnallocatedMinor(draft)).toBe(5000);
    expect(buildAllocationInputs(draft.orders)).toEqual([]);
    // WO-09 (`FR-05-58`): on this surface a sum of 0 is not by itself submittable any more — the
    // mark moves no money, so the whole 5000 still has to be either declared or parked. Parking it
    // in full is what makes the draft submittable, and marking the product alongside it still moves
    // nothing: the two axes stay independent.
    expect(validateStorePaymentSheetDraft({ ...draft, parkedAmountMinor: 5000 }).canSubmit).toBe(true);
    expect(validateStorePaymentSheetDraft(draft).canSubmit).toBe(false);
  });
});

describe("buildBlockingLines", () => {
  it("implicates only the offending product when it overruns its own base", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 5000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [
        makeOrder({
          assignableMinor: 5000,
          items: [
            makeItem({ itemId: "item-1", remainingBaseMinor: 200, amountMinor: 300 }),
            makeItem({ itemId: "item-2", remainingBaseMinor: 900, amountMinor: 100 }),
          ],
        }),
      ],
    };
    const lines = buildBlockingLines(draft);
    expect(lines.get(itemLineKey("order-1", "item-1"))).toBe("overItemBase");
    expect(lines.has(itemLineKey("order-1", "item-2"))).toBe(false);
  });

  it("implicates every line of an order that overruns its own balance", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 5000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [
        makeOrder({
          assignableMinor: 400,
          amountMinor: 300,
          items: [makeItem({ itemId: "item-1", remainingBaseMinor: 900, amountMinor: 300 })],
        }),
      ],
    };
    const lines = buildBlockingLines(draft);
    expect(lines.get(restLineKey("order-1"))).toBe("overOrderBalance");
    expect(lines.get(itemLineKey("order-1", "item-1"))).toBe("overOrderBalance");
  });

  it("implicates every line of an order the payment predates", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 5000,
      debtMinor: 5000,
      paymentDate: new Date("2024-01-01T00:00:00.000Z"),
      orders: [makeOrder({ assignableMinor: 5000, amountMinor: 300, items: [makeItem({ itemId: "item-1" })] })],
    };
    const lines = buildBlockingLines(draft);
    expect(lines.get(restLineKey("order-1"))).toBe("dateBeforeOrder");
    expect(lines.get(itemLineKey("order-1", "item-1"))).toBe("dateBeforeOrder");
  });

  it("is empty on a clean draft", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 5000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [makeOrder({ assignableMinor: 5000, amountMinor: 300 })],
    };
    expect(buildBlockingLines(draft).size).toBe(0);
  });
});

describe("findOverAllocationCulprit", () => {
  const draft: StorePaymentSheetDraft = {
    paymentAmountMinor: 100,
    debtMinor: 5000,
    paymentDate: ORDER_DATE,
    orders: [
      makeOrder({
        assignableMinor: 9000,
        amountMinor: 400,
        items: [
          makeItem({ itemId: "item-1", remainingBaseMinor: 9000, amountMinor: 100 }),
          makeItem({ itemId: "item-2", remainingBaseMinor: 9000, amountMinor: 900 }),
        ],
      }),
    ],
  };

  it("names the line the collector just touched", () => {
    expect(findOverAllocationCulprit(draft, itemLineKey("order-1", "item-1"))).toBe(itemLineKey("order-1", "item-1"));
  });

  it("falls back to the largest declared line when nothing was last edited", () => {
    expect(findOverAllocationCulprit(draft, null)).toBe(itemLineKey("order-1", "item-2"));
  });

  it("ignores a last-edited line that no longer declares anything", () => {
    expect(findOverAllocationCulprit(draft, "order-9:item-9")).toBe(itemLineKey("order-1", "item-2"));
  });

  it("names nothing when the draft declares nothing", () => {
    expect(findOverAllocationCulprit({ ...draft, orders: [makeOrder()] }, null)).toBeNull();
  });
});

/**
 * The store-level surface's own hardening (WO-09, `FR-05-58`, `ADR 0033`): the plain `<=` ceiling
 * becomes an equality on named allocations plus whatever the collector deliberately parked. A draft
 * with money left over and nothing parked is a legal, non-error state — it is simply not
 * submittable yet, which is exactly what {@link isDeclaredTotalCompleteAgainstPayment} and
 * `canSubmit` capture.
 */
describe("isDeclaredTotalCompleteAgainstPayment / canSubmit (WO-09 equality rule)", () => {
  it("cannot submit once money is left over and nothing is parked", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 1000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [makeOrder({ assignableMinor: 1000, amountMinor: 600 })],
    };
    expect(isDeclaredTotalCompleteAgainstPayment(draft)).toBe(false);
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.isDeclaredTotalComplete).toBe(false);
    expect(result.canSubmit).toBe(false);
  });

  it("can submit once the allocated sum plus the parked slice equal the payment", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 1000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [makeOrder({ assignableMinor: 1000, amountMinor: 600 })],
      parkedAmountMinor: 400,
    };
    expect(isDeclaredTotalCompleteAgainstPayment(draft)).toBe(true);
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.isDeclaredTotalComplete).toBe(true);
    expect(result.canSubmit).toBe(true);
    expect(result.parkedAmountMinor).toBe(400);
  });

  it("can submit fully parked, with nothing named against any order (spec §3.4)", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 1000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [],
      parkedAmountMinor: 1000,
    };
    expect(isDeclaredTotalCompleteAgainstPayment(draft)).toBe(true);
    expect(validateStorePaymentSheetDraft(draft).canSubmit).toBe(true);
  });

  it("defaults an omitted parkedAmountMinor to 0, so every pre-WO-09 draft literal keeps behaving the same way", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 1000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [makeOrder({ assignableMinor: 1000, amountMinor: 1000 })],
    };
    const result = validateStorePaymentSheetDraft(draft);
    expect(result.parkedAmountMinor).toBe(0);
    expect(result.canSubmit).toBe(true);
  });

  it("stays blocked when the sum alone already overshoots, however much is parked", () => {
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 1000,
      debtMinor: 5000,
      paymentDate: ORDER_DATE,
      orders: [makeOrder({ assignableMinor: 5000, amountMinor: 1200 })],
      parkedAmountMinor: 0,
    };
    expect(doesAllocationSumExceedPayment(draft)).toBe(true);
    expect(validateStorePaymentSheetDraft(draft).canSubmit).toBe(false);
  });
});
