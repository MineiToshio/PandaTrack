import { describe, expect, it } from "vitest";
import {
  computeOutstandingMinor,
  computePaidMinor,
  convertToBaseCurrencyMinor,
  hasOrderArrived,
  isCancelled,
  isCancelledDelivery,
  isFxPending,
  rollUpToBaseCurrency,
  type RollupItem,
} from "../dashboardRollup";

describe("convertToBaseCurrencyMinor", () => {
  it("returns the amount unchanged when already in base currency", () => {
    expect(convertToBaseCurrencyMinor(10000, "USD", null, "USD")).toBe(10000);
  });

  it("multiplies foreign amounts by the stored rate and rounds to minor units", () => {
    // 1 EUR = 1.1 USD, so 10000 minor EUR -> 11000 minor USD.
    expect(convertToBaseCurrencyMinor(10000, "EUR", 1.1, "USD")).toBe(11000);
    // Rounding: 12345 * 1.23 = 15184.35 -> 15184.
    expect(convertToBaseCurrencyMinor(12345, "EUR", 1.23, "USD")).toBe(15184);
  });

  it("returns null for a foreign amount with no usable rate", () => {
    expect(convertToBaseCurrencyMinor(10000, "EUR", null, "USD")).toBeNull();
    expect(convertToBaseCurrencyMinor(10000, "EUR", 0, "USD")).toBeNull();
  });
});

describe("isFxPending", () => {
  it("is true only for flagged orders in a different currency than base", () => {
    expect(isFxPending({ currencyCode: "EUR", needsExchangeRateUpdate: true }, "USD")).toBe(true);
    expect(isFxPending({ currencyCode: "USD", needsExchangeRateUpdate: true }, "USD")).toBe(false);
    expect(isFxPending({ currencyCode: "EUR", needsExchangeRateUpdate: false }, "USD")).toBe(false);
  });
});

describe("rollUpToBaseCurrency", () => {
  const reconciledUsd: RollupItem = {
    amountMinor: 10000,
    currencyCode: "USD",
    exchangeRate: null,
    needsExchangeRateUpdate: false,
  };
  const reconciledEur: RollupItem = {
    amountMinor: 10000,
    currencyCode: "EUR",
    exchangeRate: 1.1,
    needsExchangeRateUpdate: false,
  };
  const fxPendingEur: RollupItem = {
    amountMinor: 5000,
    currencyCode: "EUR",
    exchangeRate: 1.1,
    needsExchangeRateUpdate: true,
  };

  it("sums reconciled orders and converts foreign ones", () => {
    const result = rollUpToBaseCurrency([reconciledUsd, reconciledEur], "USD");
    expect(result).toEqual({ totalMinor: 21000, isPartial: false, excludedOrderCount: 0 });
  });

  it("excludes FX-pending orders and flags the total as partial", () => {
    const result = rollUpToBaseCurrency([reconciledUsd, fxPendingEur], "USD");
    expect(result).toEqual({ totalMinor: 10000, isPartial: true, excludedOrderCount: 1 });
  });

  it("excludes foreign orders that cannot be converted", () => {
    const unconvertible: RollupItem = {
      amountMinor: 7000,
      currencyCode: "EUR",
      exchangeRate: null,
      needsExchangeRateUpdate: false,
    };
    const result = rollUpToBaseCurrency([reconciledUsd, unconvertible], "USD");
    expect(result).toEqual({ totalMinor: 10000, isPartial: true, excludedOrderCount: 1 });
  });

  it("returns a zeroed, non-partial total when no base currency is configured", () => {
    const result = rollUpToBaseCurrency([reconciledUsd], null);
    expect(result).toEqual({ totalMinor: 0, isPartial: false, excludedOrderCount: 0 });
  });
});

describe("computeOutstandingMinor", () => {
  it("computes totalCost minus payments", () => {
    expect(computeOutstandingMinor(10000, [{ amount: 2500 }, { amount: 1500 }])).toBe(6000);
  });

  it("never returns a negative balance for an overpaid order", () => {
    expect(computeOutstandingMinor(10000, [{ amount: 12000 }])).toBe(0);
  });
});

describe("computePaidMinor", () => {
  it("sums the payment amounts", () => {
    expect(computePaidMinor([{ amount: 2500 }, { amount: 1500 }])).toBe(4000);
    expect(computePaidMinor([])).toBe(0);
  });
});

describe("hasOrderArrived", () => {
  it("is false when every item is still in the NONE state", () => {
    expect(hasOrderArrived([{ deliveryState: "NONE" }, { deliveryState: "NONE" }])).toBe(false);
  });

  it("is true once any item has left the NONE state", () => {
    expect(hasOrderArrived([{ deliveryState: "NONE" }, { deliveryState: "ARRIVED_AT_STORE" }])).toBe(true);
    expect(hasOrderArrived([{ deliveryState: "DELIVERED" }])).toBe(true);
  });
});

describe("isCancelled", () => {
  it("detects the CANCELLED status", () => {
    expect(isCancelled("CANCELLED")).toBe(true);
    expect(isCancelled("OPEN")).toBe(false);
  });
});

describe("isCancelledDelivery", () => {
  it("detects the CANCELLED delivery status", () => {
    expect(isCancelledDelivery("CANCELLED")).toBe(true);
    expect(isCancelledDelivery("IN_TRANSIT")).toBe(false);
    expect(isCancelledDelivery("DELIVERED")).toBe(false);
  });
});
