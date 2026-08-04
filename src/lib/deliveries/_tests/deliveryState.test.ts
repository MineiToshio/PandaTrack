import { describe, expect, it } from "vitest";
import { OrderItemDeliveryState } from "../../../../generated/prisma/client";
import { getNextItemDeliveryState, isEligibleForDelivery, mapToItemDeliveryState } from "../deliveryState";

describe("mapToItemDeliveryState", () => {
  it("maps NONE to 'open'", () => {
    expect(mapToItemDeliveryState(OrderItemDeliveryState.NONE)).toBe("open");
  });

  it("maps ARRIVED_AT_STORE to 'open'", () => {
    expect(mapToItemDeliveryState(OrderItemDeliveryState.ARRIVED_AT_STORE)).toBe("open");
  });

  it("maps IN_TRANSIT to 'in_transit'", () => {
    expect(mapToItemDeliveryState(OrderItemDeliveryState.IN_TRANSIT)).toBe("in_transit");
  });

  it("maps DELIVERED to 'delivered'", () => {
    expect(mapToItemDeliveryState(OrderItemDeliveryState.DELIVERED)).toBe("delivered");
  });
});

describe("getNextItemDeliveryState", () => {
  it("create → IN_TRANSIT", () => {
    expect(getNextItemDeliveryState("create")).toBe(OrderItemDeliveryState.IN_TRANSIT);
  });

  it("edit-add → IN_TRANSIT", () => {
    expect(getNextItemDeliveryState("edit-add")).toBe(OrderItemDeliveryState.IN_TRANSIT);
  });

  it("edit-remove → ARRIVED_AT_STORE", () => {
    expect(getNextItemDeliveryState("edit-remove")).toBe(OrderItemDeliveryState.ARRIVED_AT_STORE);
  });

  it("mark-delivered → DELIVERED", () => {
    expect(getNextItemDeliveryState("mark-delivered")).toBe(OrderItemDeliveryState.DELIVERED);
  });

  it("reopen → IN_TRANSIT", () => {
    expect(getNextItemDeliveryState("reopen")).toBe(OrderItemDeliveryState.IN_TRANSIT);
  });

  it("cancel → ARRIVED_AT_STORE", () => {
    expect(getNextItemDeliveryState("cancel")).toBe(OrderItemDeliveryState.ARRIVED_AT_STORE);
  });

  it("delete → ARRIVED_AT_STORE", () => {
    expect(getNextItemDeliveryState("delete")).toBe(OrderItemDeliveryState.ARRIVED_AT_STORE);
  });
});

describe("isEligibleForDelivery", () => {
  it("returns true for NONE", () => {
    expect(isEligibleForDelivery(OrderItemDeliveryState.NONE)).toBe(true);
  });

  it("returns true for ARRIVED_AT_STORE", () => {
    expect(isEligibleForDelivery(OrderItemDeliveryState.ARRIVED_AT_STORE)).toBe(true);
  });

  it("returns false for IN_TRANSIT", () => {
    expect(isEligibleForDelivery(OrderItemDeliveryState.IN_TRANSIT)).toBe(false);
  });

  it("returns false for DELIVERED", () => {
    expect(isEligibleForDelivery(OrderItemDeliveryState.DELIVERED)).toBe(false);
  });
});

describe("getNextItemDeliveryState create-received", () => {
  it("sends a product straight to DELIVERED, skipping IN_TRANSIT", () => {
    expect(getNextItemDeliveryState("create-received")).toBe(OrderItemDeliveryState.DELIVERED);
  });
});
