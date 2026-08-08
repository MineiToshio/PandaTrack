import { describe, expect, it } from "vitest";
import { parseStoreViewSort, sortStoreGroups, STORE_VIEW_SORT_VALUES } from "../storeViewSort";
import type { PendingProductRow, PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";

function makeStore(id: string, name: string): PendingProductsByStoreGroup["store"] {
  return { id, slug: id, name, logoUrl: null, sellerType: "RETAILER", status: "APPROVED" };
}

function makeProduct(overrides: Partial<PendingProductRow> = {}): PendingProductRow {
  return {
    itemId: "item-1",
    name: "Product",
    quantity: 1,
    deliveryState: "open",
    unitPrice: 1000,
    allocatedMinor: 0,
    settled: false,
    orderId: "order-1",
    orderDate: new Date("2026-01-01T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    orderTotalCost: 1000,
    orderItemCount: 1,
    currencyCode: "PEN",
    basePagableMinor: 1000,
    ...overrides,
  };
}

function makeGroup(
  store: PendingProductsByStoreGroup["store"],
  pendingProducts: PendingProductRow[],
  debts: PendingProductsByStoreGroup["debts"] = [],
): PendingProductsByStoreGroup {
  return { store, openOrdersCount: 1, pendingProducts, debts };
}

describe("parseStoreViewSort", () => {
  it("accepts every allow-listed value", () => {
    for (const value of STORE_VIEW_SORT_VALUES) {
      expect(parseStoreViewSort(value)).toBe(value);
    }
  });

  it("falls back to arrival-asc for an unknown or missing value", () => {
    expect(parseStoreViewSort(undefined)).toBe("arrival-asc");
    expect(parseStoreViewSort("bogus")).toBe("arrival-asc");
    expect(parseStoreViewSort(["bogus"])).toBe("arrival-asc");
  });
});

describe("sortStoreGroups arrival-asc (default)", () => {
  it("orders products within a store by soonest arrival, nulls last", () => {
    const noWindow = makeProduct({ itemId: "no-window" });
    const soon = makeProduct({ itemId: "soon", expectedDeliveryTo: new Date("2026-03-01") });
    const later = makeProduct({ itemId: "later", expectedDeliveryTo: new Date("2026-06-01") });
    const group = makeGroup(makeStore("s1", "Store A"), [noWindow, later, soon]);

    const [sorted] = sortStoreGroups([group], "arrival-asc");

    expect(sorted.pendingProducts.map((p) => p.itemId)).toEqual(["soon", "later", "no-window"]);
  });

  it("orders stores by their soonest own arrival", () => {
    const groupA = makeGroup(makeStore("a", "Store A"), [
      makeProduct({ itemId: "a1", expectedDeliveryTo: new Date("2026-06-01") }),
    ]);
    const groupB = makeGroup(makeStore("b", "Store B"), [
      makeProduct({ itemId: "b1", expectedDeliveryTo: new Date("2026-01-01") }),
    ]);

    const sorted = sortStoreGroups([groupA, groupB], "arrival-asc");

    expect(sorted.map((g) => g.store.id)).toEqual(["b", "a"]);
  });
});

describe("sortStoreGroups recent / oldest", () => {
  it("orders products by orderDate desc for recent, and stores by their max orderDate", () => {
    const groupA = makeGroup(makeStore("a", "Store A"), [
      makeProduct({ itemId: "a1", orderDate: new Date("2026-01-01") }),
      makeProduct({ itemId: "a2", orderDate: new Date("2026-05-01") }),
    ]);
    const groupB = makeGroup(makeStore("b", "Store B"), [
      makeProduct({ itemId: "b1", orderDate: new Date("2026-03-01") }),
    ]);

    const sorted = sortStoreGroups([groupA, groupB], "recent");

    expect(sorted[0].store.id).toBe("a"); // max orderDate 2026-05-01 beats 2026-03-01
    expect(sorted[0].pendingProducts.map((p) => p.itemId)).toEqual(["a2", "a1"]);
  });

  it("inverts to ascending orderDate and the store's min orderDate for oldest", () => {
    const groupA = makeGroup(makeStore("a", "Store A"), [
      makeProduct({ itemId: "a1", orderDate: new Date("2026-01-01") }),
      makeProduct({ itemId: "a2", orderDate: new Date("2026-05-01") }),
    ]);
    const groupB = makeGroup(makeStore("b", "Store B"), [
      makeProduct({ itemId: "b1", orderDate: new Date("2026-02-01") }),
    ]);

    const sorted = sortStoreGroups([groupA, groupB], "oldest");

    expect(sorted[0].store.id).toBe("a"); // min orderDate 2026-01-01 beats 2026-02-01
    expect(sorted[0].pendingProducts.map((p) => p.itemId)).toEqual(["a1", "a2"]);
  });
});

describe("sortStoreGroups store-asc / store-desc", () => {
  it("orders stores alphabetically and leaves products in arrival-asc order", () => {
    const groupZ = makeGroup(makeStore("z", "Zelda Store"), [
      makeProduct({ itemId: "z-late", expectedDeliveryTo: new Date("2026-06-01") }),
      makeProduct({ itemId: "z-soon", expectedDeliveryTo: new Date("2026-01-01") }),
    ]);
    const groupA = makeGroup(makeStore("a", "Akiba Store"), [makeProduct({ itemId: "a1" })]);

    const asc = sortStoreGroups([groupZ, groupA], "store-asc");
    expect(asc.map((g) => g.store.id)).toEqual(["a", "z"]);
    expect(asc[1].pendingProducts.map((p) => p.itemId)).toEqual(["z-soon", "z-late"]);

    const desc = sortStoreGroups([groupZ, groupA], "store-desc");
    expect(desc.map((g) => g.store.id)).toEqual(["z", "a"]);
  });
});

describe("sortStoreGroups total-desc", () => {
  it("orders products by basePagableMinor desc, nulls last", () => {
    const cheap = makeProduct({ itemId: "cheap", basePagableMinor: 500 });
    const noPrice = makeProduct({ itemId: "no-price", basePagableMinor: null });
    const expensive = makeProduct({ itemId: "expensive", basePagableMinor: 5000 });
    const group = makeGroup(makeStore("s1", "Store A"), [cheap, noPrice, expensive]);

    const [sorted] = sortStoreGroups([group], "total-desc");

    expect(sorted.pendingProducts.map((p) => p.itemId)).toEqual(["expensive", "cheap", "no-price"]);
  });

  it("orders stores by the highest debtMinor across their currencies", () => {
    const groupA = makeGroup(
      makeStore("a", "Store A"),
      [makeProduct({ itemId: "a1" })],
      [{ currencyCode: "PEN", debtMinor: 1000 }],
    );
    const groupB = makeGroup(
      makeStore("b", "Store B"),
      [makeProduct({ itemId: "b1" })],
      [
        { currencyCode: "USD", debtMinor: 200 },
        { currencyCode: "EUR", debtMinor: 5000 },
      ],
    );

    const sorted = sortStoreGroups([groupA, groupB], "total-desc");

    // Store B's max debt (5000 EUR) outranks Store A's single 1000 PEN debt, even though the
    // currencies differ — the documented multi-currency simplification.
    expect(sorted.map((g) => g.store.id)).toEqual(["b", "a"]);
  });
});
