import type { OrderStatus } from "../../../generated/prisma/client";

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
 * Pure helper used by the list and detail to flag orders whose expected
 * delivery window has already elapsed without reaching a final state.
 */
export function isOrderOverdue(
  order: { expectedDeliveryFrom?: Date | null; expectedDeliveryTo: Date | null; status: OrderStatus },
  today: Date,
): boolean {
  const dueDate = resolveOrderArrivalDueDate(order);
  if (!dueDate) return false;
  if (order.status === "COMPLETED" || order.status === "CANCELLED") return false;
  return dueDate < today;
}
