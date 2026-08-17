import type { OrderStatus } from "../../../generated/prisma/client";
import type { ItemDeliveryState } from "./orderState";

/**
 * The single date an order is late against.
 *
 * An expected window can be open at its start (`from` set, `to` null) when a chat only promised
 * "a partir del 15". The close of the window is what "late" means when there is one; the start is
 * the only date there is when there is not. Three places had already reached that conclusion
 * independently and one had not, so the same order could match the "Entrega atrasada" filter and
 * count as an overdue arrival on the dashboard while its row still showed a neutral "Abierto"
 * chip. Now they all ask this.
 */
export function resolveOrderArrivalDueDate(order: {
  expectedDeliveryFrom?: Date | null;
  expectedDeliveryTo: Date | null;
}): Date | null {
  return order.expectedDeliveryTo ?? order.expectedDeliveryFrom ?? null;
}

/**
 * Has every product of this order already been observed reaching the store?
 *
 * The order-level counterpart of `resolveArrivalState`'s `resolved` (ADR 0030 §3), and the same
 * rule: an OBSERVED event answers the prediction, so the prediction stops being scored. `Order.
 * expectedDelivery*` is the window for the products to reach the STORE — the shipment to the
 * collector carries its own (`Delivery.expectedArrival*`) — which is why `in_transit` counts as
 * observed too: an item is only in transit because it left the store it had already reached.
 *
 * `every`, not `some`. An order with one product on the shelf and five still awaited is late, and
 * about those five it is late for a real reason. The dashboard's own `hasOrderArrived` uses `some`
 * and therefore hides such orders; that divergence is older than this helper and is NOT resolved
 * here.
 *
 * An order with no items is never "observed": there is no event to have observed, and answering
 * `true` from an empty `every` would silently clear the flag on the emptiest orders there are.
 */
export function isOrderArrivalObserved(items: Array<{ deliveryState: ItemDeliveryState }>): boolean {
  if (items.length === 0) return false;
  return items.every((item) => item.deliveryState !== "open");
}

/**
 * Pure helper used by the list and detail to flag orders whose expected
 * delivery window has already elapsed without reaching a final state.
 *
 * `items` is REQUIRED, and deliberately so. Before it existed, an order whose only product was
 * already sitting at the store still read "Atrasado 2 meses" on its list chip and raised a
 * `role="alert"` banner on its detail, directly above the product's own "Listo en tienda" pill —
 * the exact reading the store view's `resolved` state exists to prevent, on the surfaces the
 * collector reaches by clicking that very row. Two of the collector's orders were in that state.
 * An optional parameter would have let a third surface reintroduce it by omission.
 */
export function isOrderOverdue(
  order: {
    expectedDeliveryFrom?: Date | null;
    expectedDeliveryTo: Date | null;
    status: OrderStatus;
    items: Array<{ deliveryState: ItemDeliveryState }>;
  },
  today: Date,
): boolean {
  const dueDate = resolveOrderArrivalDueDate(order);
  if (!dueDate) return false;
  if (order.status === "COMPLETED" || order.status === "CANCELLED") return false;
  if (isOrderArrivalObserved(order.items)) return false;
  return dueDate < today;
}
