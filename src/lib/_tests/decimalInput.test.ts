import { describe, expect, it } from "vitest";
import {
  isValidNonNegativeDecimal,
  isValidPositiveDecimal,
  isValidRate,
  sanitizeDecimalInput,
  sanitizeRateInput,
} from "../decimalInput";

describe("sanitizeDecimalInput", () => {
  it("keeps up to two fraction digits by default", () => {
    expect(sanitizeDecimalInput("12.345")).toBe("12.34");
    expect(sanitizeDecimalInput("12.3")).toBe("12.3");
    expect(sanitizeDecimalInput("1a2.5b")).toBe("12.5");
  });

  it("keeps up to two fraction digits for standard currencies", () => {
    expect(sanitizeDecimalInput("12.345", "USD")).toBe("12.34");
  });

  it("truncates at the separator for zero-decimal currencies without concatenating digits", () => {
    // Must become "43000", NOT "4300050" (dropping the dot would corrupt the value).
    expect(sanitizeDecimalInput("43000.50", "CLP")).toBe("43000");
    expect(sanitizeDecimalInput("100.", "JPY")).toBe("100");
    expect(sanitizeDecimalInput("5.99", "KRW")).toBe("5");
  });
});

describe("isValidPositiveDecimal", () => {
  it("accepts up to two decimals by default", () => {
    expect(isValidPositiveDecimal("25")).toBe(true);
    expect(isValidPositiveDecimal("25.99")).toBe(true);
    expect(isValidPositiveDecimal("25.999")).toBe(false);
    expect(isValidPositiveDecimal("0")).toBe(false);
  });

  it("rejects any decimal for zero-decimal currencies", () => {
    expect(isValidPositiveDecimal("43000", "CLP")).toBe(true);
    expect(isValidPositiveDecimal("43000.5", "CLP")).toBe(false);
    expect(isValidPositiveDecimal("100.00", "JPY")).toBe(false);
  });
});

describe("isValidNonNegativeDecimal", () => {
  it("accepts zero and positive within the exponent", () => {
    expect(isValidNonNegativeDecimal("0")).toBe(true);
    expect(isValidNonNegativeDecimal("0.00")).toBe(true);
    expect(isValidNonNegativeDecimal("12.50")).toBe(true);
    expect(isValidNonNegativeDecimal("12.505")).toBe(false);
  });

  it("stays currency-aware for zero-decimal currencies", () => {
    expect(isValidNonNegativeDecimal("0", "CLP")).toBe(true);
    expect(isValidNonNegativeDecimal("43000", "CLP")).toBe(true);
    expect(isValidNonNegativeDecimal("43000.5", "CLP")).toBe(false);
  });
});

describe("sanitizeRateInput", () => {
  it("keeps up to six fraction digits so small rates stay typeable", () => {
    // The 2-decimal sanitizer would truncate this to "0.00" and make the rate unenterable.
    expect(sanitizeRateInput("0.001080")).toBe("0.001080");
    expect(sanitizeRateInput("0.0006500")).toBe("0.000650");
    expect(sanitizeRateInput("1a.08b47")).toBe("1.0847");
  });
});

describe("isValidRate", () => {
  it("accepts a positive rate with up to six decimals", () => {
    expect(isValidRate("0.00108")).toBe(true);
    expect(isValidRate("1.084700")).toBe(true);
    expect(isValidRate("0.0000001")).toBe(false);
    expect(isValidRate("0")).toBe(false);
  });
});
