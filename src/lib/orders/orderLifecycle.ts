import type { ItemDeliveryState } from "./orderState";

export type EligibilityBlockReason = "ITEMS_LINKED_TO_DELIVERY";

export type OrderEligibilityResult = {
  canDelete: boolean;
  canCancel: boolean;
  blockReason?: EligibilityBlockReason;
};

/**
 * Determines whether an order can be cancelled or deleted.
 * Both operations are blocked when any item is linked to a non-cancelled delivery
 * (deliveryState "in_transit" or "delivered"). Cancelled deliveries are treated
 * as "open" by the query layer and never appear here.
 */
export function computeOrderEligibility(items: Array<{ deliveryState: ItemDeliveryState }>): OrderEligibilityResult {
  const hasNonCancelledDeliveryLinks = items.some(
    (item) => item.deliveryState === "in_transit" || item.deliveryState === "delivered",
  );

  return {
    canDelete: !hasNonCancelledDeliveryLinks,
    canCancel: !hasNonCancelledDeliveryLinks,
    blockReason: hasNonCancelledDeliveryLinks ? "ITEMS_LINKED_TO_DELIVERY" : undefined,
  };
}

export function canDeleteOrder(items: Array<{ deliveryState: ItemDeliveryState }>): boolean {
  return computeOrderEligibility(items).canDelete;
}

export function canCancelOrder(items: Array<{ deliveryState: ItemDeliveryState }>): boolean {
  return computeOrderEligibility(items).canCancel;
}
