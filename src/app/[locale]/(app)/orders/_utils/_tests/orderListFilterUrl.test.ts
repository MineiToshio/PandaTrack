import { describe, expect, it } from "vitest";
import { buildOrderListFilterUrl, type OrderListActiveFilters } from "../orderListingParams";

const BASE_PATH = "/es/orders";

const DEFAULT_FILTERS: OrderListActiveFilters = {
  nameQuery: "  one piece  ",
  productTypeKeys: ["manga", "figure"],
  storeId: "store-1",
  statuses: ["OPEN", "IN_TRANSIT"],
  paymentStates: [],
  fxPendingOnly: false,
  sort: "recent",
  appliedDefaultStatuses: false,
  dateFromIso: "2026-01-10",
  dateToIso: "2026-02-20",
  deliveryFromIso: undefined,
  deliveryToIso: undefined,
  deliveryOverdueOnly: false,
};

describe("buildOrderListFilterUrl", () => {
  it("serializes the active filters into query params", () => {
    expect(buildOrderListFilterUrl(BASE_PATH, DEFAULT_FILTERS)).toBe(
      "/es/orders?q=one+piece&store=store-1&productType=manga&productType=figure&status=OPEN&status=IN_TRANSIT&dateFrom=2026-01-10&dateTo=2026-02-20",
    );
  });

  it("keeps default statuses explicit in the URL when that is the active view", () => {
    expect(
      buildOrderListFilterUrl(BASE_PATH, DEFAULT_FILTERS, {
        statuses: ["OPEN", "PARTIALLY_IN_TRANSIT", "IN_TRANSIT", "PARTIALLY_DELIVERED"],
        appliedDefaultStatuses: true,
      }),
    ).toBe(
      "/es/orders?q=one+piece&store=store-1&productType=manga&productType=figure&status=OPEN&status=PARTIALLY_IN_TRANSIT&status=IN_TRANSIT&status=PARTIALLY_DELIVERED&dateFrom=2026-01-10&dateTo=2026-02-20",
    );
  });

  it("preserves an explicit empty status override so chips can clear the status filter", () => {
    expect(
      buildOrderListFilterUrl(BASE_PATH, DEFAULT_FILTERS, {
        statuses: [],
        appliedDefaultStatuses: false,
      }),
    ).toBe(
      "/es/orders?q=one+piece&store=store-1&productType=manga&productType=figure&status=&dateFrom=2026-01-10&dateTo=2026-02-20",
    );
  });

  it("adds a page only when requesting a later page", () => {
    expect(buildOrderListFilterUrl(BASE_PATH, DEFAULT_FILTERS, { page: 3 })).toContain("&page=3");
    expect(buildOrderListFilterUrl(BASE_PATH, DEFAULT_FILTERS, { page: 1 })).not.toContain("page=");
  });
});
