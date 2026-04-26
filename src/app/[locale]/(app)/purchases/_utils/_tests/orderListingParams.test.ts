import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACTIVE_STATUSES,
  hasOnlyDefaultActiveFilters,
  isDefaultActiveStatusSet,
  parseOrderListingParams,
} from "../orderListingParams";

describe("parseOrderListingParams", () => {
  it("applies the default active status set when no status param is present", () => {
    const result = parseOrderListingParams({});
    expect(result.statuses).toEqual(DEFAULT_ACTIVE_STATUSES);
    expect(result.appliedDefaultStatuses).toBe(true);
    expect(result.page).toBe(1);
  });

  it("parses a single status", () => {
    const result = parseOrderListingParams({ status: "OPEN" });
    expect(result.statuses).toEqual(["OPEN"]);
    expect(result.appliedDefaultStatuses).toBe(false);
  });

  it("parses multiple statuses", () => {
    const result = parseOrderListingParams({ status: ["OPEN", "CANCELLED"] });
    expect(result.statuses).toEqual(["OPEN", "CANCELLED"]);
  });

  it("drops invalid status values silently", () => {
    const result = parseOrderListingParams({ status: ["FAKE", "OPEN"] });
    expect(result.statuses).toEqual(["OPEN"]);
  });

  it("treats empty status array (status param present but unknown) as no statuses", () => {
    const result = parseOrderListingParams({ status: "FAKE" });
    expect(result.statuses).toEqual([]);
    expect(result.appliedDefaultStatuses).toBe(false);
  });

  it("trims and normalizes name query", () => {
    expect(parseOrderListingParams({ q: "  manga  " }).nameQuery).toBe("manga");
    expect(parseOrderListingParams({ q: "   " }).nameQuery).toBeUndefined();
  });

  it("parses product type list, store, and dates", () => {
    const result = parseOrderListingParams({
      productType: ["manga", "comics"],
      store: "store-1",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
      page: "3",
    });
    expect(result.productTypeKeys).toEqual(["manga", "comics"]);
    expect(result.storeId).toBe("store-1");
    expect(result.dateFrom?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(result.dateTo?.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(result.page).toBe(3);
  });

  it("falls back to page 1 for invalid page values", () => {
    expect(parseOrderListingParams({ page: "0" }).page).toBe(1);
    expect(parseOrderListingParams({ page: "-2" }).page).toBe(1);
    expect(parseOrderListingParams({ page: "abc" }).page).toBe(1);
  });
});

describe("isDefaultActiveStatusSet", () => {
  it("returns true for exactly the default four statuses", () => {
    expect(isDefaultActiveStatusSet(["OPEN", "PARTIALLY_IN_TRANSIT", "IN_TRANSIT", "PARTIALLY_DELIVERED"])).toBe(true);
  });

  it("returns false for a superset", () => {
    expect(isDefaultActiveStatusSet([...DEFAULT_ACTIVE_STATUSES, "COMPLETED"])).toBe(false);
  });

  it("returns false for a subset", () => {
    expect(isDefaultActiveStatusSet(["OPEN", "IN_TRANSIT", "PARTIALLY_IN_TRANSIT"])).toBe(false);
  });

  it("returns false for empty", () => {
    expect(isDefaultActiveStatusSet([])).toBe(false);
  });
});

describe("hasOnlyDefaultActiveFilters", () => {
  it("returns true when only the default active statuses are applied", () => {
    expect(
      hasOnlyDefaultActiveFilters({
        nameQuery: undefined,
        productTypeKeys: [],
        storeId: undefined,
        statuses: DEFAULT_ACTIVE_STATUSES,
        appliedDefaultStatuses: false,
        dateFromIso: undefined,
        dateToIso: undefined,
      }),
    ).toBe(true);
  });

  it("returns false when another filter is also active", () => {
    expect(
      hasOnlyDefaultActiveFilters({
        nameQuery: "naruto",
        productTypeKeys: [],
        storeId: undefined,
        statuses: DEFAULT_ACTIVE_STATUSES,
        appliedDefaultStatuses: false,
        dateFromIso: undefined,
        dateToIso: undefined,
      }),
    ).toBe(false);
  });
});
