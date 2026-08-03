import { describe, expect, it } from "vitest";
import { previewEqualSplit } from "../priceSplitPreview";

describe("previewEqualSplit", () => {
  it("splits an amount evenly when it divides cleanly", () => {
    expect(previewEqualSplit(9000, 3, "PEN")).toEqual([3000, 3000, 3000]);
  });

  it("puts the remainder on the first shares in order", () => {
    // 10000 / 3 = 3333.33..., base 3333, remainder 1 -> [3334, 3333, 3333]
    expect(previewEqualSplit(10000, 3, "PEN")).toEqual([3334, 3333, 3333]);
    expect(previewEqualSplit(10000, 3, "PEN").reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("splits on the major unit for a zero-decimal currency so every share is a whole major amount", () => {
    // 10000 CLP minor units = 100 CLP major units; split into 3 -> 34/33/33 major -> ×100 minor
    expect(previewEqualSplit(10000, 3, "CLP")).toEqual([3400, 3300, 3300]);
    expect(previewEqualSplit(10000, 3, "CLP").reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("always sums back to the original total, regardless of remainder", () => {
    const total = 999901;
    const shares = previewEqualSplit(total, 7, "USD");
    expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
  });
});
