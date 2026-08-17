import { Clock, PackageCheck, Store, Truck } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { ItemDeliveryState } from "@/lib/orders/orderState";

export type ItemDeliveryTone = "neutral" | "info" | "warning" | "success";

export type ItemDeliveryDescriptor = {
  toneKey: ItemDeliveryTone;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Translation key under `orderListing.card.itemDelivery.*`. */
  labelKey: string;
};

/** Label on `--{status}-chip-text`, fill and border on the raw token — see `orderListStatusChip`. */
const TONE_CLASSES: Record<ItemDeliveryTone, string> = {
  neutral:
    "[color:var(--text-secondary)] [background:color-mix(in_oklch,var(--text-primary)_6%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--text-primary)_14%,transparent)]",
  info: "[color:var(--info-chip-text)] [background:color-mix(in_oklch,var(--info)_10%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--info)_24%,transparent)]",
  warning:
    "[color:var(--warning-chip-text)] [background:color-mix(in_oklch,var(--warning)_10%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--warning)_24%,transparent)]",
  success:
    "[color:var(--success-chip-text)] [background:color-mix(in_oklch,var(--success)_10%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--success)_24%,transparent)]",
};

export function getItemDeliveryStateToneClassName(tone: ItemDeliveryTone): string {
  return TONE_CLASSES[tone];
}

/**
 * Maps the per-item delivery state to a chip descriptor. Matches the `.s7-istate` blocks
 * in the demo HTML (anchor `#s7-orders-list-default`): Pendiente · Listo en tienda ·
 * En camino · Entregado.
 */
export function describeItemDeliveryState(state: ItemDeliveryState): ItemDeliveryDescriptor {
  switch (state) {
    case "arrived_at_store":
      return { toneKey: "info", icon: Store, labelKey: "card.itemDelivery.arrived_at_store" };
    case "in_transit":
      return { toneKey: "info", icon: Truck, labelKey: "card.itemDelivery.in_transit" };
    case "delivered":
      return { toneKey: "success", icon: PackageCheck, labelKey: "card.itemDelivery.delivered" };
    case "open":
    default:
      return { toneKey: "neutral", icon: Clock, labelKey: "card.itemDelivery.open" };
  }
}
