import { describe, expect, it } from "vitest";
import { parseDecimalToMinorUnits } from "../parseDecimalToMinorUnits";

describe("parseDecimalToMinorUnits", () => {
  it("parses integers and decimals to minor units", () => {
    expect(parseDecimalToMinorUnits("10")).toBe(1000);
    expect(parseDecimalToMinorUnits("10.5")).toBe(1050);
    expect(parseDecimalToMinorUnits("10.55")).toBe(1055);
    expect(parseDecimalToMinorUnits("0")).toBe(0);
    expect(parseDecimalToMinorUnits("0.01")).toBe(1);
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseDecimalToMinorUnits("  12.34  ")).toBe(1234);
  });

  it("returns null for empty or null input", () => {
    expect(parseDecimalToMinorUnits(null)).toBeNull();
    expect(parseDecimalToMinorUnits("")).toBeNull();
    expect(parseDecimalToMinorUnits("   ")).toBeNull();
  });

  it("rejects more than two fraction digits instead of truncating", () => {
    expect(parseDecimalToMinorUnits("10.555")).toBeNull();
    expect(parseDecimalToMinorUnits("1.234")).toBeNull();
  });

  it("rejects thousands separators", () => {
    expect(parseDecimalToMinorUnits("1,000")).toBeNull();
    expect(parseDecimalToMinorUnits("1.000,50")).toBeNull();
  });

  it("rejects exponent and hex notation", () => {
    expect(parseDecimalToMinorUnits("1e3")).toBeNull();
    expect(parseDecimalToMinorUnits("1E3")).toBeNull();
    expect(parseDecimalToMinorUnits("0x10")).toBeNull();
  });

  it("rejects signs, multiple dots, and trailing/leading dots", () => {
    expect(parseDecimalToMinorUnits("-5")).toBeNull();
    expect(parseDecimalToMinorUnits("+5")).toBeNull();
    expect(parseDecimalToMinorUnits("10.5.5")).toBeNull();
    expect(parseDecimalToMinorUnits("10.")).toBeNull();
    expect(parseDecimalToMinorUnits(".5")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseDecimalToMinorUnits("abc")).toBeNull();
    expect(parseDecimalToMinorUnits("12abc")).toBeNull();
    expect(parseDecimalToMinorUnits("NaN")).toBeNull();
    expect(parseDecimalToMinorUnits("Infinity")).toBeNull();
  });
});
