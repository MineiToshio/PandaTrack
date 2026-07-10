import { describe, expect, it } from "vitest";
import { isValidPositiveDecimal, sanitizeDecimalInput } from "../decimalInput";

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
