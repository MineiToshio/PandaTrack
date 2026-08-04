import { describe, expect, it } from "vitest";
import { hasStickyBarActions } from "../OrderDetailStickyActionBar";

/**
 * The mobile bar must not survive as an empty strip, and the detail's 76px scroll spacer is driven
 * by this same predicate — so the two can never disagree about whether a bar exists.
 */
describe("hasStickyBarActions", () => {
  it("keeps the bar on a cancelled order, where reactivating is still possible", () => {
    expect(
      hasStickyBarActions({
        status: "CANCELLED",
        hasUnpaidBalance: false,
        remainingAmount: 0,
        canCreateDelivery: false,
      }),
    ).toBe(true);
  });

  it("keeps the bar on a completed order that still owes money, to settle the balance", () => {
    expect(
      hasStickyBarActions({
        status: "COMPLETED",
        hasUnpaidBalance: true,
        remainingAmount: 5000,
        canCreateDelivery: false,
      }),
    ).toBe(true);
  });

  it("keeps the bar while a balance is pending, because annotating a payment always applies", () => {
    expect(
      hasStickyBarActions({
        status: "OPEN",
        hasUnpaidBalance: true,
        remainingAmount: 5000,
        canCreateDelivery: false,
      }),
    ).toBe(true);
  });

  it("keeps the bar when the order is paid but a delivery can still be created", () => {
    expect(
      hasStickyBarActions({
        status: "OPEN",
        hasUnpaidBalance: false,
        remainingAmount: 0,
        canCreateDelivery: true,
      }),
    ).toBe(true);
  });

  it("drops the bar once the order is fully paid and no product can join a delivery", () => {
    // The reported case: everything delivered and settled, so "Crear entrega" was the only action
    // left and it led nowhere.
    expect(
      hasStickyBarActions({
        status: "COMPLETED",
        hasUnpaidBalance: false,
        remainingAmount: 0,
        canCreateDelivery: false,
      }),
    ).toBe(false);
  });

  it("drops the bar for a paid order whose products are already in transit", () => {
    expect(
      hasStickyBarActions({
        status: "IN_TRANSIT",
        hasUnpaidBalance: false,
        remainingAmount: 0,
        canCreateDelivery: false,
      }),
    ).toBe(false);
  });
});
