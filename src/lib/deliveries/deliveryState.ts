import { OrderItemDeliveryState } from "../../../generated/prisma/client";
import type { ItemDeliveryState } from "@/lib/orders/orderState";

export type DeliveryMutationType =
  "create" | "create-received" | "edit-add" | "edit-remove" | "mark-delivered" | "reopen" | "cancel" | "delete";

/**
 * Maps a persisted OrderItemDeliveryState to the ItemDeliveryState used by
 * deriveOrderStatus. NONE and ARRIVED_AT_STORE both map to "open" because
 * neither state represents an active delivery association for order-status
 * derivation purposes.
 */
export function mapToItemDeliveryState(state: OrderItemDeliveryState): ItemDeliveryState {
  switch (state) {
    case OrderItemDeliveryState.IN_TRANSIT:
      return "in_transit";
    case OrderItemDeliveryState.DELIVERED:
      return "delivered";
    case OrderItemDeliveryState.NONE:
    case OrderItemDeliveryState.ARRIVED_AT_STORE:
      return "open";
  }
}

/**
 * Returns the next OrderItemDeliveryState for a product after a delivery
 * mutation. This is a pure function with no database access.
 *
 * Transition rules:
 * - create / edit-add: NONE or ARRIVED_AT_STORE → IN_TRANSIT
 * - create-received: NONE or ARRIVED_AT_STORE → DELIVERED (quick arrival: the box is already
 *   in the collector's hands, so the delivery is born closed and the product never observes
 *   the IN_TRANSIT milestone it factually skipped)
 * - edit-remove: IN_TRANSIT → ARRIVED_AT_STORE
 * - mark-delivered: IN_TRANSIT → DELIVERED
 * - reopen: DELIVERED → IN_TRANSIT
 * - cancel / delete: IN_TRANSIT → ARRIVED_AT_STORE
 */
export function getNextItemDeliveryState(mutation: DeliveryMutationType): OrderItemDeliveryState {
  switch (mutation) {
    case "create":
    case "edit-add":
      return OrderItemDeliveryState.IN_TRANSIT;

    case "edit-remove":
    case "cancel":
    case "delete":
      return OrderItemDeliveryState.ARRIVED_AT_STORE;

    case "create-received":
    case "mark-delivered":
      return OrderItemDeliveryState.DELIVERED;

    case "reopen":
      return OrderItemDeliveryState.IN_TRANSIT;
  }
}

/**
 * Returns the set of item states that are eligible for delivery selection.
 * Eligible: NONE or ARRIVED_AT_STORE.
 * Ineligible (excluded from selection, not shown as disabled): IN_TRANSIT, DELIVERED.
 */
export function isEligibleForDelivery(state: OrderItemDeliveryState): boolean {
  return state === OrderItemDeliveryState.NONE || state === OrderItemDeliveryState.ARRIVED_AT_STORE;
}
