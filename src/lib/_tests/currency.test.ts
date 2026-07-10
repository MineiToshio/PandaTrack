import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatAmountSymbolOnly,
  formatAmountWithSymbol,
  formatCentsForInput,
  getCurrencyDecimals,
  isWholeMajorAmount,
  isZeroDecimalCurrency,
} from "../currency";
import { isValidPositiveDecimal } from "../decimalInput";
import { parseDecimalToMinorUnits } from "../money/parseDecimalToMinorUnits";

describe("currency exponent helpers", () => {
  it("reports 0 decimals for zero-decimal currencies and 2 otherwise", () => {
    expect(getCurrencyDecimals("CLP")).toBe(0);
    expect(getCurrencyDecimals("JPY")).toBe(0);
    expect(getCurrencyDecimals("KRW")).toBe(0);
    expect(getCurrencyDecimals("USD")).toBe(2);
    expect(getCurrencyDecimals("EUR")).toBe(2);
    // Unknown codes fall back to the 2-decimal default.
    expect(getCurrencyDecimals("XXX")).toBe(2);
  });

  it("flags zero-decimal currencies", () => {
    expect(isZeroDecimalCurrency("CLP")).toBe(true);
    expect(isZeroDecimalCurrency("USD")).toBe(false);
  });

  it("checks whole major amounts against the ×100 storage scale", () => {
    expect(isWholeMajorAmount(4300000)).toBe(true);
    expect(isWholeMajorAmount(4300050)).toBe(false);
    expect(isWholeMajorAmount(0)).toBe(true);
  });
});

describe("formatAmount", () => {
  it("omits decimals for zero-decimal currencies", () => {
    expect(formatAmount(4300000, "CLP")).toBe("43000 CLP");
    expect(formatAmount(1000000, "JPY")).toBe("10000 JPY");
  });

  it("keeps two decimals for standard currencies", () => {
    expect(formatAmount(88850, "USD")).toBe("888.50 USD");
    expect(formatAmount(32000, "EUR")).toBe("320.00 EUR");
  });
});

describe("formatCentsForInput prefill round-trip", () => {
  // A prefilled form field must survive the exact path a submit takes: the seeded string has to
  // pass the currency-aware validator and re-parse back to the same stored minor units. A
  // currency-blind ".00" suffix on a zero-decimal currency broke this (rejected on submit).
  it("round-trips a zero-decimal currency without a decimal suffix", () => {
    const cents = 4300000; // 43000 CLP stored as ×100 minor units
    const prefill = formatCentsForInput(cents, "CLP");
    expect(prefill).toBe("43000");
    expect(isValidPositiveDecimal(prefill, "CLP")).toBe(true);
    expect(parseDecimalToMinorUnits(prefill, "CLP")).toBe(cents);
  });

  it("round-trips a standard currency with its two-decimal suffix", () => {
    const cents = 88850; // 888.50 USD
    const prefill = formatCentsForInput(cents, "USD");
    expect(prefill).toBe("888.50");
    expect(isValidPositiveDecimal(prefill, "USD")).toBe(true);
    expect(parseDecimalToMinorUnits(prefill, "USD")).toBe(cents);
  });
});

describe("formatAmountSymbolOnly / formatAmountWithSymbol", () => {
  // The narrow symbol depends on the runtime ICU, so assert on the number layout (the actual
  // requirement) rather than the exact symbol glyph.
  it("omits decimals for zero-decimal currencies", () => {
    expect(formatAmountSymbolOnly(4300000, "CLP")).toMatch(/43000$/);
    expect(formatAmountSymbolOnly(4300000, "CLP")).not.toContain(".");
    expect(formatAmountWithSymbol(4300000, "CLP")).toMatch(/43000 CLP$/);
  });

  it("keeps two decimals for standard currencies", () => {
    expect(formatAmountSymbolOnly(49600, "USD")).toMatch(/496\.00$/);
    expect(formatAmountWithSymbol(49600, "USD")).toMatch(/496\.00 USD$/);
  });
});
