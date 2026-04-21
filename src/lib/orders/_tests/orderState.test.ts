import { describe, expect, it } from "vitest";
import { deriveOrderStatus, deriveHasUnpaidBalance } from "../orderState";

describe("deriveOrderStatus", () => {
  it("returns OPEN when items array is empty", () => {
    expect(deriveOrderStatus([])).toBe("OPEN");
  });

  it("returns OPEN when all items have no active delivery", () => {
    expect(
      deriveOrderStatus([
        { itemId: "1", deliveryState: "open" },
        { itemId: "2", deliveryState: "open" },
        { itemId: "3", deliveryState: "open" },
      ]),
    ).toBe("OPEN");
  });

  it("returns PARTIALLY_IN_TRANSIT when at least one item is in_transit and at least one is open", () => {
    expect(
      deriveOrderStatus([
        { itemId: "1", deliveryState: "in_transit" },
        { itemId: "2", deliveryState: "open" },
        { itemId: "3", deliveryState: "open" },
      ]),
    ).toBe("PARTIALLY_IN_TRANSIT");
  });

  it("returns IN_TRANSIT when all items are in in_transit deliveries", () => {
    expect(
      deriveOrderStatus([
        { itemId: "1", deliveryState: "in_transit" },
        { itemId: "2", deliveryState: "in_transit" },
        { itemId: "3", deliveryState: "in_transit" },
      ]),
    ).toBe("IN_TRANSIT");
  });

  it("returns PARTIALLY_DELIVERED when at least one item is delivered and not all are delivered", () => {
    expect(
      deriveOrderStatus([
        { itemId: "1", deliveryState: "delivered" },
        { itemId: "2", deliveryState: "open" },
        { itemId: "3", deliveryState: "open" },
      ]),
    ).toBe("PARTIALLY_DELIVERED");
  });

  it("returns COMPLETED when all items are in delivered deliveries", () => {
    expect(
      deriveOrderStatus([
        { itemId: "1", deliveryState: "delivered" },
        { itemId: "2", deliveryState: "delivered" },
        { itemId: "3", deliveryState: "delivered" },
      ]),
    ).toBe("COMPLETED");
  });

  it("returns PARTIALLY_DELIVERED (not PARTIALLY_IN_TRANSIT) when mix of delivered and in_transit and open", () => {
    expect(
      deriveOrderStatus([
        { itemId: "1", deliveryState: "delivered" },
        { itemId: "2", deliveryState: "in_transit" },
        { itemId: "3", deliveryState: "open" },
      ]),
    ).toBe("PARTIALLY_DELIVERED");
  });

  it("returns OPEN when all items mapped from CANCELLED deliveries are treated as open", () => {
    // Caller remaps CANCELLED delivery items to "open" before calling deriveOrderStatus
    expect(
      deriveOrderStatus([
        { itemId: "1", deliveryState: "open" },
        { itemId: "2", deliveryState: "open" },
      ]),
    ).toBe("OPEN");
  });
});

describe("deriveHasUnpaidBalance", () => {
  it("returns false when payments sum equals totalCost", () => {
    expect(deriveHasUnpaidBalance(10000, 10000)).toBe(false);
  });

  it("returns true when payments sum is less than totalCost", () => {
    expect(deriveHasUnpaidBalance(10000, 7000)).toBe(true);
  });

  it("returns true when there are no payments", () => {
    expect(deriveHasUnpaidBalance(10000, 0)).toBe(true);
  });

  it("returns true for a COMPLETED order with payments sum below totalCost", () => {
    // Status is irrelevant to this function — caller decides when to check
    expect(deriveHasUnpaidBalance(50000, 30000)).toBe(true);
  });
});
