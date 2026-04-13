import { cn } from "@/lib/styles";

const STORE_BUSINESS_SIGNAL_BASE = "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium";

/** Store profile hero only: country + store type (rounded-full; not used on listing cards). */
export const STORE_HERO_META_PILL_CLASSNAME =
  "inline-flex max-w-full items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-text-body";

/** Store listing card bottom row: country + store type (same geometry as business-signal chips). */
export const STORE_LISTING_CARD_META_CHIP_CLASSNAME = cn(
  STORE_BUSINESS_SIGNAL_BASE,
  "max-w-full bg-muted/50 text-text-body",
);

/** Catalog product type chips (detail main column + store listing card). */
export const STORE_CATALOG_PRODUCT_TYPE_CHIP_CLASSNAME =
  "inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary";

/** Import destination country chips (detail + listing). */
export const STORE_CATALOG_IMPORT_COUNTRY_CHIP_CLASSNAME =
  "inline-flex items-center gap-1.5 rounded-lg border border-success/15 bg-success/8 px-3 py-1.5 text-xs font-medium text-text-body";

/** Sales channel / presence chips (detail sidebar + listing). */
export const STORE_PRESENCE_CHIP_CLASSNAME =
  "inline-flex items-center gap-1.5 rounded-lg border border-info/15 bg-info/8 px-3 py-1.5 text-xs font-medium text-text-body";

/** Commerce pill label: allow shrinking when space is tight (tooltip trigger is the whole chip). */
export const STORE_COMMERCE_SIGNAL_LABEL_CLASSNAME = "min-w-0";

/**
 * Hover/focus hint that the commerce pill reveals a tooltip (no extra icons or underlines).
 */
export const STORE_COMMERCE_SIGNAL_TOOLTIP_TRIGGER_AFFORDANCE = cn(
  "motion-safe:transition-shadow motion-safe:duration-150",
  "hover:shadow-sm hover:ring-1 hover:ring-border/35",
);

export function storeReceivesOrdersChipClassName(active: boolean) {
  return cn(STORE_BUSINESS_SIGNAL_BASE, active ? "bg-primary/10 text-primary" : "bg-muted/50 text-text-muted");
}

export function storeHasStockChipClassName(active: boolean) {
  return cn(STORE_BUSINESS_SIGNAL_BASE, active ? "bg-success/10 text-success" : "bg-muted/50 text-text-muted");
}
