import type { OrderStatus } from "../../../generated/prisma/client";

/**
 * Pure helper used by the list and detail to flag orders whose expected
 * delivery window has already elapsed without reaching a final state.
 */
export function isOrderOverdue(order: { expectedDeliveryTo: Date | null; status: OrderStatus }, today: Date): boolean {
  if (!order.expectedDeliveryTo) return false;
  if (order.status === "COMPLETED" || order.status === "CANCELLED") return false;
  return order.expectedDeliveryTo < today;
}
