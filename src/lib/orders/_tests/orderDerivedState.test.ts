import { describe, expect, it } from "vitest";
import { isOrderOverdue } from "../orderDerivedState";

const today = new Date("2026-04-26T00:00:00Z");
const yesterday = new Date("2026-04-25T00:00:00Z");
const tomorrow = new Date("2026-04-27T00:00:00Z");

describe("isOrderOverdue", () => {
  it("returns false when expectedDeliveryTo is null", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: null, status: "OPEN" }, today)).toBe(false);
  });

  it("returns false when delivery is in the future", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: tomorrow, status: "OPEN" }, today)).toBe(false);
  });

  it("returns false when delivery is exactly today", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: today, status: "OPEN" }, today)).toBe(false);
  });

  it("returns true when delivery is in the past and status is OPEN", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "OPEN" }, today)).toBe(true);
  });

  it("returns true for in-flight statuses", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "PARTIALLY_IN_TRANSIT" }, today)).toBe(true);
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "IN_TRANSIT" }, today)).toBe(true);
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "PARTIALLY_DELIVERED" }, today)).toBe(true);
  });

  it("returns false when status is COMPLETED", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "COMPLETED" }, today)).toBe(false);
  });

  it("returns false when status is CANCELLED", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "CANCELLED" }, today)).toBe(false);
  });
});
