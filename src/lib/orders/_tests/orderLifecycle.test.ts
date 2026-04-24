import { describe, it, expect } from "vitest";
import { canDeleteOrder, canCancelOrder, computeOrderEligibility } from "../orderLifecycle";
import type { ItemDeliveryState } from "../orderState";

function makeItems(states: ItemDeliveryState[]) {
  return states.map((deliveryState) => ({ deliveryState }));
}

describe("canDeleteOrder / canCancelOrder", () => {
  it("allows delete and cancel when items is empty", () => {
    const items = makeItems([]);
    expect(canDeleteOrder(items)).toBe(true);
    expect(canCancelOrder(items)).toBe(true);
  });

  it("allows delete and cancel when all items are open", () => {
    const items = makeItems(["open", "open", "open"]);
    expect(canDeleteOrder(items)).toBe(true);
    expect(canCancelOrder(items)).toBe(true);
  });

  it("blocks delete and cancel when at least one item is in_transit", () => {
    const items = makeItems(["open", "in_transit"]);
    expect(canDeleteOrder(items)).toBe(false);
    expect(canCancelOrder(items)).toBe(false);
  });

  it("blocks delete and cancel when at least one item is delivered", () => {
    const items = makeItems(["open", "delivered"]);
    expect(canDeleteOrder(items)).toBe(false);
    expect(canCancelOrder(items)).toBe(false);
  });

  it("allows delete and cancel when all items are open (cancelled deliveries treated as open)", () => {
    // Cancelled delivery links are filtered at query time; they arrive here as "open"
    const items = makeItems(["open", "open"]);
    expect(canDeleteOrder(items)).toBe(true);
    expect(canCancelOrder(items)).toBe(true);
  });
});

describe("computeOrderEligibility", () => {
  it("returns no blockReason when eligible", () => {
    const result = computeOrderEligibility(makeItems(["open"]));
    expect(result.blockReason).toBeUndefined();
  });

  it("returns ITEMS_LINKED_TO_DELIVERY blockReason when blocked", () => {
    const result = computeOrderEligibility(makeItems(["in_transit"]));
    expect(result.blockReason).toBe("ITEMS_LINKED_TO_DELIVERY");
  });
});
