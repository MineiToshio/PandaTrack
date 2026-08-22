import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import DashboardCashZone from "../DashboardCashZone";
import { buildDashboardData } from "@/lib/data/dashboard/dashboardAggregation";
import type { DashboardOrderInput } from "@/lib/data/dashboard/dashboardTypes";
import { POSTHOG_EVENTS } from "@/lib/constants";

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
    exchangeRateBaseCode: "USD",
    totalCost: 0,
    status: "OPEN",
    store: { id: "store-1", name: "Store One", slug: "store-one", logoUrl: null },
    items: [],
    payments: [],
    adjustmentLines: [],
    openBalanceMinor: 0,
  };
  const merged = { ...base, ...overrides };
  if (overrides.openBalanceMinor === undefined) {
    const paidMinor = merged.payments.reduce((sum, payment) => sum + payment.amount, 0);
    merged.openBalanceMinor = merged.totalCost - paidMinor;
  }
  return merged;
}

async function renderZone(orders: DashboardOrderInput[]) {
  const data = buildDashboardData({
    orders,
    deliveries: [],
    now: NOW,
    timezone: "UTC",
    baseCurrencyCode: "USD",
    budgetAmountMinor: null,
    budgetResetDayOfMonth: null,
  });
  const jsx = await DashboardCashZone({ data, locale: "es" });
  render(jsx);
}

describe("DashboardCashZone - pagos que no registraste (WO-07)", () => {
  it("does not render the diagnostic line when no COMPLETED order carries a balance", async () => {
    await renderZone([
      makeOrder({ id: "open", totalCost: 1000, payments: [{ amount: 1000, paymentDate: utc(2026, 6, 5) }] }),
    ]);
    expect(screen.queryByText(/cash\.unrecordedNote/)).not.toBeInTheDocument();
  });

  it("renders the diagnostic line with the exact copy key and amount when positive", async () => {
    await renderZone([
      makeOrder({ id: "open", totalCost: 1000, payments: [{ amount: 1000, paymentDate: utc(2026, 6, 5) }] }),
      makeOrder({ id: "delivered", status: "COMPLETED", totalCost: 8000, openBalanceMinor: 8000 }),
    ]);
    const note = screen.getByText(/cash\.unrecordedNote/);
    expect(note.textContent).toContain("cash.unrecordedNote");
    expect(note.textContent).toMatch(/\$?80/); // formatted amount embedded in the interpolation params
  });

  it("links the diagnostic line into COMPLETED orders with a balance, and carries the PostHog event", async () => {
    await renderZone([makeOrder({ id: "delivered", status: "COMPLETED", totalCost: 8000, openBalanceMinor: 8000 })]);
    const link = screen.getByRole("link", { name: "cash.unrecordedLink" });
    expect(link).toHaveAttribute("href", expect.stringContaining("status=COMPLETED"));
    expect(link).toHaveAttribute("href", expect.stringContaining("balance=true"));
    expect(link).toHaveAttribute("data-ph-event", POSTHOG_EVENTS.DASHBOARD.UNRECORDED_PAYMENTS_LINK_CLICKED);
  });
});
