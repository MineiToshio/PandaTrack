import { describe, expect, it } from "vitest";
import {
  computeOutstandingMinor,
  computePaidMinor,
  convertToBaseCurrencyMinor,
  hasOrderArrived,
  isCancelled,
  isCancelledDelivery,
  rollUpToBaseCurrency,
  type RollupItem,
} from "../dashboardRollup";

describe("convertToBaseCurrencyMinor", () => {
  it("returns the amount unchanged when already in base currency", () => {
    expect(
      convertToBaseCurrencyMinor(10000, { currencyCode: "USD", exchangeRate: null, exchangeRateBaseCode: null }, "USD"),
    ).toBe(10000);
  });

  it("multiplies foreign amounts by the stored rate and rounds to minor units", () => {
    // 1 EUR = 1.1 USD, so 10000 minor EUR -> 11000 minor USD.
    expect(
      convertToBaseCurrencyMinor(10000, { currencyCode: "EUR", exchangeRate: 1.1, exchangeRateBaseCode: "USD" }, "USD"),
    ).toBe(11000);
    // Rounding: 12345 * 1.23 = 15184.35 -> 15184.
    expect(
      convertToBaseCurrencyMinor(12345, { currencyCode: "EUR", exchangeRate: 1.23, exchangeRateBaseCode: "USD" }, "USD"),
    ).toBe(15184);
  });

  it("returns null for a foreign amount with no usable rate", () => {
    expect(
      convertToBaseCurrencyMinor(10000, { currencyCode: "EUR", exchangeRate: null, exchangeRateBaseCode: null }, "USD"),
    ).toBeNull();
    expect(
      convertToBaseCurrencyMinor(10000, { currencyCode: "EUR", exchangeRate: 0, exchangeRateBaseCode: "USD" }, "USD"),
    ).toBeNull();
  });

  it("refuses to convert with a rate stored against a different base currency", () => {
    // The regression: a EUR->PEN rate must not be silently reused as if it were EUR->USD.
    expect(
      convertToBaseCurrencyMinor(10000, { currencyCode: "EUR", exchangeRate: 1.1, exchangeRateBaseCode: "PEN" }, "USD"),
    ).toBeNull();
  });
});

describe("rollUpToBaseCurrency", () => {
  const reconciledUsd: RollupItem = {
    amountMinor: 10000,
    currencyCode: "USD",
    exchangeRate: null,
    exchangeRateBaseCode: null,
  };
  const reconciledEur: RollupItem = {
    amountMinor: 10000,
    currencyCode: "EUR",
    exchangeRate: 1.1,
    exchangeRateBaseCode: "USD",
  };
  // Carries a rate, but one entered against a different base, so it cannot be converted here.
  const fxPendingEur: RollupItem = {
    amountMinor: 5000,
    currencyCode: "EUR",
    exchangeRate: 1.1,
    exchangeRateBaseCode: "PEN",
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
      exchangeRateBaseCode: null,
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
