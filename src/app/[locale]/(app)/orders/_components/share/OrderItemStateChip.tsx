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
  /**
   * `exceptional` drops the chip's TEXT below `md` while the item is in the state the surrounding
   * list is already ABOUT, keeping it whenever the state deviates. Only the label goes: the control
   * and its icon stay on every row, so nothing becomes unreachable. See the note on `isQuietLabel`.
   */
  labelDisplay?: "always" | "exceptional";
  /**
   * Notifies the row of the OPTIMISTIC state, rollback included. The chip owns that state (it owns
   * the toggle), so a sibling reading `product.deliveryState` from the server would keep predicting
   * an arrival about a product the collector has just put on the shelf. See `ArrivalMeta`.
   */
  onStateChange?: (state: ItemDeliveryState) => void;
};

/**
 * No `whitespace-nowrap` here, deliberately. A pill that wraps renders as a two- or three-line blob
 * with its own rounded corners, so it looks like a defect wherever the row has a neighbour that
 * could give up the width instead — but whether one exists is the CALLER's fact, not this
 * component's. `StorePendingProductCard` has one (the truncating product name) and therefore pins
 * the chip with `shrink-0 whitespace-nowrap` on its wrapper; `OrderCard` does not — its chip sits
 * alone in a `minmax(0,1fr)` grid column with a quantity column beside it, and at 320px a pinned
 * chip overflows 40px UNDER that column instead of wrapping. Measured both ways at 320px.
 */
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
  labelDisplay = "always",
  onStateChange,
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
    onStateChange,
  });

  const descriptor = describeItemDeliveryState(state);
  const StateIcon = descriptor.icon;
  const toneClass = getItemDeliveryStateToneClassName(descriptor.toneKey);

  // `open` is the state a list of PENDING products is already about: 61 of the collector's 67
  // pending products sit there, so on a phone the label repeats the group header ("28 productos
  // pendientes") 131px at a time, on a line 254-364px wide. The deviation is the news, so the
  // deviation keeps its words and the default keeps only its glyph. The button itself never goes:
  // its accessible name is the ACTION ("Marcar como listo en tienda"), which states the current
  // state by implication and is unchanged by any of this. From `md` up the text comes back, because
  // from there the row has room and the label costs nobody anything.
  const isQuietLabel = labelDisplay === "exceptional" && state === "open" && canToggle;
  const body = (
    <>
      <StateIcon width={10} height={10} aria-hidden />
      <span className={cn(isQuietLabel && "hidden md:inline")}>{t(descriptor.labelKey)}</span>
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
          //
          // Without its text the pill collapses to whatever the 10px glyph occupies, so it is
          // pinned to an 18px square instead — a round 18px dot that keeps the row's baseline
          // exactly where the labelled 18.5px pill left it. 18 + 2 × 13 = 44 on both axes, which is
          // why a single inset value is right here and a two-value one would be wrong: the
          // two-value form in `docs/design/interface-patterns.md` §12 is for a box that is NOT
          // square. Growing sideways takes nothing from anyone (to the chip's left is the product
          // name, which is text), and it SHRINKS the band this overlay shares with the order link
          // on the card's second line from the old 131px wide to 44px.
          "relative after:absolute after:content-['']",
          isQuietLabel
            ? "size-[18px] justify-center px-0 after:[inset:-13px] md:size-auto md:px-1.5 md:after:[inset:-14px_0px]"
            : "after:inset-x-0 after:-inset-y-3.5",
          isPending && "opacity-60",
        )}
      >
        {body}
      </button>
    </span>
  );
}
