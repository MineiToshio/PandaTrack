import { describe, expect, it } from "vitest";
import { formatDashboardMoney } from "@/app/[locale]/(app)/dashboard/_utils/dashboardMoney";
import { buildDashboardData } from "@/lib/data/dashboard/dashboardAggregation";
import type { DashboardOrderInput } from "@/lib/data/dashboard/dashboardTypes";
import { parseBudgetInputValue, toBudgetInputValue } from "@/lib/user-settings/budgetAmount";
import { parseCollectorPreferencesPatch } from "@/lib/user-settings/collectorPreferencesValidation";

describe("parseBudgetInputValue", () => {
  it("converts a whole-unit input into minor units", () => {
    expect(parseBudgetInputValue("200")).toEqual({ ok: true, minorUnits: 20_000 });
  });

  it("treats an empty or whitespace-only input as clearing the budget", () => {
    expect(parseBudgetInputValue("")).toEqual({ ok: true, minorUnits: null });
    expect(parseBudgetInputValue("   ")).toEqual({ ok: true, minorUnits: null });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseBudgetInputValue(" 200 ")).toEqual({ ok: true, minorUnits: 20_000 });
  });

  it("rejects fractional, non-positive, and non-numeric input", () => {
    expect(parseBudgetInputValue("200.5")).toEqual({ ok: false });
    expect(parseBudgetInputValue("0")).toEqual({ ok: false });
    expect(parseBudgetInputValue("-200")).toEqual({ ok: false });
    expect(parseBudgetInputValue("abc")).toEqual({ ok: false });
  });

  it("rejects trailing garbage instead of silently coercing it", () => {
    expect(parseBudgetInputValue("200abc")).toEqual({ ok: false });
  });
});

describe("toBudgetInputValue", () => {
  it("renders persisted minor units as whole currency units", () => {
    expect(toBudgetInputValue(20_000)).toBe("200");
  });

  it("renders a cleared budget as an empty input", () => {
    expect(toBudgetInputValue(null)).toBe("");
  });
});

describe("budget save/prefill round-trip", () => {
  it("returns the collector to the exact value they typed", () => {
    for (const typed of ["1", "200", "1500", "9999999"]) {
      const parsed = parseBudgetInputValue(typed);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(toBudgetInputValue(parsed.minorUnits)).toBe(typed);
    }
  });

  it("persists a value the preferences schema accepts", () => {
    const parsed = parseBudgetInputValue("200");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const patch = parseCollectorPreferencesPatch({
      baseCurrencyCode: "EUR",
      budgetAmount: parsed.minorUnits,
    });
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(patch.value.budgetAmount).toBe(20_000);
  });
});

/**
 * Guards the defect this contract was introduced to kill: a budget typed as `200` in settings once
 * reached the dashboard as `200` minor units and rendered as `$2.00`.
 */
describe("settings budget reaches the dashboard at the right magnitude", () => {
  const NOW = new Date("2026-07-15T12:00:00Z");

  function orderPaying(amountMinor: number): DashboardOrderInput {
    return {
      id: "order-1",
      humanReadableId: "PT-order-1",
      orderDate: new Date(Date.UTC(2026, 6, 1)),
      expectedDeliveryFrom: null,
      expectedDeliveryTo: null,
      currencyCode: "USD",
      exchangeRate: null,
      needsExchangeRateUpdate: false,
      totalCost: amountMinor,
      status: "OPEN",
      store: { id: "store-1", name: "Store One", slug: "store-one" },
      items: [],
      payments: [{ amount: amountMinor, paymentDate: new Date(Date.UTC(2026, 6, 5)) }],
    };
  }

  function budgetFor(typed: string, consumedMinor: number) {
    const parsed = parseBudgetInputValue(typed);
    if (!parsed.ok) throw new Error(`expected "${typed}" to parse`);
    return buildDashboardData({
      orders: [orderPaying(consumedMinor)],
      now: NOW,
      timezone: "UTC",
      baseCurrencyCode: "USD",
      budgetAmountMinor: parsed.minorUnits,
      budgetResetDayOfMonth: null,
    }).budget;
  }

  it("renders a budget typed as 200 as $200.00, not $2.00", () => {
    const budget = budgetFor("200", 0);
    expect(budget.budgetAmountMinor).toBe(20_000);
    expect(formatDashboardMoney(budget.budgetAmountMinor ?? 0, "USD", "en")).toBe("$200.00");
  });

  it("derives the consumption percentage against the same magnitude", () => {
    expect(budgetFor("200", 5_000).percentage).toBe(25);
    expect(budgetFor("200", 20_000).percentage).toBe(100);
  });

  it("resolves the status bands off the converted budget (FR-06-06)", () => {
    expect(budgetFor("200", 5_000).status).toBe("under");
    expect(budgetFor("200", 16_000).status).toBe("warning");
    expect(budgetFor("200", 20_000).status).toBe("warning");
    expect(budgetFor("200", 20_100).status).toBe("over");
  });
});
