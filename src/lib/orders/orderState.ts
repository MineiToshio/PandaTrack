import type { OrderStatus } from "../../../generated/prisma/client";

/**
 * Product-level delivery milestone used for display purposes.
 * "arrived_at_store" and "open" both map to "open" for order-status derivation
 * — see mapToItemDeliveryState in src/lib/deliveries/deliveryState.ts.
 */
export type ItemDeliveryState = "open" | "arrived_at_store" | "in_transit" | "delivered";

export interface OrderItemState {
  itemId: string;
  deliveryState: ItemDeliveryState;
}

/**
 * Derives the order status from item delivery associations.
 * Priority: COMPLETED > PARTIALLY_DELIVERED > IN_TRANSIT > PARTIALLY_IN_TRANSIT > OPEN.
 * CANCELLED is never returned — it is set exclusively by the cancel mutation.
 * Items in CANCELLED deliveries are treated as "open" by the caller before invoking this function.
 */
export function deriveOrderStatus(items: OrderItemState[]): Exclude<OrderStatus, "CANCELLED"> {
  if (items.length === 0) return "OPEN";

  const allDelivered = items.every((i) => i.deliveryState === "delivered");
  if (allDelivered) return "COMPLETED";

  const hasDelivered = items.some((i) => i.deliveryState === "delivered");
  if (hasDelivered) return "PARTIALLY_DELIVERED";

  const allInTransit = items.every((i) => i.deliveryState === "in_transit");
  if (allInTransit) return "IN_TRANSIT";

  const hasInTransit = items.some((i) => i.deliveryState === "in_transit");
  if (hasInTransit) return "PARTIALLY_IN_TRANSIT";

  return "OPEN";
}

/**
 * Derives hasUnpaidBalance from order totals and payment records.
 * Never persisted — computed at query time.
 */
export function deriveHasUnpaidBalance(totalCost: number, paymentsSum: number): boolean {
  return totalCost > paymentsSum;
}
