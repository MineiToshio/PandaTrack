"use client";

import { Box, PackageSearch } from "lucide-react";
import Tooltip from "@/components/core/Tooltip";
import { cn } from "@/lib/styles";
import {
  STORE_COMMERCE_SIGNAL_LABEL_CLASSNAME,
  STORE_COMMERCE_SIGNAL_TOOLTIP_TRIGGER_AFFORDANCE,
  storeHasStockChipClassName,
  storeReceivesOrdersChipClassName,
} from "./storePublicChipClassnames";

export type StoreCommerceSignalPillsProps = {
  receivesOrders: boolean | null;
  hasStock: boolean | null;
  receivesOrdersLabel: string;
  hasStockLabel: string;
  receivesOrdersTooltip: string;
  hasStockTooltip: string;
  /** Listing cards use a full-surface link; raise z-index and restore pointer events for hover/focus. */
  liftAboveCardOverlay?: boolean;
};

/**
 * Commerce option chips (order-based buying vs in-stock sales) with accessible tooltips.
 * Hover adds a light ring and shadow so the chip reads as “more info” without an extra icon.
 */
export default function StoreCommerceSignalPills({
  receivesOrders,
  hasStock,
  receivesOrdersLabel,
  hasStockLabel,
  receivesOrdersTooltip,
  hasStockTooltip,
  liftAboveCardOverlay = false,
}: StoreCommerceSignalPillsProps) {
  return (
    <>
      <Tooltip
        content={receivesOrdersTooltip}
        triggerClassName={cn(
          storeReceivesOrdersChipClassName(receivesOrders === true),
          STORE_COMMERCE_SIGNAL_TOOLTIP_TRIGGER_AFFORDANCE,
        )}
        liftAboveCardOverlay={liftAboveCardOverlay}
      >
        <PackageSearch className="size-3.5 shrink-0" aria-hidden />
        <span className={STORE_COMMERCE_SIGNAL_LABEL_CLASSNAME}>{receivesOrdersLabel}</span>
      </Tooltip>
      <Tooltip
        content={hasStockTooltip}
        triggerClassName={cn(
          storeHasStockChipClassName(hasStock === true),
          STORE_COMMERCE_SIGNAL_TOOLTIP_TRIGGER_AFFORDANCE,
        )}
        liftAboveCardOverlay={liftAboveCardOverlay}
      >
        <Box className="size-3.5 shrink-0" aria-hidden />
        <span className={STORE_COMMERCE_SIGNAL_LABEL_CLASSNAME}>{hasStockLabel}</span>
      </Tooltip>
    </>
  );
}
