import { describe, expect, it } from "vitest";
import type {
  StoreDebtRow,
  StorePaymentAllocationLine,
  StorePaymentListRow,
} from "@/lib/data/orders/storePaymentQueries";
import {
  computeActiveOrdersProgressPercent,
  computeDebtOutsideActiveOrdersMinor,
  computePaymentProgressPercent,
  hasActiveOrderCommitment,
  effectivePaymentMinor,
  isOptimisticPaymentId,
  buildOptimisticPaymentId,
  resolveDebtReconciliationLine,
  resolvePaymentCoverage,
  resolveProgressState,
  sortDebtsByActionability,
  sumActiveAllocationMinor,
  sumLostAllocationMinor,
} from "@/lib/orders/storePaymentPresentation";

/**
 * Fixtures are built through these two helpers so every case is a complete `StoreDebtRow` /
 * `StorePaymentListRow` — the exact shapes `getStoreDebtByCurrency` and `getStorePaymentsForStore`
 * return and the store detail consumes. A partial literal would let a field drift out of the tests
 * without anything noticing.
 */
function debtRow(overrides: Partial<StoreDebtRow> = {}): StoreDebtRow {
  return {
    storeId: "store-1",
    currencyCode: "PEN",
    committedMinor: 0,
    paidMinor: 0,
    debtMinor: 0,
    lostMinor: 0,
    activeCommittedMinor: 0,
    activePaidMinor: 0,
    ...overrides,
  };
}

function allocationLine(overrides: Partial<StorePaymentAllocationLine> = {}): StorePaymentAllocationLine {
  const line = {
    orderId: "order-1",
    orderHumanReadableId: "ORD-20260805-07",
    orderCancelled: false,
    orderActive: true,
    orderItemId: null,
    orderItemName: null,
    amountMinor: 1000,
    settlesTarget: false,
    ...overrides,
  };
  // A cancelled order is never active, so `orderCancelled: true` alone must not leave a fixture
  // claiming both. Pass `orderActive` explicitly for the third case: delivered, and not cancelled.
  return { ...line, orderActive: overrides.orderActive ?? !line.orderCancelled };
}

function paymentRow(allocations: StorePaymentAllocationLine[], amount = 1000): StorePaymentListRow {
  return {
    id: "payment-1",
    amount,
    currencyCode: "PEN",
    paymentDate: new Date("2026-08-05T00:00:00.000Z"),
    note: null,
    allocatedTotal: allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0),
    claimingOrdersCount: new Set(allocations.map((allocation) => allocation.orderId)).size,
    allocations,
  };
}

describe("computePaymentProgressPercent", () => {
  it("never reads 100% while any debt is still live", () => {
    // Liliput plus one payment of 49.37: 99.5% of the way there, with 33.83 still owed. Rounding
    // would print "Falta 33.83 · 100%", a line that argues with itself.
    const pct = computePaymentProgressPercent(debtRow({ committedMinor: 676660, paidMinor: 673277, debtMinor: 3383 }));

    expect(Math.round((673277 / 676660) * 100)).toBe(100);
    expect(pct).toBe(99);
  });

  it("never reads 0% once any money has been handed over", () => {
    const pct = computePaymentProgressPercent(debtRow({ committedMinor: 1000000, paidMinor: 200, debtMinor: 999800 }));

    expect(Math.floor((200 / 1000000) * 100)).toBe(0);
    expect(pct).toBe(1);
  });

  it("reserves 100% for a debt of exactly zero and 0% for nothing paid", () => {
    expect(computePaymentProgressPercent(debtRow({ committedMinor: 25000, paidMinor: 25000, debtMinor: 0 }))).toBe(100);
    expect(computePaymentProgressPercent(debtRow({ committedMinor: 25000, paidMinor: 0, debtMinor: 25000 }))).toBe(0);
  });

  it("floors rather than rounds, so the figure never overstates what is paid", () => {
    // Pop Dealer Store, the collector's heaviest: 13,647.30 of 16,272.30 = 83.87%.
    expect(
      computePaymentProgressPercent(debtRow({ committedMinor: 1627230, paidMinor: 1364730, debtMinor: 262500 })),
    ).toBe(83);
  });

  it("reads 0% when nothing is committed, rather than dividing by zero", () => {
    expect(computePaymentProgressPercent(debtRow({ committedMinor: 0, paidMinor: 5000, debtMinor: -5000 }))).toBe(0);
  });
});

describe("computeActiveOrdersProgressPercent / hasActiveOrderCommitment", () => {
  it("measures the orders still in flight, not the store's whole history", () => {
    // Pop Dealer Store as the DB reads it today. The lifetime ratio is 13,917.30 / 16,272.30 = 85%
    // on a live debt of 2,355.00; the active-orders ratio is 1,519.60 / 3,874.60 = 39%.
    const debt = debtRow({
      committedMinor: 1627230,
      paidMinor: 1391730,
      debtMinor: 235500,
      activeCommittedMinor: 387460,
      activePaidMinor: 151960,
    });

    expect(computePaymentProgressPercent(debt)).toBe(85);
    expect(computeActiveOrdersProgressPercent(debt)).toBe(39);
  });

  it("restores the range the lifetime ratio had lost", () => {
    // The five store/currency pairs with a live debt today. The lifetime figures cluster at the
    // top (13, 68, 85, 91, 99) so the biggest debt in the collection and a debt 25 times smaller
    // are visually indistinguishable, and the small one looks worse. The active figures spread out.
    const rows = [
      debtRow({
        committedMinor: 1627230,
        paidMinor: 1391730,
        debtMinor: 235500,
        activeCommittedMinor: 387460,
        activePaidMinor: 151960,
      }),
      debtRow({
        committedMinor: 229000,
        paidMinor: 30000,
        debtMinor: 199000,
        activeCommittedMinor: 229000,
        activePaidMinor: 30000,
      }),
      debtRow({
        committedMinor: 440000,
        paidMinor: 301100,
        debtMinor: 138900,
        activeCommittedMinor: 173900,
        activePaidMinor: 35000,
      }),
      debtRow({
        committedMinor: 510300,
        paidMinor: 468300,
        debtMinor: 42000,
        activeCommittedMinor: 55000,
        activePaidMinor: 13000,
      }),
      debtRow({
        committedMinor: 1118270,
        paidMinor: 1108970,
        debtMinor: 9300,
        activeCommittedMinor: 21150,
        activePaidMinor: 11850,
      }),
    ];

    expect(rows.map(computePaymentProgressPercent)).toEqual([85, 13, 68, 91, 99]);
    expect(rows.map(computeActiveOrdersProgressPercent)).toEqual([39, 13, 20, 23, 56]);
  });

  it("has no denominator, and therefore no bar, when nothing is in flight", () => {
    // 112 of the collector's 122 store/currency pairs. The lifetime ratio happily returns 100%
    // here, which is exactly the "100% of nothing" the bar must not draw.
    const debt = debtRow({ committedMinor: 733500, paidMinor: 733500, debtMinor: 0 });

    expect(hasActiveOrderCommitment(debt)).toBe(false);
    expect(computeActiveOrdersProgressPercent(debt)).toBe(0);
  });

  it("cannot exceed 100 even when the active orders are over-declared", () => {
    const debt = debtRow({ activeCommittedMinor: 10000, activePaidMinor: 12000 });

    expect(hasActiveOrderCommitment(debt)).toBe(true);
    expect(computeActiveOrdersProgressPercent(debt)).toBe(100);
  });
});

describe("computeDebtOutsideActiveOrdersMinor", () => {
  it("is zero in every store today, which is what makes the headline agree with the bar's pair", () => {
    expect(
      computeDebtOutsideActiveOrdersMinor(
        debtRow({
          committedMinor: 1627230,
          paidMinor: 1391730,
          debtMinor: 235500,
          activeCommittedMinor: 387460,
          activePaidMinor: 151960,
        }),
      ),
    ).toBe(0);
  });

  it("names a debt left on an order that has already been delivered", () => {
    // The same store plus one delivered order of 270.00 that was never paid: the headline says
    // 2,625.00 while the bar's pair only accounts for 2,355.00 of it.
    expect(
      computeDebtOutsideActiveOrdersMinor(
        debtRow({
          committedMinor: 1654230,
          paidMinor: 1391730,
          debtMinor: 262500,
          activeCommittedMinor: 387460,
          activePaidMinor: 151960,
        }),
      ),
    ).toBe(27000);
  });

  it("goes negative for money handed over on account", () => {
    expect(
      computeDebtOutsideActiveOrdersMinor(
        debtRow({
          committedMinor: 25000,
          paidMinor: 41000,
          debtMinor: -16000,
          activeCommittedMinor: 25000,
          activePaidMinor: 25000,
        }),
      ),
    ).toBe(-16000);
  });
});

describe("resolveDebtReconciliationLine", () => {
  it("names a debt left on an order that has already been delivered", () => {
    expect(
      resolveDebtReconciliationLine(
        debtRow({
          committedMinor: 1654230,
          paidMinor: 1391730,
          debtMinor: 262500,
          activeCommittedMinor: 387460,
          activePaidMinor: 151960,
        }),
      ),
    ).toEqual({ kind: "outsideActiveOrders", amountMinor: 27000 });
  });

  it("names money handed over on account, which the headline reports but the bar's pair cannot", () => {
    // One active order of 250.00 with nothing declared against it, plus a payment of 100.00 on
    // account — an allocation-less submit, which the sheet treats as a first-class case. The
    // headline reads "Falta 150.00" while the bar's own pair says 250.00 is outstanding. Without
    // this line nothing on the page names the 100.00 that reconciles the two.
    expect(
      resolveDebtReconciliationLine(
        debtRow({
          committedMinor: 25000,
          paidMinor: 10000,
          debtMinor: 15000,
          activeCommittedMinor: 25000,
          activePaidMinor: 0,
        }),
      ),
    ).toEqual({ kind: "onAccount", amountMinor: 10000 });
  });

  it("names it on a store that is square too, where the gap is the whole of what was handed over", () => {
    // Debt exactly zero, so the headline is the "Al día" chip and says nothing about amounts, while
    // the bar still reads 0 of 250.00. `debtMinor === 0` is not the credit case and is not suppressed.
    expect(
      resolveDebtReconciliationLine(
        debtRow({
          committedMinor: 25000,
          paidMinor: 25000,
          debtMinor: 0,
          activeCommittedMinor: 25000,
          activePaidMinor: 0,
        }),
      ),
    ).toEqual({ kind: "onAccount", amountMinor: 25000 });
  });

  it("stays silent when the whole debt sits in the active orders, which is every store today", () => {
    expect(
      resolveDebtReconciliationLine(
        debtRow({
          committedMinor: 1627230,
          paidMinor: 1391730,
          debtMinor: 235500,
          activeCommittedMinor: 387460,
          activePaidMinor: 151960,
        }),
      ),
    ).toBeNull();
  });

  it("stays silent on a store in credit, where a second credit-shaped figure would be the noise", () => {
    expect(
      resolveDebtReconciliationLine(
        debtRow({
          committedMinor: 25000,
          paidMinor: 41000,
          debtMinor: -16000,
          activeCommittedMinor: 25000,
          activePaidMinor: 25000,
        }),
      ),
    ).toBeNull();
  });
});

describe("optimistic payment ids", () => {
  it("recognises the id it mints, and only that one", () => {
    expect(isOptimisticPaymentId(buildOptimisticPaymentId(1767225600000))).toBe(true);
    // A real `StorePayment.id` is a cuid.
    expect(isOptimisticPaymentId("cm5x0temp-not-optimistic")).toBe(false);
  });
});

describe("resolveProgressState", () => {
  it("names the three shapes the block can take", () => {
    expect(resolveProgressState(debtRow({ debtMinor: 2625 }))).toBe("owing");
    expect(resolveProgressState(debtRow({ debtMinor: 0 }))).toBe("settled");
    // No store in the collection is in credit today; the branch stays because `debtMinor` is
    // deliberately not clamped at zero and a real overpayment would land here.
    expect(resolveProgressState(debtRow({ debtMinor: -16000 }))).toBe("credit");
  });
});

describe("sortDebtsByActionability", () => {
  it("puts the currency with live debt first, whatever order the query built", () => {
    // Vaulted Store as the query returns it today: USD settled, PEN still owing 1,389.00.
    const sorted = sortDebtsByActionability([
      debtRow({ currencyCode: "USD", committedMinor: 42000, paidMinor: 42000, debtMinor: 0 }),
      debtRow({ currencyCode: "PEN", committedMinor: 440000, paidMinor: 301100, debtMinor: 138900 }),
    ]);

    expect(sorted.map((debt) => debt.currencyCode)).toEqual(["PEN", "USD"]);
  });

  it("falls back to the larger commitment when neither currency owes anything", () => {
    const sorted = sortDebtsByActionability([
      debtRow({ currencyCode: "USD", committedMinor: 115000, debtMinor: 0 }),
      debtRow({ currencyCode: "PEN", committedMinor: 732700, debtMinor: 0 }),
    ]);

    expect(sorted.map((debt) => debt.currencyCode)).toEqual(["PEN", "USD"]);
  });
});

describe("sumActiveAllocationMinor", () => {
  it("counts only the lines pointing at an order still in flight", () => {
    const payment = paymentRow([
      allocationLine({ amountMinor: 3000 }),
      allocationLine({
        orderId: "order-2",
        orderHumanReadableId: "ORD-20260805-08",
        amountMinor: 2000,
        orderActive: false,
      }),
      allocationLine({
        orderId: "order-3",
        orderHumanReadableId: "ORD-20260805-09",
        amountMinor: 1000,
        orderActive: false,
        orderCancelled: true,
      }),
    ]);

    // 30.00 of the 60.00 moves the bar. The 20.00 on a delivered order and the 10.00 sunk in a
    // cancelled one both pay down real debt and neither is progress on an order still coming.
    expect(sumActiveAllocationMinor(payment.allocations)).toBe(3000);
  });

  it("counts nothing for money handed over with nothing declared against it", () => {
    expect(sumActiveAllocationMinor(paymentRow([]).allocations)).toBe(0);
  });
});

describe("sumLostAllocationMinor / effectivePaymentMinor", () => {
  it("counts only the lines pointing at a cancelled order", () => {
    const payment = paymentRow(
      [
        allocationLine({ amountMinor: 2000, orderCancelled: true }),
        allocationLine({ orderId: "order-2", orderHumanReadableId: "ORD-20260805-08", amountMinor: 3000 }),
      ],
      5000,
    );

    expect(sumLostAllocationMinor(payment.allocations)).toBe(2000);
    expect(effectivePaymentMinor(payment)).toBe(3000);
  });

  it("reports a wholly sunk payment as moving nothing", () => {
    // Baúl Jare's 160.00, declared against ORD-20230130-01 after it was cancelled.
    const payment = paymentRow([allocationLine({ amountMinor: 16000, orderCancelled: true })], 16000);

    expect(effectivePaymentMinor(payment)).toBe(0);
  });
});

describe("resolvePaymentCoverage", () => {
  it("names the product for the 319 item-level declarations in the collection", () => {
    expect(
      resolvePaymentCoverage(
        paymentRow([allocationLine({ orderItemId: "item-1", orderItemName: "Chainsaw Man Vol. 3" })]),
      ),
    ).toEqual({
      kind: "item",
      orderId: "order-1",
      orderHumanReadableId: "ORD-20260805-07",
      orderCancelled: false,
      itemName: "Chainsaw Man Vol. 3",
      settled: false,
      hasUndetailedPart: false,
    });
  });

  it("names the whole order for the 288 order-level ones", () => {
    expect(resolvePaymentCoverage(paymentRow([allocationLine()]))).toMatchObject({
      kind: "order",
      orderHumanReadableId: "ORD-20260805-07",
    });
  });

  it("carries the cancelled flag through, so the row can mark sunk money", () => {
    expect(resolvePaymentCoverage(paymentRow([allocationLine({ orderCancelled: true })]))).toMatchObject({
      kind: "order",
      orderCancelled: true,
    });
  });

  it("counts products when several lines share one order", () => {
    expect(
      resolvePaymentCoverage(
        paymentRow([
          allocationLine({ orderItemId: "item-1", orderItemName: "A", amountMinor: 600 }),
          allocationLine({ orderItemId: "item-2", orderItemName: "B", amountMinor: 400 }),
        ]),
      ),
    ).toEqual({
      kind: "manyItems",
      orderId: "order-1",
      orderHumanReadableId: "ORD-20260805-07",
      orderCancelled: false,
      count: 2,
      hasUndetailedPart: false,
    });
  });

  /**
   * D4 — `count` counts PRODUCTS, not allocation rows.
   *
   * A payment broken down across an order's products carries an extra order-level line for the part
   * it did not itemize. Counting rows would report this payment as covering three products when it
   * names two, and the third "product" is the residual, which is not a product at all.
   */
  it("does not count the residual line as one more product", () => {
    expect(
      resolvePaymentCoverage(
        paymentRow(
          [
            allocationLine({ orderItemId: "item-1", orderItemName: "A", amountMinor: 600 }),
            allocationLine({ orderItemId: "item-2", orderItemName: "B", amountMinor: 400 }),
            allocationLine({ amountMinor: 250 }),
          ],
          1250,
        ),
      ),
    ).toEqual({
      kind: "manyItems",
      orderId: "order-1",
      orderHumanReadableId: "ORD-20260805-07",
      orderCancelled: false,
      count: 2,
      hasUndetailedPart: true,
    });
  });

  it("reads one product plus a residual as ONE product, and says the residual is there", () => {
    expect(
      resolvePaymentCoverage(
        paymentRow(
          [
            allocationLine({ orderItemId: "item-1", orderItemName: "A", amountMinor: 600 }),
            allocationLine({ amountMinor: 400 }),
          ],
          1000,
        ),
      ),
    ).toMatchObject({ kind: "item", itemName: "A", hasUndetailedPart: true });
  });

  it("still reads a payment with no product line at all as covering the order", () => {
    // Two order-level lines on one order: no product is named, so nothing about this is "many
    // items". Under the old row count it read as `manyItems` with a count of 2.
    expect(
      resolvePaymentCoverage(
        paymentRow([allocationLine({ amountMinor: 600 }), allocationLine({ amountMinor: 400 })], 1000),
      ),
    ).toMatchObject({ kind: "order", orderHumanReadableId: "ORD-20260805-07" });
  });

  it("counts orders when the lines span several, and says whether any is cancelled", () => {
    expect(
      resolvePaymentCoverage(
        paymentRow([
          allocationLine({ amountMinor: 600 }),
          allocationLine({
            orderId: "order-2",
            orderHumanReadableId: "ORD-20260814-02",
            amountMinor: 400,
            orderCancelled: true,
          }),
        ]),
      ),
    ).toEqual({ kind: "manyOrders", count: 2, anyCancelled: true });
  });

  it("marks a zero-amount `settlesTarget` line as settled rather than as 0.00", () => {
    expect(resolvePaymentCoverage(paymentRow([allocationLine({ amountMinor: 0, settlesTarget: true })]))).toMatchObject(
      {
        kind: "order",
        settled: true,
      },
    );
  });

  it("falls back to `unassigned` for a payment nothing was declared against", () => {
    expect(resolvePaymentCoverage(paymentRow([]))).toEqual({ kind: "unassigned" });
  });
});
