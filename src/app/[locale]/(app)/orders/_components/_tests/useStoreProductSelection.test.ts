import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POSTHOG_EVENTS } from "@/lib/constants";
import type { PendingProductRow, PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import { pruneStoreSelection, useStoreProductSelection } from "../useStoreProductSelection";

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture: captureMock } }));

function selectionStartedCount(): number {
  return captureMock.mock.calls.filter((call) => call[0] === POSTHOG_EVENTS.DELIVERY.STORE_SELECTION_STARTED).length;
}

function product(itemId: string, deliveryState: PendingProductRow["deliveryState"] = "open"): PendingProductRow {
  return {
    itemId,
    name: itemId,
    quantity: 1,
    deliveryState,
    unitPrice: 1000,
    allocatedMinor: 0,
    paidDeclared: false,
    orderId: "order-1",
    orderHumanReadableId: "PED-001",
    orderDate: new Date("2026-01-05T00:00:00.000Z"),
    expectedDeliveryFrom: null,
    expectedDeliveryTo: null,
    orderAllocatedAmountMinor: 0,
    orderHasUndetailedMoney: false,
    orderTotalCost: 1000,
    orderItemCount: 1,
    currencyCode: "PEN",
    basePagableMinor: 1000,
  };
}

function group(pendingProducts: PendingProductRow[], storeId = "store-1"): PendingProductsByStoreGroup {
  return {
    store: { id: storeId, slug: "s", name: "S", logoUrl: null, sellerType: "RETAILER", status: "APPROVED" },
    openOrdersCount: 1,
    pendingProducts,
    debts: [],
    undetailedByOrder: [],
  };
}

describe("pruneStoreSelection", () => {
  it("returns the selection untouched when every marked product is still there and eligible", () => {
    const selection = { storeId: "store-1", itemIds: new Set(["a", "b"]) };

    expect(pruneStoreSelection(selection, [group([product("a"), product("b")])])).toBe(selection);
  });

  it("drops a product the server no longer lists", () => {
    const pruned = pruneStoreSelection({ storeId: "store-1", itemIds: new Set(["a", "b"]) }, [group([product("a")])]);

    expect([...(pruned?.itemIds ?? [])]).toEqual(["a"]);
  });

  it("drops a product that is still listed but no longer eligible for a delivery", () => {
    // The query calls anything not-yet-delivered "pending", so an `IN_TRANSIT` product keeps its
    // row. Selecting it would have the whole batch refused with no checkbox left to explain it.
    const pruned = pruneStoreSelection({ storeId: "store-1", itemIds: new Set(["a", "b"]) }, [
      group([product("a"), product("b", "in_transit")]),
    ]);

    expect([...(pruned?.itemIds ?? [])]).toEqual(["a"]);
  });

  it("treats `delivered` as gone too", () => {
    const pruned = pruneStoreSelection({ storeId: "store-1", itemIds: new Set(["a"]) }, [
      group([product("a", "delivered")]),
    ]);

    expect(pruned).toBeNull();
  });

  it("clears the whole selection when nothing marked survives", () => {
    // Left empty instead, the group would still read as "selecting" while asserting a selection
    // that no longer exists anywhere on screen.
    expect(pruneStoreSelection({ storeId: "store-1", itemIds: new Set(["a"]) }, [group([product("z")])])).toBeNull();
  });

  it("clears the selection when its whole store left the list", () => {
    expect(
      pruneStoreSelection({ storeId: "store-1", itemIds: new Set(["a"]) }, [group([product("a")], "store-2")]),
    ).toBeNull();
  });

  it("keeps an already-empty selection, which is touch select mode with nothing marked yet", () => {
    const selection = { storeId: "store-1", itemIds: new Set<string>() };

    expect(pruneStoreSelection(selection, [group([product("a")])])).toBe(selection);
  });

  it("is a no-op on no selection", () => {
    expect(pruneStoreSelection(null, [group([product("a")])])).toBeNull();
  });
});

describe("useStoreProductSelection funnel events", () => {
  beforeEach(() => captureMock.mockClear());

  it("counts one selection start per selection the collector began", () => {
    const { result } = renderHook(() => useStoreProductSelection());

    act(() => result.current.begin("store-1"));
    act(() => result.current.toggle("store-1", "a", { shiftKey: false, eligibleIds: ["a"] }));

    expect(selectionStartedCount()).toBe(1);
    expect(captureMock).toHaveBeenCalledWith(POSTHOG_EVENTS.DELIVERY.STORE_SELECTION_STARTED, { store_id: "store-1" });
  });

  it("does not count a restored snapshot as a new selection", () => {
    // The submit clears the selection and the refusal puts the same one back, both without the
    // collector touching anything. Counted, every failed batch would add a funnel entry for a
    // selection nobody began.
    const { result } = renderHook(() => useStoreProductSelection());

    act(() => result.current.begin("store-1"));
    const snapshot = { storeId: "store-1", itemIds: new Set(["a"]) };
    act(() => result.current.clear());
    act(() => result.current.replace(snapshot));

    expect(selectionStartedCount()).toBe(1);
  });

  it("still counts the next genuinely new selection after a restored one", () => {
    const { result } = renderHook(() => useStoreProductSelection());

    act(() => result.current.begin("store-1"));
    act(() => result.current.clear());
    act(() => result.current.replace({ storeId: "store-1", itemIds: new Set(["a"]) }));
    act(() => result.current.clear());
    act(() => result.current.begin("store-1"));

    expect(selectionStartedCount()).toBe(2);
  });
});
