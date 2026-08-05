"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import { describeItemDeliveryState, getItemDeliveryStateToneClassName } from "./orderItemDeliveryChip";
import { useOrderItemArrivedToggle } from "./useOrderItemArrivedToggle";

export type OrderItemStateChipProps = {
  orderId: string;
  itemId: string;
  initialState: ItemDeliveryState;
  /** True when the order is cancelled: nothing about it moves any more. */
  lockedByCancellation: boolean;
};

const CHIP_BASE = "inline-flex w-fit items-center gap-1 rounded-[var(--radius-pill)] px-1.5 [font-size:11px]";

/**
 * The per-item state chip of the orders list, and the control that flips it.
 *
 * It used to be a label. Marking a product as ready at the store meant opening the order to press
 * the same chip there, which is a navigation and a return trip for a one-bit change the collector
 * usually makes for several products at once. The chip is the control on both surfaces now.
 *
 * `in_transit` and `delivered` stay static text: those belong to a delivery, and a delivery is the
 * only thing allowed to move an item into them.
 *
 * The 44px tap target is bought with a transparent overlay rather than a taller pill, so the chip
 * keeps the density the list row was designed around while still being reachable. `pointer-events-auto`
 * is what lets it work inside the card, whose rows are deliberately inert so that the card's own
 * overlay link owns every other pixel; the chip paints above that overlay because it comes after it
 * in the DOM and carries a stacking context of its own.
 */
export default function OrderItemStateChip({
  orderId,
  itemId,
  initialState,
  lockedByCancellation,
}: OrderItemStateChipProps) {
  const t = useTranslations("orderListing");
  const tOrders = useTranslations("orders");

  // The delivery owns the two transit states wherever they appear, so the lock is derived from the
  // state itself rather than passed in: there is no case where an item is in transit and editable.
  const lockedByDelivery = initialState === "in_transit" || initialState === "delivered";

  const { state, isPending, canToggle, toggle } = useOrderItemArrivedToggle({
    orderId,
    itemId,
    initialState,
    lockedByDelivery,
    lockedByCancellation,
  });

  const descriptor = describeItemDeliveryState(state);
  const StateIcon = descriptor.icon;
  const toneClass = getItemDeliveryStateToneClassName(descriptor.toneKey);
  const body = (
    <>
      <StateIcon width={10} height={10} aria-hidden />
      {t(descriptor.labelKey)}
    </>
  );

  if (!canToggle) {
    return (
      <span
        className={cn(CHIP_BASE, toneClass)}
        title={
          lockedByDelivery
            ? tOrders("detail.items.arrivedToggleDisabledLive")
            : tOrders("detail.items.arrivedToggleDisabledCancelled")
        }
      >
        {body}
      </span>
    );
  }

  const nextStateLabel =
    state === "arrived_at_store" ? tOrders("detail.items.revertToPending") : tOrders("detail.items.markAsArrived");

  return (
    <span className="pointer-events-auto relative flex w-fit items-center">
      <button
        type="button"
        onClick={(event) => {
          // The card is one big link. Nothing about flipping a chip should navigate.
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }}
        disabled={isPending}
        aria-label={nextStateLabel}
        title={nextStateLabel}
        className={cn(
          CHIP_BASE,
          toneClass,
          "cursor-pointer transition-opacity hover:opacity-80",
          "focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none",
          // The tap target is grown with a transparent overlay rather than with padding, because
          // padding on a chip that has a background makes the pill itself taller and the list row
          // was designed around this density. The pill stays 19px; the thing a thumb hits is 47px.
          "relative after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-['']",
          isPending && "opacity-60",
        )}
      >
        {body}
      </button>
    </span>
  );
}
