import { describe, expect, it } from "vitest";
import { countOverdueProducts } from "../storeGroupOverdue";
import type { OverdueCountableProduct } from "../storeGroupOverdue";

const TODAY = new Date(Date.UTC(2026, 7, 22));
const utc = (year: number, monthIndex: number, day: number) => new Date(Date.UTC(year, monthIndex, day));

function product(overrides: Partial<OverdueCountableProduct> = {}): OverdueCountableProduct {
  return {
    deliveryState: "open",
    expectedDeliveryFrom: utc(2026, 6, 1),
    expectedDeliveryTo: null,
    ...overrides,
  };
}

describe("countOverdueProducts", () => {
  it("counts only the products whose window has already closed", () => {
    expect(
      countOverdueProducts(
        [
          product({ expectedDeliveryFrom: utc(2026, 5, 1) }), // june, late
          product({ expectedDeliveryFrom: utc(2026, 6, 1) }), // july, late
          product({ expectedDeliveryFrom: utc(2026, 8, 1) }), // september, still ahead
        ],
        TODAY,
      ),
    ).toBe(2);
  });

  it("does not count a product that is already at the store or on its way", () => {
    // The window passing is only news while nothing has answered it. Both of these have, so the
    // group header must not offer them as work; this is the same suppression `ArrivalMeta` applies
    // to the row itself, which is the whole reason the count reads through `resolveArrivalState`.
    expect(
      countOverdueProducts(
        [
          product({ deliveryState: "arrived_at_store", expectedDeliveryFrom: utc(2026, 4, 1) }),
          product({ deliveryState: "in_transit", expectedDeliveryFrom: utc(2026, 4, 1) }),
        ],
        TODAY,
      ),
    ).toBe(0);
  });

  it("does not count a product with no expected arrival at all", () => {
    // Eleven of the collector's orders carry no date. "Late" is a comparison, and there is nothing
    // here to compare against, so these belong in the plain product count instead.
    expect(countOverdueProducts([product({ expectedDeliveryFrom: null, expectedDeliveryTo: null })], TODAY)).toBe(0);
  });

  it("treats a window that closes today as still open, not late", () => {
    // The boundary the collector actually lives on: a pedido due today has not failed yet.
    expect(countOverdueProducts([product({ expectedDeliveryFrom: TODAY })], TODAY)).toBe(0);
    expect(countOverdueProducts([product({ expectedDeliveryFrom: utc(2026, 7, 21) })], TODAY)).toBe(1);
  });

  it("reads the END of an irregular window, not its start", () => {
    // "Llega 20 sep a 31 oct" is not late in October. Delegated to `resolveOrderArrivalDueDate`
    // through `resolveArrivalState`; asserted here because a count that took `from` would report
    // a store as late for the whole span of every one of its windows.
    expect(
      countOverdueProducts(
        [product({ expectedDeliveryFrom: utc(2026, 6, 20), expectedDeliveryTo: utc(2026, 8, 31) })],
        TODAY,
      ),
    ).toBe(0);
  });

  it("counts nothing in an empty group", () => {
    expect(countOverdueProducts([], TODAY)).toBe(0);
  });
});
