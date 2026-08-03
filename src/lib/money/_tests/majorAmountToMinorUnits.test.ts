import { describe, expect, it } from "vitest";
import { majorAmountToMinorUnits } from "@/lib/money/majorAmountToMinorUnits";

describe("majorAmountToMinorUnits", () => {
  it("scales a two-decimal amount to exact minor units", () => {
    expect(majorAmountToMinorUnits(59.9)).toBe(5990);
    expect(majorAmountToMinorUnits(19.99)).toBe(1999);
    expect(majorAmountToMinorUnits(0.01)).toBe(1);
    expect(majorAmountToMinorUnits(0)).toBe(0);
  });

  it("survives the floating-point cases a bare multiplication gets wrong", () => {
    // Each of these is not exactly representable in IEEE 754: 19.99 * 100 is 1998.9999999999998,
    // 1.1 * 100 is 110.00000000000001, and (0.1 + 0.2) is 0.30000000000000004.
    expect(19.99 * 100).not.toBe(1999);
    expect(majorAmountToMinorUnits(19.99)).toBe(1999);
    expect(majorAmountToMinorUnits(1.1)).toBe(110);
    expect(majorAmountToMinorUnits(0.1 + 0.2)).toBe(30);
    expect(majorAmountToMinorUnits(2.675)).toBe(268);
  });

  it("rounds a half-subunit up, the way the printed amount reads", () => {
    // 1.005 is stored as 1.00499999999999989..., so a bare Math.round(1.005 * 100) answers 100.
    expect(Math.round(1.005 * 100)).toBe(100);
    expect(majorAmountToMinorUnits(1.005)).toBe(101);
  });

  it("rounds an amount carrying more precision than any currency has", () => {
    expect(majorAmountToMinorUnits(59.904)).toBe(5990);
    expect(majorAmountToMinorUnits(59.906)).toBe(5991);
  });

  it("scales a zero-decimal currency amount to a whole major amount", () => {
    // Storage is a uniform ×100 for every currency, so ¥1,200 is 120000 minor units and stays a
    // multiple of 100, which is what `isWholeMajorAmount` requires of CLP, JPY, and KRW.
    expect(majorAmountToMinorUnits(1200)).toBe(120000);
    expect(majorAmountToMinorUnits(43000)).toBe(4300000);
    expect(majorAmountToMinorUnits(1200) % 100).toBe(0);
  });

  it("keeps a large amount exact", () => {
    expect(majorAmountToMinorUnits(9_999_999.99)).toBe(999_999_999);
  });
});
