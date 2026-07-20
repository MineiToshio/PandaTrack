import { describe, expect, it } from "vitest";
import { buildDashboardData } from "../dashboardAggregation";
import type { BuildDashboardDataInput, DashboardDeliveryInput, DashboardOrderInput } from "../dashboardTypes";

const NOW = new Date("2026-07-15T12:00:00Z");
const utc = (year: number, monthIndex: number, day: number): Date => new Date(Date.UTC(year, monthIndex, day));

function makeOrder(overrides: Partial<DashboardOrderInput> & { id: string }): DashboardOrderInput {
  const base: DashboardOrderInput = {
    id: overrides.id,
    humanReadableId: `PT-${overrides.id}`,
    orderDate: utc(2026, 6, 1),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    currencyCode: "USD",
    exchangeRate: null,
    needsExchangeRateUpdate: false,
    totalCost: 0,
    status: "OPEN",
    store: { id: "store-1", name: "Store One", slug: "store-one" },
    items: [],
    payments: [],
  };
  return { ...base, ...overrides };
}

function makeDelivery(overrides: Partial<DashboardDeliveryInput> & { id: string }): DashboardDeliveryInput {
  const base: DashboardDeliveryInput = {
    id: overrides.id,
    cost: 0,
    currencyCode: "USD",
    exchangeRate: null,
    needsExchangeRateUpdate: false,
    deliveryDate: utc(2026, 6, 1),
    status: "IN_TRANSIT",
  };
  return { ...base, ...overrides };
}

function build(orders: DashboardOrderInput[], overrides: Partial<BuildDashboardDataInput> = {}) {
  return buildDashboardData({
    orders,
    deliveries: [],
    now: NOW,
    timezone: "UTC",
    baseCurrencyCode: "USD",
    budgetAmountMinor: null,
    budgetResetDayOfMonth: null,
    ...overrides,
  });
}

describe("buildDashboardData - cash obligations", () => {
  it("folds overdue balances into a pagar este mes (AC-06-01)", () => {
    const data = build([
      makeOrder({ id: "current", expectedDeliveryFrom: utc(2026, 6, 20), totalCost: 10000 }),
      makeOrder({ id: "overdue", expectedDeliveryFrom: utc(2026, 4, 10), totalCost: 5000 }),
    ]);
    expect(data.cashObligations.currentMonth).toEqual({
      totalMinor: 15000,
      isPartial: false,
      excludedOrderCount: 0,
    });
    // The overdue slice names only the already-past balance.
    expect(data.cashObligations.overdue.totalMinor).toBe(5000);
  });

  it("excludes no-date orders from dated obligations and surfaces them separately (AC-06-02)", () => {
    const data = build([
      makeOrder({ id: "noDate", expectedDeliveryFrom: null, totalCost: 3000 }),
      makeOrder({ id: "current", expectedDeliveryFrom: utc(2026, 6, 10), totalCost: 2000 }),
    ]);
    expect(data.cashObligations.currentMonth.totalMinor).toBe(2000);
    expect(data.cashObligations.noDateOutstanding.totalMinor).toBe(3000);
    expect(data.cashObligations.upcomingMonths.every((month) => month.totalMinor === 0)).toBe(true);
  });

  it("buckets forward obligations by expected-arrival month", () => {
    const data = build([
      makeOrder({ id: "aug", expectedDeliveryFrom: utc(2026, 7, 5), totalCost: 4000 }),
      makeOrder({ id: "sep", expectedDeliveryFrom: utc(2026, 8, 1), totalCost: 6000 }),
    ]);
    expect(data.cashObligations.upcomingMonths).toEqual([
      { year: 2026, month: 8, totalMinor: 4000 },
      { year: 2026, month: 9, totalMinor: 6000 },
      { year: 2026, month: 10, totalMinor: 0 },
    ]);
  });

  it("lists per-order upcoming payments sorted by due date", () => {
    const data = build([
      makeOrder({ id: "later", expectedDeliveryFrom: utc(2026, 7, 20), totalCost: 4000 }),
      makeOrder({
        id: "sooner",
        expectedDeliveryFrom: utc(2026, 6, 5),
        totalCost: 2000,
        payments: [{ amount: 500, paymentDate: utc(2026, 6, 3) }],
      }),
    ]);
    const list = data.cashObligations.upcomingPayments;
    expect(list.map((payment) => payment.orderId)).toEqual(["sooner", "later"]);
    expect(list[0]).toMatchObject({ outstandingMinor: 1500, baseOutstandingMinor: 1500, isFxPending: false });
  });
});

describe("buildDashboardData - spend and budget", () => {
  it("counts partial payments in the current-month disbursed total (AC-06-04)", () => {
    const data = build([
      makeOrder({ id: "current", totalCost: 10000, payments: [{ amount: 2500, paymentDate: utc(2026, 6, 5) }] }),
      makeOrder({ id: "otherMonth", totalCost: 10000, payments: [{ amount: 9999, paymentDate: utc(2026, 5, 5) }] }),
    ]);
    expect(data.spend.currentMonthMinor).toBe(2500);
  });

  it("keeps current-period metrics independent of the trend range", () => {
    const rangeExcludingJuly = { start: utc(2026, 0, 1), end: utc(2026, 3, 1) };
    const data = build(
      [makeOrder({ id: "current", totalCost: 10000, payments: [{ amount: 2500, paymentDate: utc(2026, 6, 5) }] })],
      { range: rangeExcludingJuly },
    );
    // Current-month disbursed still reflects July even though the range is Jan-Mar.
    expect(data.spend.currentMonthMinor).toBe(2500);
    expect(data.spend.monthlySeries).toHaveLength(3);
    expect(data.spend.monthlySeries.every((month) => month.totalMinor === 0)).toBe(true);
  });

  it("merges non-cancelled delivery shipping cost into the current-month disbursed total (FR-06-07, BR-06-04)", () => {
    const data = build(
      [makeOrder({ id: "current", totalCost: 10000, payments: [{ amount: 2500, paymentDate: utc(2026, 6, 5) }] })],
      {
        deliveries: [
          makeDelivery({ id: "shipped", cost: 800, deliveryDate: utc(2026, 6, 10) }),
          makeDelivery({ id: "otherMonth", cost: 500, deliveryDate: utc(2026, 5, 10) }),
          makeDelivery({ id: "cancelled", cost: 999, deliveryDate: utc(2026, 6, 12), status: "CANCELLED" }),
        ],
      },
    );
    expect(data.spend.currentMonthMinor).toBe(3300);
  });

  it("buckets delivery shipping cost by deliveryDate month in the spend chart (FR-06-08, BR-06-04)", () => {
    const range = { start: utc(2026, 4, 1), end: utc(2026, 7, 1) }; // May, Jun, Jul 2026
    const data = build([], {
      deliveries: [
        makeDelivery({ id: "may", cost: 600, deliveryDate: utc(2026, 4, 15) }),
        makeDelivery({ id: "jul", cost: 900, deliveryDate: utc(2026, 6, 1) }),
      ],
      range,
    });
    expect(data.spend.monthlySeries).toEqual([
      { year: 2026, month: 5, totalMinor: 600 },
      { year: 2026, month: 6, totalMinor: 0 },
      { year: 2026, month: 7, totalMinor: 900 },
    ]);
  });

  it("never plots delivery cost as its own series — it is only ever summed into the combined spend total (BR-06-09)", () => {
    const withOnlyOrder = build([
      makeOrder({ id: "o", totalCost: 10000, payments: [{ amount: 1000, paymentDate: utc(2026, 6, 5) }] }),
    ]);
    const withOrderAndDelivery = build(
      [makeOrder({ id: "o", totalCost: 10000, payments: [{ amount: 1000, paymentDate: utc(2026, 6, 5) }] })],
      { deliveries: [makeDelivery({ id: "d", cost: 500, deliveryDate: utc(2026, 6, 5) })] },
    );
    // Adding a delivery only raises the one combined total — no parallel field appears.
    expect(Object.keys(withOrderAndDelivery.spend)).toEqual(Object.keys(withOnlyOrder.spend));
    expect(withOrderAndDelivery.spend.currentMonthMinor).toBe(withOnlyOrder.spend.currentMonthMinor + 500);
  });

  it("excludes an FX-pending delivery from the spend total and marks it partial, like an FX-pending order", () => {
    const data = build([], {
      deliveries: [
        makeDelivery({
          id: "fx",
          cost: 5000,
          currencyCode: "EUR",
          exchangeRate: 1.1,
          needsExchangeRateUpdate: true,
          deliveryDate: utc(2026, 6, 10),
        }),
        makeDelivery({ id: "usd", cost: 300, deliveryDate: utc(2026, 6, 10) }),
      ],
    });
    expect(data.spend.currentMonthMinor).toBe(300);
    expect(data.spend.currentMonthIsPartial).toBe(true);
  });

  it("resolves budget status thresholds over the current cycle (AC-06-03)", () => {
    const warningData = build(
      [makeOrder({ id: "o", totalCost: 20000, payments: [{ amount: 8500, paymentDate: utc(2026, 6, 10) }] })],
      { budgetAmountMinor: 10000, budgetResetDayOfMonth: 1 },
    );
    expect(warningData.budget.percentage).toBe(85);
    expect(warningData.budget.status).toBe("warning");

    const overData = build(
      [makeOrder({ id: "o", totalCost: 20000, payments: [{ amount: 12000, paymentDate: utc(2026, 6, 10) }] })],
      { budgetAmountMinor: 10000, budgetResetDayOfMonth: 1 },
    );
    expect(overData.budget.status).toBe("over");

    const underData = build(
      [makeOrder({ id: "o", totalCost: 20000, payments: [{ amount: 5000, paymentDate: utc(2026, 6, 10) }] })],
      { budgetAmountMinor: 10000, budgetResetDayOfMonth: 1 },
    );
    expect(underData.budget.status).toBe("under");
  });

  it("resolves budget thresholds at their exact boundaries", () => {
    const budgetWith = (paidMinor: number) =>
      build(
        [makeOrder({ id: "o", totalCost: 100000, payments: [{ amount: paidMinor, paymentDate: utc(2026, 6, 10) }] })],
        {
          budgetAmountMinor: 10000,
          budgetResetDayOfMonth: 1,
        },
      ).budget;

    // Just below the amber band.
    expect(budgetWith(7999).status).toBe("under");
    // Exactly 80% is amber (inclusive lower bound).
    expect(budgetWith(8000).status).toBe("warning");
    // Exactly 100% is still amber (inclusive upper bound), not red.
    expect(budgetWith(10000).status).toBe("warning");
    // A single minor unit above budget is red, even though the display percentage floors to 100.
    const justOver = budgetWith(10040);
    expect(justOver.percentage).toBe(100);
    expect(justOver.status).toBe("over");
  });

  it("reports the configured reset day, not the current cycle's clamped start day", () => {
    // Reset day 31 in a cycle that started on 30 June (a 30-day month) still reads back as 31.
    const data = build([makeOrder({ id: "o", totalCost: 10000 })], {
      budgetAmountMinor: 10000,
      budgetResetDayOfMonth: 31,
    });
    expect(data.budget.cycleStart.getUTCDate()).toBe(30);
    expect(data.budget.resetDayOfMonth).toBe(31);
  });

  it("reports a null reset day as the last-day-of-month setting", () => {
    const data = build([makeOrder({ id: "o", totalCost: 10000 })], { budgetAmountMinor: 10000 });
    expect(data.budget.resetDayOfMonth).toBeNull();
  });

  it("marks the budget as not configured when no amount is set", () => {
    const data = build([makeOrder({ id: "o", totalCost: 10000 })]);
    expect(data.budget.isConfigured).toBe(false);
    expect(data.budget.percentage).toBeNull();
    expect(data.budget.status).toBeNull();
  });
});

describe("buildDashboardData - deuda viva trend", () => {
  const range = { start: utc(2026, 0, 1), end: utc(2026, 3, 1) }; // Jan, Feb, Mar 2026

  it("reconstructs the outstanding balance at each month-end", () => {
    const data = build(
      [
        makeOrder({
          id: "jan",
          orderDate: utc(2026, 0, 10),
          totalCost: 10000,
          payments: [{ amount: 4000, paymentDate: utc(2026, 1, 5) }],
        }),
      ],
      { range },
    );
    // Placed in January and unpaid at its close; the February payment only reduces it from Feb on.
    expect(data.outstandingTrend.series).toEqual([
      { year: 2026, month: 1, totalMinor: 10000 },
      { year: 2026, month: 2, totalMinor: 6000 },
      { year: 2026, month: 3, totalMinor: 6000 },
    ]);
  });

  it("excludes orders that had not been placed yet at a given month-end", () => {
    const data = build([makeOrder({ id: "mar", orderDate: utc(2026, 2, 3), totalCost: 5000 })], { range });
    expect(data.outstandingTrend.series.map((month) => month.totalMinor)).toEqual([0, 0, 5000]);
  });

  it("excludes cancelled orders and flags FX-pending exclusions as partial", () => {
    const data = build(
      [
        makeOrder({ id: "cancelled", orderDate: utc(2026, 0, 2), status: "CANCELLED", totalCost: 9999 }),
        makeOrder({
          id: "fx",
          orderDate: utc(2026, 0, 2),
          currencyCode: "EUR",
          exchangeRate: 1.1,
          needsExchangeRateUpdate: true,
          totalCost: 5000,
        }),
        makeOrder({ id: "usd", orderDate: utc(2026, 0, 2), totalCost: 3000 }),
      ],
      { range },
    );
    expect(data.outstandingTrend.series[0]).toEqual({ year: 2026, month: 1, totalMinor: 3000 });
    expect(data.outstandingTrend.isPartial).toBe(true);
  });
});

describe("buildDashboardData - exclusions and FX", () => {
  it("excludes CANCELLED orders from every rollup", () => {
    const data = build([
      makeOrder({ id: "open", totalCost: 10000, expectedDeliveryFrom: utc(2026, 6, 10) }),
      makeOrder({ id: "cancelled", status: "CANCELLED", totalCost: 9999, expectedDeliveryFrom: utc(2026, 6, 10) }),
    ]);
    expect(data.cashObligations.totalOutstanding.totalMinor).toBe(10000);
    expect(data.collection.totalOrders).toBe(1);
  });

  it("excludes FX-pending orders and flags partial totals (AC-06-05)", () => {
    const data = build([
      makeOrder({ id: "usd", totalCost: 10000 }),
      makeOrder({ id: "eur", currencyCode: "EUR", exchangeRate: 1.1, needsExchangeRateUpdate: true, totalCost: 5000 }),
    ]);
    expect(data.cashObligations.totalOutstanding.totalMinor).toBe(10000);
    expect(data.cashObligations.totalOutstanding.isPartial).toBe(true);
    expect(data.cashObligations.totalOutstanding.excludedOrderCount).toBe(1);
  });

  it("converts reconciled foreign orders via their stored rate", () => {
    const data = build([
      makeOrder({ id: "usd", totalCost: 5000 }),
      makeOrder({ id: "eur", currencyCode: "EUR", exchangeRate: 1.1, totalCost: 10000 }),
    ]);
    expect(data.cashObligations.totalOutstanding.totalMinor).toBe(16000);
    expect(data.cashObligations.totalOutstanding.isPartial).toBe(false);
  });

  it("reports base currency as not configured when unset", () => {
    const data = build([makeOrder({ id: "o", totalCost: 10000 })], { baseCurrencyCode: null });
    expect(data.baseCurrencyConfigured).toBe(false);
    expect(data.cashObligations.totalOutstanding.totalMinor).toBe(0);
  });
});

describe("buildDashboardData - lost on cancelled (BR-06-10)", () => {
  it("sums payments retained on a cancelled order as lost money", () => {
    const data = build([
      makeOrder({
        id: "cancelledWithPayments",
        status: "CANCELLED",
        totalCost: 20000,
        payments: [
          { amount: 12000, paymentDate: utc(2026, 5, 10) },
          { amount: 4000, paymentDate: utc(2026, 5, 20) },
        ],
      }),
    ]);
    expect(data.lostOnCancelled.totalMinor).toBe(16000);
    expect(data.lostOnCancelled.totalMinor).toBeGreaterThan(0);
    // The retained payments never leak into the disbursed-spend series or any live rollup.
    expect(data.spend.currentMonthMinor).toBe(0);
    expect(data.paidVsOutstanding.paidMinor).toBe(0);
    expect(data.collection.totalOrders).toBe(0);
  });

  it("reports zero when the cancelled order has no payments", () => {
    const data = build([makeOrder({ id: "cancelledClean", status: "CANCELLED", totalCost: 9999 })]);
    expect(data.lostOnCancelled.totalMinor).toBe(0);
    expect(data.lostOnCancelled.isPartial).toBe(false);
  });

  it("ignores payments on non-cancelled orders", () => {
    const data = build([
      makeOrder({ id: "open", totalCost: 10000, payments: [{ amount: 5000, paymentDate: utc(2026, 5, 5) }] }),
    ]);
    expect(data.lostOnCancelled.totalMinor).toBe(0);
  });

  it("excludes an FX-unreconciled cancelled order and flags the figure partial", () => {
    const data = build([
      makeOrder({
        id: "fxCancelled",
        status: "CANCELLED",
        currencyCode: "EUR",
        exchangeRate: 1.1,
        needsExchangeRateUpdate: true,
        totalCost: 10000,
        payments: [{ amount: 8000, paymentDate: utc(2026, 5, 5) }],
      }),
      makeOrder({
        id: "usdCancelled",
        status: "CANCELLED",
        totalCost: 10000,
        payments: [{ amount: 3000, paymentDate: utc(2026, 5, 5) }],
      }),
    ]);
    // Only the reconciled cancelled order contributes; the FX-pending one is dropped and flagged.
    expect(data.lostOnCancelled.totalMinor).toBe(3000);
    expect(data.lostOnCancelled.isPartial).toBe(true);
    expect(data.lostOnCancelled.excludedOrderCount).toBe(1);
  });

  it("converts a reconciled foreign cancelled order via its stored rate", () => {
    const data = build([
      makeOrder({
        id: "eurCancelled",
        status: "CANCELLED",
        currencyCode: "EUR",
        exchangeRate: 1.1,
        totalCost: 10000,
        payments: [{ amount: 5000, paymentDate: utc(2026, 5, 5) }],
      }),
    ]);
    expect(data.lostOnCancelled.totalMinor).toBe(5500);
  });

  it("reports zero when no base currency is configured", () => {
    const data = build(
      [
        makeOrder({
          id: "cancelledWithPayments",
          status: "CANCELLED",
          totalCost: 20000,
          payments: [{ amount: 12000, paymentDate: utc(2026, 5, 10) }],
        }),
      ],
      { baseCurrencyCode: null },
    );
    expect(data.lostOnCancelled.totalMinor).toBe(0);
  });
});

describe("buildDashboardData - arrival punctuality", () => {
  const arrivedItem = (deliveryDates: Date[]) => [
    { quantity: 1, productTypeKey: null, unitPrice: null, deliveryState: "DELIVERED" as const, deliveryDates },
  ];

  it("counts an order that shipped within its window as on time", () => {
    const data = build([
      makeOrder({
        id: "onTime",
        expectedDeliveryFrom: utc(2026, 0, 1),
        expectedDeliveryTo: utc(2026, 0, 10),
        items: arrivedItem([utc(2026, 0, 8)]),
      }),
    ]);
    expect(data.activity.punctuality).toEqual({ onTimeCount: 1, lateCount: 0, unknownCount: 0 });
  });

  it("counts an order that shipped after its window as late", () => {
    const data = build([
      makeOrder({
        id: "late",
        expectedDeliveryFrom: utc(2026, 0, 1),
        expectedDeliveryTo: utc(2026, 0, 10),
        items: arrivedItem([utc(2026, 0, 20)]),
      }),
    ]);
    expect(data.activity.punctuality).toEqual({ onTimeCount: 0, lateCount: 1, unknownCount: 0 });
  });

  it("keeps a long-past on-time arrival on time no matter how much later the dashboard is read", () => {
    // Regression: judging the window against `now` would reclassify every historical arrival as late.
    const data = build([
      makeOrder({
        id: "lastJanuary",
        expectedDeliveryFrom: utc(2026, 0, 1),
        expectedDeliveryTo: utc(2026, 0, 10),
        items: arrivedItem([utc(2026, 0, 5)]),
      }),
    ]);
    expect(data.generatedAt.getTime()).toBeGreaterThan(utc(2026, 0, 10).getTime());
    expect(data.activity.punctuality.lateCount).toBe(0);
    expect(data.activity.punctuality.onTimeCount).toBe(1);
  });

  it("cannot judge an arrival with no dated evidence, or one with no expected window", () => {
    const data = build([
      // Flagged arrived by hand: no delivery, so no arrival date exists.
      makeOrder({
        id: "noEvidence",
        expectedDeliveryFrom: utc(2026, 0, 1),
        expectedDeliveryTo: utc(2026, 0, 10),
        items: [
          { quantity: 1, productTypeKey: null, unitPrice: null, deliveryState: "ARRIVED_AT_STORE", deliveryDates: [] },
        ],
      }),
      // Delivered, but the collector never estimated a window to judge it against.
      makeOrder({ id: "noWindow", items: arrivedItem([utc(2026, 0, 5)]) }),
    ]);
    expect(data.activity.punctuality).toEqual({ onTimeCount: 0, lateCount: 0, unknownCount: 2 });
  });

  it("ignores orders that have not arrived at all", () => {
    const data = build([
      makeOrder({
        id: "pending",
        expectedDeliveryFrom: utc(2026, 0, 1),
        expectedDeliveryTo: utc(2026, 0, 10),
        items: [{ quantity: 1, productTypeKey: null, unitPrice: null, deliveryState: "NONE", deliveryDates: [] }],
      }),
    ]);
    expect(data.activity.punctuality).toEqual({ onTimeCount: 0, lateCount: 0, unknownCount: 0 });
  });
});

describe("buildDashboardData - activity and collection", () => {
  it("counts an order as arrived once any item leaves NONE (AC-06-07)", () => {
    const data = build([
      makeOrder({
        id: "arrived",
        orderDate: utc(2026, 6, 1),
        expectedDeliveryFrom: utc(2026, 6, 1),
        items: [
          {
            quantity: 1,
            productTypeKey: "figure",
            unitPrice: 1000,
            deliveryState: "ARRIVED_AT_STORE",
            deliveryDates: [],
          },
        ],
      }),
      makeOrder({
        id: "notArrived",
        orderDate: utc(2026, 6, 1),
        expectedDeliveryFrom: utc(2026, 6, 1),
        items: [{ quantity: 1, productTypeKey: "figure", unitPrice: 1000, deliveryState: "NONE", deliveryDates: [] }],
      }),
    ]);
    const july = data.activity.placedVsArrived.find((month) => month.month === 7 && month.year === 2026);
    expect(july).toMatchObject({ placedCount: 2, arrivedCount: 1 });
  });

  it("buckets an arrived order by its dated delivery evidence, not its expected window", () => {
    const data = build(
      [
        makeOrder({
          id: "arrived",
          orderDate: utc(2026, 0, 5),
          expectedDeliveryFrom: utc(2026, 0, 20),
          // Dispatched in March, so the arrival belongs to March, not to the January window.
          items: [
            {
              quantity: 1,
              productTypeKey: null,
              unitPrice: null,
              deliveryState: "DELIVERED",
              deliveryDates: [utc(2026, 2, 4)],
            },
          ],
        }),
      ],
      { range: { start: utc(2026, 0, 1), end: utc(2026, 3, 1) } },
    );
    expect(data.activity.placedVsArrived).toEqual([
      { year: 2026, month: 1, placedCount: 1, arrivedCount: 0 },
      { year: 2026, month: 2, placedCount: 0, arrivedCount: 0 },
      { year: 2026, month: 3, placedCount: 0, arrivedCount: 1 },
    ]);
  });

  it("splits upcoming and overdue arrivals by their expected window", () => {
    const data = build([
      makeOrder({
        id: "soon",
        expectedDeliveryFrom: utc(2026, 6, 20),
        items: [{ quantity: 1, productTypeKey: null, unitPrice: null, deliveryState: "NONE", deliveryDates: [] }],
      }),
      makeOrder({
        id: "late",
        expectedDeliveryFrom: utc(2026, 4, 1),
        expectedDeliveryTo: utc(2026, 4, 10),
        items: [{ quantity: 1, productTypeKey: null, unitPrice: null, deliveryState: "NONE", deliveryDates: [] }],
      }),
    ]);
    expect(data.activity.upcomingArrivals.map((order) => order.orderId)).toEqual(["soon"]);
    expect(data.activity.overdueArrivals.map((order) => order.orderId)).toEqual(["late"]);
  });

  it("aggregates collection totals, product counts, and committed spend by type", () => {
    const data = build([
      makeOrder({
        id: "o1",
        totalCost: 3000,
        store: { id: "store-a", name: "Store A", slug: "store-a" },
        items: [
          { quantity: 2, productTypeKey: "figure", unitPrice: 1000, deliveryState: "NONE", deliveryDates: [] },
          { quantity: 1, productTypeKey: "manga", unitPrice: 1000, deliveryState: "NONE", deliveryDates: [] },
        ],
      }),
    ]);
    expect(data.collection.totalOrders).toBe(1);
    expect(data.collection.totalProducts).toBe(3);
    expect(data.collection.productCountByType).toContainEqual({ productTypeKey: "figure", quantity: 2 });
    expect(data.collection.spendByType).toContainEqual({ productTypeKey: "figure", committedMinor: 2000 });
    expect(data.collection.topStores[0]).toMatchObject({
      storeId: "store-a",
      storeSlug: "store-a",
      committedMinor: 3000,
      orderCount: 1,
    });
  });

  it("distributes an order's committed value across its items by line value", () => {
    const data = build([
      makeOrder({
        id: "priced",
        totalCost: 3000,
        items: [
          { quantity: 2, productTypeKey: "figures", unitPrice: 1000, deliveryState: "NONE", deliveryDates: [] },
          { quantity: 1, productTypeKey: "manga", unitPrice: 1000, deliveryState: "NONE", deliveryDates: [] },
        ],
      }),
    ]);
    expect(data.collection.spendByType).toEqual([
      { productTypeKey: "figures", committedMinor: 2000 },
      { productTypeKey: "manga", committedMinor: 1000 },
    ]);
  });

  it("falls back to quantity when no item carries a unit price, instead of reporting zero", () => {
    // Regression: summing `unitPrice × quantity` reported nothing for orders priced only at order level.
    const data = build([
      makeOrder({
        id: "unpriced",
        totalCost: 4000,
        items: [
          { quantity: 3, productTypeKey: "figures", unitPrice: null, deliveryState: "NONE", deliveryDates: [] },
          { quantity: 1, productTypeKey: "manga", unitPrice: null, deliveryState: "NONE", deliveryDates: [] },
        ],
      }),
    ]);
    expect(data.collection.spendByType).toEqual([
      { productTypeKey: "figures", committedMinor: 3000 },
      { productTypeKey: "manga", committedMinor: 1000 },
    ]);
  });

  it("keeps the by-type split summing to the committed total it is drawn from", () => {
    const data = build([
      makeOrder({
        id: "a",
        totalCost: 1000,
        items: [{ quantity: 3, productTypeKey: "figures", unitPrice: null, deliveryState: "NONE", deliveryDates: [] }],
      }),
      makeOrder({
        id: "b",
        totalCost: 2500,
        items: [
          { quantity: 1, productTypeKey: "manga", unitPrice: 500, deliveryState: "NONE", deliveryDates: [] },
          { quantity: 1, productTypeKey: "books", unitPrice: 500, deliveryState: "NONE", deliveryDates: [] },
        ],
      }),
    ]);
    const byTypeTotal = data.collection.spendByType.reduce((sum, entry) => sum + entry.committedMinor, 0);
    expect(byTypeTotal).toBe(data.paidVsOutstanding.committedMinor);
  });

  it("skips an order with no items rather than dropping its committed value into an unknown bucket", () => {
    const data = build([makeOrder({ id: "noItems", totalCost: 5000, items: [] })]);
    expect(data.collection.spendByType).toEqual([]);
  });

  it("counts distinct stores and excludes cancelled orders from the collection totals", () => {
    const item = {
      quantity: 2,
      productTypeKey: "figure",
      unitPrice: 1000,
      deliveryState: "NONE" as const,
      deliveryDates: [],
    };
    const data = build([
      makeOrder({
        id: "a1",
        store: { id: "store-a", name: "Store A", slug: "store-a" },
        totalCost: 2000,
        items: [item],
      }),
      makeOrder({
        id: "a2",
        store: { id: "store-a", name: "Store A", slug: "store-a" },
        totalCost: 2000,
        items: [item],
      }),
      makeOrder({
        id: "b1",
        store: { id: "store-b", name: "Store B", slug: "store-b" },
        totalCost: 2000,
        items: [item],
      }),
      makeOrder({
        id: "cancelled",
        status: "CANCELLED",
        store: { id: "store-c", name: "Store C", slug: "store-c" },
        totalCost: 9999,
        items: [item],
      }),
    ]);
    // The cancelled order contributes neither its store, nor its products, nor its count.
    expect(data.collection.totalOrders).toBe(3);
    expect(data.collection.totalProducts).toBe(6);
    expect(data.collection.totalStores).toBe(2);
    expect(data.collection.topStores.map((store) => store.storeId)).toEqual(["store-a", "store-b"]);
  });

  it("ranks top stores by committed value, then by order count", () => {
    const data = build([
      makeOrder({ id: "small", store: { id: "store-a", name: "Store A", slug: "store-a" }, totalCost: 1000 }),
      makeOrder({ id: "big", store: { id: "store-b", name: "Store B", slug: "store-b" }, totalCost: 9000 }),
    ]);
    expect(data.collection.topStores.map((store) => store.storeId)).toEqual(["store-b", "store-a"]);
  });

  it("splits committed value into paid and outstanding", () => {
    const data = build([
      makeOrder({ id: "o", totalCost: 10000, payments: [{ amount: 4000, paymentDate: utc(2026, 6, 5) }] }),
    ]);
    expect(data.paidVsOutstanding).toMatchObject({
      committedMinor: 10000,
      paidMinor: 4000,
      outstandingMinor: 6000,
      isPartial: false,
    });
  });
});

describe("buildDashboardData - order summaries carry a base-currency amount", () => {
  it("converts a foreign order whose exchange rate is reconciled", () => {
    const data = build([makeOrder({ id: "a", currencyCode: "PEN", exchangeRate: 0.27, totalCost: 10_000 })], {
      baseCurrencyCode: "USD",
    });

    const [summary] = data.activity.recentOrders;
    expect(summary.baseTotalCostMinor).toBe(2_700);
    expect(summary.isFxPending).toBe(false);
  });

  it("leaves the base amount null for an FX-pending order, so it reads in its own currency", () => {
    const data = build(
      [
        makeOrder({
          id: "a",
          currencyCode: "JPY",
          exchangeRate: 0.0067,
          needsExchangeRateUpdate: true,
          totalCost: 980_000,
        }),
      ],
      { baseCurrencyCode: "USD" },
    );

    const [summary] = data.activity.recentOrders;
    expect(summary.baseTotalCostMinor).toBeNull();
    expect(summary.isFxPending).toBe(true);
    expect(summary.currencyCode).toBe("JPY");
  });
});
