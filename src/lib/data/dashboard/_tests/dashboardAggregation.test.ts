import { describe, expect, it } from "vitest";
import { buildDashboardData } from "../dashboardAggregation";
import type { BuildDashboardDataInput, DashboardOrderInput } from "../dashboardTypes";

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
    store: { id: "store-1", name: "Store One" },
    items: [],
    payments: [],
  };
  return { ...base, ...overrides };
}

function build(orders: DashboardOrderInput[], overrides: Partial<BuildDashboardDataInput> = {}) {
  return buildDashboardData({
    orders,
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

  it("buckets forward obligations by expected-arrival month (FR-06-03)", () => {
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

  it("lists per-order upcoming payments sorted by due date (FR-06-18)", () => {
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

  it("keeps current-period metrics independent of the trend range (FR-06-12/AC-06-06)", () => {
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

  it("resolves budget thresholds at their exact boundaries (FR-06-06)", () => {
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

describe("buildDashboardData - exclusions and FX", () => {
  it("excludes CANCELLED orders from every rollup (BR-06-07)", () => {
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

describe("buildDashboardData - activity and collection", () => {
  it("counts an order as arrived once any item leaves NONE (AC-06-07)", () => {
    const data = build([
      makeOrder({
        id: "arrived",
        orderDate: utc(2026, 6, 1),
        expectedDeliveryFrom: utc(2026, 6, 1),
        items: [{ quantity: 1, productTypeKey: "figure", unitPrice: 1000, deliveryState: "ARRIVED_AT_STORE" }],
      }),
      makeOrder({
        id: "notArrived",
        orderDate: utc(2026, 6, 1),
        expectedDeliveryFrom: utc(2026, 6, 1),
        items: [{ quantity: 1, productTypeKey: "figure", unitPrice: 1000, deliveryState: "NONE" }],
      }),
    ]);
    const july = data.activity.placedVsArrived.find((month) => month.month === 7 && month.year === 2026);
    expect(july).toMatchObject({ placedCount: 2, arrivedCount: 1 });
  });

  it("splits upcoming and overdue arrivals by their expected window", () => {
    const data = build([
      makeOrder({
        id: "soon",
        expectedDeliveryFrom: utc(2026, 6, 20),
        items: [{ quantity: 1, productTypeKey: null, unitPrice: null, deliveryState: "NONE" }],
      }),
      makeOrder({
        id: "late",
        expectedDeliveryFrom: utc(2026, 4, 1),
        expectedDeliveryTo: utc(2026, 4, 10),
        items: [{ quantity: 1, productTypeKey: null, unitPrice: null, deliveryState: "NONE" }],
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
        store: { id: "store-a", name: "Store A" },
        items: [
          { quantity: 2, productTypeKey: "figure", unitPrice: 1000, deliveryState: "NONE" },
          { quantity: 1, productTypeKey: "manga", unitPrice: 1000, deliveryState: "NONE" },
        ],
      }),
    ]);
    expect(data.collection.totalOrders).toBe(1);
    expect(data.collection.totalProducts).toBe(3);
    expect(data.collection.productCountByType).toContainEqual({ productTypeKey: "figure", quantity: 2 });
    expect(data.collection.spendByType).toContainEqual({ productTypeKey: "figure", committedMinor: 2000 });
    expect(data.collection.topStores[0]).toMatchObject({ storeId: "store-a", committedMinor: 3000, orderCount: 1 });
  });

  it("splits committed value into paid and outstanding (FR-06-19)", () => {
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
