import { describe, expect, it } from "vitest";
import { deriveItemizedTotal, shouldShowDiscrepancyModal } from "../orderItemMutations";

describe("deriveItemizedTotal", () => {
  it("returns null when no items have a unit price", () => {
    const items = [
      { quantity: 2, unitPrice: null },
      { quantity: 1, unitPrice: null },
    ];
    expect(deriveItemizedTotal(items)).toBeNull();
  });

  it("returns null for an empty items array", () => {
    expect(deriveItemizedTotal([])).toBeNull();
  });

  it("sums quantity × unitPrice for all priced items", () => {
    const items = [
      { quantity: 2, unitPrice: 2550 },
      { quantity: 1, unitPrice: 1000 },
    ];
    expect(deriveItemizedTotal(items)).toBe(6100);
  });

  it("excludes items with null unitPrice from the sum", () => {
    const items = [
      { quantity: 2, unitPrice: 2550 },
      { quantity: 1, unitPrice: null },
    ];
    expect(deriveItemizedTotal(items)).toBe(5100);
  });

  it("includes items with unitPrice of 0 (free items)", () => {
    const items = [
      { quantity: 1, unitPrice: 0 },
      { quantity: 2, unitPrice: 1000 },
    ];
    expect(deriveItemizedTotal(items)).toBe(2000);
  });

  it("uses integer arithmetic with no floating-point drift", () => {
    const items = [
      { quantity: 3, unitPrice: 3333 },
      { quantity: 3, unitPrice: 3334 },
    ];
    expect(deriveItemizedTotal(items)).toBe(20001);
  });
});

describe("shouldShowDiscrepancyModal", () => {
  it("returns false when items array is empty", () => {
    expect(shouldShowDiscrepancyModal([], 10000)).toBe(false);
  });

  it("returns false when any item lacks a unitPrice", () => {
    const items = [
      { quantity: 1, unitPrice: 5000 },
      { quantity: 1, unitPrice: null },
    ];
    expect(shouldShowDiscrepancyModal(items, 5000)).toBe(false);
  });

  it("returns false when itemizedTotal equals totalCost", () => {
    const items = [
      { quantity: 2, unitPrice: 2500 },
      { quantity: 1, unitPrice: 5000 },
    ];
    expect(shouldShowDiscrepancyModal(items, 10000)).toBe(false);
  });

  it("returns true when all items have unitPrice and totals differ", () => {
    const items = [
      { quantity: 2, unitPrice: 2500 },
      { quantity: 1, unitPrice: 4000 },
    ];
    // itemizedTotal = 9000, totalCost = 10000
    expect(shouldShowDiscrepancyModal(items, 10000)).toBe(true);
  });

  it("treats unitPrice of 0 as a valid price (all priced)", () => {
    const items = [
      { quantity: 1, unitPrice: 0 },
      { quantity: 1, unitPrice: 5000 },
    ];
    // itemizedTotal = 5000, totalCost = 6000 → show modal
    expect(shouldShowDiscrepancyModal(items, 6000)).toBe(true);
  });
});
