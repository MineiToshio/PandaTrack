"use client";

import { Clock, PackageCheck, Store as StoreIcon, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/styles";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import { useOrderItemArrivedToggle } from "../../_components/share/useOrderItemArrivedToggle";

type OrderItemStatePillProps = {
  orderId: string;
  itemId: string;
  initialState: ItemDeliveryState;
  /** True when the item lives inside a non-cancelled delivery — pill must be read-only. */
  lockedByDelivery: boolean;
  /** True when the order is cancelled — pill must be read-only with a different reason. */
  lockedByCancellation: boolean;
};

const STATE_ICON: Record<ItemDeliveryState, LucideIcon> = {
  open: Clock,
  arrived_at_store: StoreIcon,
  in_transit: Truck,
  delivered: PackageCheck,
};

const STATE_LABEL_KEY: Record<ItemDeliveryState, string> = {
  open: "detail.items.statusPending",
  arrived_at_store: "detail.items.statusArrived",
  in_transit: "detail.items.statusInTransit",
  delivered: "detail.items.statusDelivered",
};

// Demo `.s7-istate.{none|arrived|transit|delivered}`: bg `color-mix tint 12%`, color tint, border tint 35%.
const STATE_CLASSES: Record<ItemDeliveryState, string> = {
  open: "text-text-secondary border-border [background:color-mix(in_oklch,var(--text-primary)_8%,transparent)]",
  arrived_at_store:
    "text-success [background:color-mix(in_oklch,var(--success)_12%,transparent)] [border-color:color-mix(in_oklch,var(--success)_35%,transparent)]",
  in_transit:
    "text-info [background:color-mix(in_oklch,var(--info)_12%,transparent)] [border-color:color-mix(in_oklch,var(--info)_35%,transparent)]",
  delivered:
    "text-success [background:color-mix(in_oklch,var(--success)_12%,transparent)] [border-color:color-mix(in_oklch,var(--success)_35%,transparent)]",
};

/**
 * State pill for an order item. Two read-only states (`in_transit`, `delivered`) are owned by
 * the delivery and render as a static `<span>`. The other two (`open`, `arrived_at_store`) are
 * user-controlled — the pill becomes a `<button>` that toggles between them with optimistic
 * update. Single visual control, no extra "Marcar como listo en tienda" copy in the row.
 */
export default function OrderItemStatePill({
  orderId,
  itemId,
  initialState,
  lockedByDelivery,
  lockedByCancellation,
}: OrderItemStatePillProps) {
  const t = useTranslations("orders");
  // The mutation, the optimistic swap and the revert are shared with the orders list, so both
  // surfaces flip an item the same way; only the pill's own scale and tones live here.
  const { state, isPending, canToggle, toggle } = useOrderItemArrivedToggle({
    orderId,
    itemId,
    initialState,
    lockedByDelivery,
    lockedByCancellation,
  });

  const Icon = STATE_ICON[state];
  const label = t(STATE_LABEL_KEY[state]);

  // Demo `.s7-istate`: gap 4px · padding 2px 8px · 11px / 500 · rounded-full · 1px border
  const baseClass = cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
    STATE_CLASSES[state],
  );

  if (!canToggle) {
    return (
      <span
        className={baseClass}
        title={
          lockedByDelivery
            ? t("detail.items.arrivedToggleDisabledLive")
            : t("detail.items.arrivedToggleDisabledCancelled")
        }
      >
        <Icon className="size-3" aria-hidden />
        {label}
      </span>
    );
  }

  const nextStateLabel =
    state === "arrived_at_store" ? t("detail.items.revertToPending") : t("detail.items.markAsArrived");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={nextStateLabel}
      title={nextStateLabel}
      className={cn(baseClass, "cursor-pointer transition-opacity hover:opacity-80", isPending && "opacity-60")}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </button>
  );
}
