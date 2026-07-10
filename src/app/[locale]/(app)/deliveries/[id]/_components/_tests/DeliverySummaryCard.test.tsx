import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeliverySummaryCard from "../DeliverySummaryCard";

// Predictable next-intl mock — labels resolve to `deliveries.<key>` so assertions are stable.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `deliveries.${key}`,
}));

const BASE_DELIVERY = {
  deliveryDate: new Date(2026, 4, 5),
  expectedArrivalFrom: null,
  expectedArrivalTo: null,
  cost: 5000,
  currencyCode: "EUR",
  exchangeRate: 1.1,
  needsExchangeRateUpdate: false,
  store: { name: "Acme", slug: "acme" },
  sourceOrderCodes: ["ORD-1"],
};

describe("DeliverySummaryCard — FX reconciliation", () => {
  it("shows the converted exchange-rate row when the stored rate is not flagged", () => {
    render(
      <DeliverySummaryCard
        delivery={BASE_DELIVERY}
        status="IN_TRANSIT"
        receivedDate={null}
        baseCurrencyCode="USD"
        locale="en"
      />,
    );

    expect(screen.getByText("deliveries.detail.summary.exchangeRateValue")).toBeTruthy();
    expect(screen.queryByText("deliveries.detail.summary.exchangeRatePending")).toBeNull();
  });

  it("suppresses the conversion and shows a pending row when the rate is flagged stale", () => {
    render(
      <DeliverySummaryCard
        delivery={{ ...BASE_DELIVERY, needsExchangeRateUpdate: true }}
        status="IN_TRANSIT"
        receivedDate={null}
        baseCurrencyCode="USD"
        locale="en"
      />,
    );

    expect(screen.queryByText("deliveries.detail.summary.exchangeRateValue")).toBeNull();
    expect(screen.getByText("deliveries.detail.summary.exchangeRatePending")).toBeTruthy();
  });

  it("ignores the flag when the delivery is already in the base currency", () => {
    render(
      <DeliverySummaryCard
        delivery={{ ...BASE_DELIVERY, currencyCode: "USD", needsExchangeRateUpdate: true }}
        status="IN_TRANSIT"
        receivedDate={null}
        baseCurrencyCode="USD"
        locale="en"
      />,
    );

    // Same currency as base — no conversion and no pending row are relevant.
    expect(screen.queryByText("deliveries.detail.summary.exchangeRateValue")).toBeNull();
    expect(screen.queryByText("deliveries.detail.summary.exchangeRatePending")).toBeNull();
  });
});
