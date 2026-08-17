import { describe, expect, it } from "vitest";
import type { ItemDeliveryState } from "../orderState";
import { isOrderArrivalObserved, isOrderOverdue } from "../orderDerivedState";

const today = new Date("2026-04-26T00:00:00Z");
const yesterday = new Date("2026-04-25T00:00:00Z");
const tomorrow = new Date("2026-04-27T00:00:00Z");

/** The ordinary order: products still waiting, which is what every case below except T10 is about. */
const waiting: Array<{ deliveryState: ItemDeliveryState }> = [{ deliveryState: "open" }];

describe("isOrderOverdue", () => {
  it("returns false when expectedDeliveryTo is null", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: null, status: "OPEN", items: waiting }, today)).toBe(false);
  });

  it("returns false when delivery is in the future", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: tomorrow, status: "OPEN", items: waiting }, today)).toBe(false);
  });

  it("returns false when delivery is exactly today", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: today, status: "OPEN", items: waiting }, today)).toBe(false);
  });

  it("returns true when delivery is in the past and status is OPEN", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "OPEN", items: waiting }, today)).toBe(true);
  });

  it("returns true for in-flight statuses", () => {
    expect(
      isOrderOverdue({ expectedDeliveryTo: yesterday, status: "PARTIALLY_IN_TRANSIT", items: waiting }, today),
    ).toBe(true);
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "IN_TRANSIT", items: waiting }, today)).toBe(true);
    expect(
      isOrderOverdue({ expectedDeliveryTo: yesterday, status: "PARTIALLY_DELIVERED", items: waiting }, today),
    ).toBe(true);
  });

  it("returns false when status is COMPLETED", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "COMPLETED", items: waiting }, today)).toBe(false);
  });

  it("returns false when status is CANCELLED", () => {
    expect(isOrderOverdue({ expectedDeliveryTo: yesterday, status: "CANCELLED", items: waiting }, today)).toBe(false);
  });
});

/**
 * T10 — the order-level half of ADR 0030 §3: an OBSERVED arrival answers the order's prediction too.
 *
 * The reported case, at order level. `ORD-20260509-02` holds one product, that product has been at
 * the store since before its 12 jun window closed, and until this branch existed the order read
 * "Atrasado 2 meses" on its list chip and opened its detail with a `role="alert"` banner counting
 * the same delay, directly above the product's own "Listo en tienda" pill. The store view had
 * refused to say it since ADR 0030; the two surfaces one click away had not.
 *
 * The `some`/`every` pair is the load-bearing part. A rule written with `some` would clear the flag
 * on `ORD-20260120-01` too, which has five products still waiting and one delivered, and is late
 * about those five.
 */
describe("an order whose products have all been observed arriving is not late (T10)", () => {
  it("stops flagging an order whose only product is already at the store", () => {
    expect(
      isOrderOverdue(
        { expectedDeliveryTo: yesterday, status: "OPEN", items: [{ deliveryState: "arrived_at_store" }] },
        today,
      ),
    ).toBe(false);
  });

  it("stops flagging one whose products have already shipped from the store", () => {
    expect(
      isOrderOverdue(
        {
          expectedDeliveryTo: yesterday,
          status: "IN_TRANSIT",
          items: [{ deliveryState: "in_transit" }, { deliveryState: "delivered" }],
        },
        today,
      ),
    ).toBe(false);
  });

  it("keeps flagging an order with even one product still waiting", () => {
    // The control. Without it, every assertion above passes against a rule written with `some`,
    // which is the rule the dashboard actually uses and the reason it hides this exact order.
    expect(
      isOrderOverdue(
        {
          expectedDeliveryTo: yesterday,
          status: "PARTIALLY_DELIVERED",
          items: [
            { deliveryState: "delivered" },
            { deliveryState: "open" },
            { deliveryState: "open" },
            { deliveryState: "open" },
          ],
        },
        today,
      ),
    ).toBe(true);
  });
});

describe("isOrderArrivalObserved", () => {
  it("is false for an order with no products at all", () => {
    // An empty `every` is `true`, and answering `true` here would clear the overdue flag on the
    // emptiest orders there are rather than on the ones whose products were seen arriving.
    expect(isOrderArrivalObserved([])).toBe(false);
  });

  it("is true only once every product has left `open`", () => {
    expect(isOrderArrivalObserved([{ deliveryState: "arrived_at_store" }, { deliveryState: "open" }])).toBe(false);
    expect(isOrderArrivalObserved([{ deliveryState: "arrived_at_store" }, { deliveryState: "in_transit" }])).toBe(true);
  });
});
