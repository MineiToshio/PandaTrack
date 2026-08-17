import { describe, expect, it } from "vitest";
import { filterStoreGroups } from "../storeViewSearch";
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
    paidDeclared: false,
    orderId: "order-1",
    orderHumanReadableId: "PED-001",
    orderDate: new Date("2026-01-01T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    orderAllocatedAmountMinor: 0,
    orderHasUndetailedMoney: false,
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
  overrides: Partial<PendingProductsByStoreGroup> = {},
): PendingProductsByStoreGroup {
  return {
    store,
    openOrdersCount: new Set(pendingProducts.map((product) => product.orderId)).size,
    pendingProducts,
    debts: [],
    undetailedByOrder: [],
    ...overrides,
  };
}

describe("filterStoreGroups", () => {
  const amazon = makeGroup(makeStore("s1", "Amazon Japan"), [
    makeProduct({ itemId: "a1", name: "Nendoroid Rei" }),
    makeProduct({ itemId: "a2", name: "Blu-ray box" }),
  ]);
  const mandarake = makeGroup(makeStore("s2", "Mandarake"), [
    makeProduct({ itemId: "m1", name: "Figura Pokémon", orderId: "order-2" }),
  ]);

  it("returns every group untouched when there is no query", () => {
    expect(filterStoreGroups([amazon, mandarake], undefined)).toEqual([amazon, mandarake]);
    expect(filterStoreGroups([amazon, mandarake], "   ")).toEqual([amazon, mandarake]);
  });

  it("keeps a store matched by name whole, products included", () => {
    const result = filterStoreGroups([amazon, mandarake], "amazon");

    expect(result).toHaveLength(1);
    expect(result[0].store.id).toBe("s1");
    expect(result[0].pendingProducts.map((product) => product.itemId)).toEqual(["a1", "a2"]);
  });

  it("narrows a group to the matching products when the store name does not match", () => {
    const result = filterStoreGroups([amazon, mandarake], "nendoroid");

    expect(result).toHaveLength(1);
    expect(result[0].pendingProducts.map((product) => product.itemId)).toEqual(["a1"]);
  });

  it("matches case- and accent-insensitively on both sources", () => {
    expect(filterStoreGroups([amazon, mandarake], "POKEMON")).toHaveLength(1);
    expect(filterStoreGroups([amazon, mandarake], "pokemon")[0].store.id).toBe("s2");
    expect(filterStoreGroups([amazon, mandarake], "mandaráke")).toHaveLength(1);
  });

  it("drops groups with no match at all", () => {
    expect(filterStoreGroups([amazon, mandarake], "gundam")).toEqual([]);
  });

  it("recomputes openOrdersCount from the surviving products", () => {
    const twoOrders = makeGroup(makeStore("s3", "Surugaya"), [
      makeProduct({ itemId: "p1", name: "Nendoroid Asuka", orderId: "order-10" }),
      makeProduct({ itemId: "p2", name: "Poster", orderId: "order-11" }),
    ]);

    const result = filterStoreGroups([twoOrders], "nendoroid");

    expect(result[0].openOrdersCount).toBe(1);
  });

  it("narrows the undetailed block to the orders still represented", () => {
    const group = makeGroup(
      makeStore("s4", "Yahoo Auctions"),
      [
        makeProduct({ itemId: "p1", name: "Nendoroid Shinji", orderId: "order-20" }),
        makeProduct({ itemId: "p2", name: "Manga", orderId: "order-21" }),
      ],
      {
        undetailedByOrder: [
          { orderId: "order-20", humanReadableId: "PED-020", amountMinor: 5000, currencyCode: "PEN" },
          { orderId: "order-21", humanReadableId: "PED-021", amountMinor: 7000, currencyCode: "PEN" },
        ],
      },
    );

    const result = filterStoreGroups([group], "nendoroid");

    expect(result[0].undetailedByOrder.map((entry) => entry.orderId)).toEqual(["order-20"]);
  });

  it("leaves the store debt untouched: it is a fact about the store, not about the visible subset", () => {
    const group = makeGroup(
      makeStore("s5", "AmiAmi"),
      [
        makeProduct({ itemId: "p1", name: "Nendoroid Kaworu", orderId: "order-30" }),
        makeProduct({ itemId: "p2", name: "Keychain", orderId: "order-31" }),
      ],
      { debts: [{ currencyCode: "PEN", debtMinor: 45000 }] },
    );

    const result = filterStoreGroups([group], "nendoroid");

    expect(result[0].debts).toEqual([{ currencyCode: "PEN", debtMinor: 45000 }]);
  });
});
