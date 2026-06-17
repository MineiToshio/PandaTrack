import { describe, expect, it } from "vitest";
import {
  buildDeliveryListFilterUrl,
  hasOnlyDefaultDeliveryFilters,
  parseDeliveryListingParams,
  type DeliveryListActiveFilters,
} from "../deliveryListingParams";

const BASE_FILTERS: DeliveryListActiveFilters = {
  nameQuery: undefined,
  statuses: ["IN_TRANSIT"],
  overdueOnly: false,
  arrivalFromIso: undefined,
  arrivalToIso: undefined,
  storeId: undefined,
  productQuery: undefined,
  shippedFromIso: undefined,
  shippedToIso: undefined,
  sort: "oldest",
};

describe("parseDeliveryListingParams", () => {
  it("leaves statuses empty when no status param is present and flags the missing key", () => {
    const result = parseDeliveryListingParams({});
    expect(result.statuses).toEqual([]);
    expect(result.hasStatusParam).toBe(false);
    expect(result.page).toBe(1);
  });

  it("flags an explicit empty status key without applying defaults", () => {
    const result = parseDeliveryListingParams({ status: "" });
    expect(result.statuses).toEqual([]);
    expect(result.hasStatusParam).toBe(true);
  });

  it("parses one or many statuses and drops invalid values", () => {
    expect(parseDeliveryListingParams({ status: "IN_TRANSIT" }).statuses).toEqual(["IN_TRANSIT"]);
    expect(parseDeliveryListingParams({ status: ["DELIVERED", "CANCELLED"] }).statuses).toEqual([
      "DELIVERED",
      "CANCELLED",
    ]);
    expect(parseDeliveryListingParams({ status: ["FAKE", "DELIVERED"] }).statuses).toEqual(["DELIVERED"]);
  });

  it("trims and normalizes the search query", () => {
    expect(parseDeliveryListingParams({ q: "  berserk  " }).nameQuery).toBe("berserk");
    expect(parseDeliveryListingParams({ q: "   " }).nameQuery).toBeUndefined();
  });

  it("parses overdue flag, ranges, store, and product", () => {
    const result = parseDeliveryListingParams({
      overdue: "true",
      arrivalFrom: "2026-05-01",
      arrivalTo: "2026-05-15",
      store: "store-1",
      product: "nendoroid",
      shippedFrom: "2026-04-01",
      shippedTo: "2026-04-30",
      page: "2",
    });
    expect(result.overdueOnly).toBe(true);
    expect(result.arrivalFrom?.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(result.arrivalTo?.toISOString().slice(0, 10)).toBe("2026-05-15");
    expect(result.storeId).toBe("store-1");
    expect(result.productQuery).toBe("nendoroid");
    expect(result.shippedFrom?.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(result.shippedTo?.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(result.page).toBe(2);
  });

  it("falls back to the default sort for unknown values", () => {
    expect(parseDeliveryListingParams({ sort: "bogus" }).sort).toBe("oldest");
    expect(parseDeliveryListingParams({ sort: "eta-asc" }).sort).toBe("eta-asc");
  });

  it("falls back to page 1 for invalid page values", () => {
    expect(parseDeliveryListingParams({ page: "0" }).page).toBe(1);
    expect(parseDeliveryListingParams({ page: "-2" }).page).toBe(1);
    expect(parseDeliveryListingParams({ page: "abc" }).page).toBe(1);
  });
});

describe("buildDeliveryListFilterUrl", () => {
  it("always keeps the status key present, as explicit empty when no status filter", () => {
    const url = buildDeliveryListFilterUrl("/es/deliveries", { ...BASE_FILTERS, statuses: [] });
    expect(url).toBe("/es/deliveries?status=");
  });

  it("serializes statuses as repeated params", () => {
    const url = buildDeliveryListFilterUrl("/es/deliveries", {
      ...BASE_FILTERS,
      statuses: ["IN_TRANSIT", "DELIVERED"],
    });
    expect(url).toContain("status=IN_TRANSIT");
    expect(url).toContain("status=DELIVERED");
  });

  it("lets overrides clear a filter with explicit undefined", () => {
    const url = buildDeliveryListFilterUrl(
      "/es/deliveries",
      { ...BASE_FILTERS, nameQuery: "berserk" },
      { nameQuery: undefined },
    );
    expect(url).not.toContain("q=");
  });

  it("omits the default sort and includes non-default sort", () => {
    expect(buildDeliveryListFilterUrl("/es/deliveries", BASE_FILTERS)).not.toContain("sort=");
    expect(buildDeliveryListFilterUrl("/es/deliveries", { ...BASE_FILTERS, sort: "eta-asc" })).toContain(
      "sort=eta-asc",
    );
  });

  it("only adds page when greater than 1", () => {
    expect(buildDeliveryListFilterUrl("/es/deliveries", BASE_FILTERS, { page: 1 })).not.toContain("page=");
    expect(buildDeliveryListFilterUrl("/es/deliveries", BASE_FILTERS, { page: 3 })).toContain("page=3");
  });

  it("serializes overdue, ranges, store, and product", () => {
    const url = buildDeliveryListFilterUrl("/es/deliveries", {
      ...BASE_FILTERS,
      overdueOnly: true,
      storeId: "store-1",
      productQuery: "nendoroid",
      shippedFromIso: "2026-04-01",
    });
    expect(url).toContain("overdue=true");
    expect(url).toContain("store=store-1");
    expect(url).toContain("product=nendoroid");
    expect(url).toContain("shippedFrom=2026-04-01");
  });
});

describe("hasOnlyDefaultDeliveryFilters", () => {
  it("returns true for the canonical default state", () => {
    expect(hasOnlyDefaultDeliveryFilters(BASE_FILTERS)).toBe(true);
  });

  it("returns false when any filter beyond the default is active", () => {
    expect(hasOnlyDefaultDeliveryFilters({ ...BASE_FILTERS, nameQuery: "x" })).toBe(false);
    expect(hasOnlyDefaultDeliveryFilters({ ...BASE_FILTERS, statuses: [] })).toBe(false);
    expect(hasOnlyDefaultDeliveryFilters({ ...BASE_FILTERS, statuses: ["DELIVERED"] })).toBe(false);
    expect(hasOnlyDefaultDeliveryFilters({ ...BASE_FILTERS, overdueOnly: true })).toBe(false);
    expect(hasOnlyDefaultDeliveryFilters({ ...BASE_FILTERS, sort: "recent" })).toBe(false);
  });
});
