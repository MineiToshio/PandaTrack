import { describe, expect, it } from "vitest";
import {
  buildOrderListFilterUrl,
  DEFAULT_ACTIVE_STATUSES,
  DEFAULT_ORDER_LIST_VIEW,
  hasOnlyDefaultActiveFilters,
  isDefaultActiveStatusSet,
  parseOrderListingParams,
  parseStoreViewQuery,
  resolveOrderListView,
} from "../orderListingParams";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { ORDER_LIST_SORT_VALUES } from "@/lib/orders/orderListSort";
import type { OrderListActiveFilters } from "../orderListingParams";

const BASE_FILTERS: OrderListActiveFilters = {
  nameQuery: undefined,
  productTypeKeys: [],
  storeId: undefined,
  statuses: [],
  fxPendingOnly: false,
  sort: "recent",
  appliedDefaultStatuses: false,
  dateFromIso: undefined,
  dateToIso: undefined,
  deliveryFromIso: undefined,
  deliveryToIso: undefined,
  deliveryOverdueOnly: false,
  deliveryLateOnly: false,
  withBalanceOnly: false,
  perPage: DEFAULT_PAGE_SIZE,
};

describe("parseOrderListingParams", () => {
  it("leaves statuses empty when no status param is present (defaults live in the nav href)", () => {
    const result = parseOrderListingParams({});
    expect(result.statuses).toEqual([]);
    expect(result.appliedDefaultStatuses).toBe(false);
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

  it("defaults perPage when the param is missing", () => {
    expect(parseOrderListingParams({}).perPage).toBe(DEFAULT_PAGE_SIZE);
  });

  it("accepts an allow-listed perPage value", () => {
    expect(parseOrderListingParams({ perPage: "50" }).perPage).toBe(50);
    expect(parseOrderListingParams({ perPage: "10" }).perPage).toBe(10);
    expect(parseOrderListingParams({ perPage: "100" }).perPage).toBe(100);
  });

  it("clamps an out-of-range or invalid perPage back to the default", () => {
    expect(parseOrderListingParams({ perPage: "37" }).perPage).toBe(DEFAULT_PAGE_SIZE);
    expect(parseOrderListingParams({ perPage: "0" }).perPage).toBe(DEFAULT_PAGE_SIZE);
    expect(parseOrderListingParams({ perPage: "abc" }).perPage).toBe(DEFAULT_PAGE_SIZE);
  });

  it("drops the retired payment-asc sort value and falls back to the default", () => {
    expect(parseOrderListingParams({ sort: "payment-asc" }).sort).toBe("recent");
    expect(ORDER_LIST_SORT_VALUES).not.toContain("payment-asc");
  });

  it("silently ignores an unknown ?payment= param (paid/partial/unpaid filtering was retired)", () => {
    // parseOrderListingParams no longer has a `paymentStates` field at all — this just proves a
    // legacy `?payment=paid` in a bookmarked URL cannot throw or leak into any other field.
    expect(() => parseOrderListingParams({ payment: "paid" })).not.toThrow();
  });
});

describe("resolveOrderListView", () => {
  it("prefers an explicit ?view= over the cookie", () => {
    expect(resolveOrderListView("store", "order")).toBe("store");
    expect(resolveOrderListView("order", "store")).toBe("order");
  });

  it("falls back to the cookie when no ?view= is present", () => {
    expect(resolveOrderListView(undefined, "store")).toBe("store");
  });

  it("falls back to the hard default when both are missing or invalid", () => {
    expect(resolveOrderListView(undefined, undefined)).toBe(DEFAULT_ORDER_LIST_VIEW);
    expect(resolveOrderListView("bogus", "also-bogus")).toBe(DEFAULT_ORDER_LIST_VIEW);
    expect(resolveOrderListView(["store"], undefined)).toBe("store");
  });
});

describe("parseStoreViewQuery", () => {
  it("trims the store view's own search text", () => {
    expect(parseStoreViewQuery("  nendoroid  ")).toBe("nendoroid");
    expect(parseStoreViewQuery(["amazon"])).toBe("amazon");
  });

  it("treats a missing or blank value as no search", () => {
    expect(parseStoreViewQuery(undefined)).toBeUndefined();
    expect(parseStoreViewQuery("   ")).toBeUndefined();
  });

  it("is independent from the order view's ?q=", () => {
    const parsed = parseOrderListingParams({ q: "order text", sq: "store text" });

    expect(parsed.nameQuery).toBe("order text");
    expect(parseStoreViewQuery("store text")).toBe("store text");
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
        fxPendingOnly: false,
        sort: "recent",
        appliedDefaultStatuses: false,
        dateFromIso: undefined,
        dateToIso: undefined,
        deliveryFromIso: undefined,
        deliveryToIso: undefined,
        deliveryOverdueOnly: false,
        deliveryLateOnly: false,
        withBalanceOnly: false,
        perPage: DEFAULT_PAGE_SIZE,
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
        fxPendingOnly: false,
        sort: "recent",
        appliedDefaultStatuses: false,
        dateFromIso: undefined,
        dateToIso: undefined,
        deliveryFromIso: undefined,
        deliveryToIso: undefined,
        deliveryOverdueOnly: false,
        deliveryLateOnly: false,
        withBalanceOnly: false,
        perPage: DEFAULT_PAGE_SIZE,
      }),
    ).toBe(false);
  });
});

/**
 * The door back to the pedidos ADR 0025 made unfindable: the paid/partial/unpaid filter it retired
 * was a percentage question, this one is the binary "still owes money" question.
 */
describe("con saldo pendiente filter", () => {
  it("parses ?balance=true", () => {
    expect(parseOrderListingParams({ balance: "true" }).withBalanceOnly).toBe(true);
    expect(parseOrderListingParams({ balance: "1" }).withBalanceOnly).toBe(true);
  });

  it("defaults to off and ignores a junk value", () => {
    expect(parseOrderListingParams({}).withBalanceOnly).toBe(false);
    expect(parseOrderListingParams({ balance: "yes" }).withBalanceOnly).toBe(false);
  });

  it("round-trips through the filter URL builder alongside a status", () => {
    const url = buildOrderListFilterUrl("/es/orders", BASE_FILTERS, {
      withBalanceOnly: true,
      statuses: ["COMPLETED"],
    });
    // The pair that answers the collector's actual question: delivered, and still owing.
    expect(url).toContain("balance=true");
    expect(url).toContain("status=COMPLETED");
    expect(parseOrderListingParams({ balance: "true", status: "COMPLETED" })).toMatchObject({
      withBalanceOnly: true,
      statuses: ["COMPLETED"],
    });
  });

  it("counts as a resettable filter", () => {
    expect(hasOnlyDefaultActiveFilters({ ...BASE_FILTERS, statuses: DEFAULT_ACTIVE_STATUSES })).toBe(true);
    expect(
      hasOnlyDefaultActiveFilters({ ...BASE_FILTERS, statuses: DEFAULT_ACTIVE_STATUSES, withBalanceOnly: true }),
    ).toBe(false);
  });
});
