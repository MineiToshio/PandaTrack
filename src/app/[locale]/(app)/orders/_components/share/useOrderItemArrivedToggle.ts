"use client";

import { useState, useTransition } from "react";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import { setOrderItemArrivedAction } from "../../_actions/orderItemActions";

export type UseOrderItemArrivedToggleOptions = {
  orderId: string;
  itemId: string;
  initialState: ItemDeliveryState;
  /** True when the item lives inside a non-cancelled delivery: the delivery owns its state. */
  lockedByDelivery: boolean;
  /** True when the order is cancelled: nothing about it can move any more. */
  lockedByCancellation: boolean;
  /**
   * Fired on EVERY transition of the optimistic state, the rollback included, so a row that needs
   * to react to it cannot end up mirroring a state the hook has already put back. It is deliberately
   * not the caller's `onClick`'s job to infer it: an inference made outside would miss the refusal
   * path, which is the one that leaves the two out of step.
   */
  onStateChange?: (state: ItemDeliveryState) => void;
};

export type OrderItemArrivedToggle = {
  state: ItemDeliveryState;
  isPending: boolean;
  /** False when a delivery or a cancellation owns the state; the caller renders static text then. */
  canToggle: boolean;
  toggle: () => void;
};

/**
 * The "is it waiting at the store or ready to collect" toggle, shared by every surface that shows
 * an order item.
 *
 * Only two of the four states are the collector's to set: `open` and `arrived_at_store`. The other
 * two belong to a delivery, which is the only thing that may move an item into transit or mark it
 * delivered, so they are read-only wherever they appear.
 *
 * The mutation is optimistic (`optimistic-client-updates.mdc`): the new state is on screen before
 * the server is asked, and it goes back on failure. That matters more in a list than on a detail
 * screen, because the collector is usually flipping several items in a row and a round trip between
 * each one would be the whole interaction.
 *
 * Presentation deliberately stays with the caller. The list's chip and the detail's pill are drawn
 * from different scales and tones, and unifying them would repaint one of the two surfaces for no
 * reason; what has to be identical is the behaviour, which is what lives here.
 */
export function useOrderItemArrivedToggle({
  orderId,
  itemId,
  initialState,
  lockedByDelivery,
  lockedByCancellation,
  onStateChange,
}: UseOrderItemArrivedToggleOptions): OrderItemArrivedToggle {
  const [state, setState] = useState<ItemDeliveryState>(initialState);
  const [isPending, startTransition] = useTransition();

  const canToggle = !lockedByDelivery && !lockedByCancellation;

  const applyState = (next: ItemDeliveryState) => {
    setState(next);
    onStateChange?.(next);
  };

  const toggle = () => {
    if (!canToggle) return;
    const target: ItemDeliveryState = state === "arrived_at_store" ? "open" : "arrived_at_store";
    const previous = state;
    applyState(target);
    startTransition(async () => {
      const result = await setOrderItemArrivedAction(orderId, itemId, target === "arrived_at_store");
      if (!result.ok) applyState(previous);
    });
  };

  return { state, isPending, canToggle, toggle };
}
