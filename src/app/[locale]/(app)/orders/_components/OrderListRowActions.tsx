"use client";

import { ChevronRight, PackageCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { QuickArrivalModal } from "@/components/modules/QuickArrival";
import { useQuickArrival } from "@/components/modules/QuickArrival/useQuickArrival";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { isItemEligibleForDelivery } from "@/lib/orders/orderState";
import { cn } from "@/lib/styles";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

export type OrderListRowActionsProps = {
  order: OrdersListPageItem;
  baseCurrencyCode: string | null;
  locale: string;
  /** Where the row's "Abrir detalle" link points. Unused on `card`, which is itself that link. */
  detailHref: string;
  /** `table` or `card`, sent with the funnel event so the two breakpoints stay comparable. */
  surface: "table" | "card";
  /**
   * Collapses the row this drawer belongs to. Supplied by the desktop table, whose expand chevron
   * sits in the row's first grid row: with the product cap gone a long drawer pushes that chevron
   * far above the fold, leaving no way to close it. The mobile card needs none, since its own
   * toggle already sits below the items.
   */
  onCollapse?: () => void;
};

/**
 * Text-weight action row inside an orders-list row's expanded drawer.
 *
 * Every affordance here is a text action, not a filled control, and only the primary one carries
 * the accent. Material's card guidance is explicit that text buttons keep the emphasis on the
 * card's own content, and this row sits on a tinted band, where the design system asks for neutral
 * weight over brand colour (interface-patterns.md "Secondary actions on tinted panels"). A tonal
 * pill here outranked the card it belongs to. Differentiating on one axis (colour) rather than
 * three (colour + fill + height) is what keeps the row quiet.
 *
 * The 44px touch target is bought with padding rather than a visible pill, so the row reads as a
 * footer seam and still passes the tap-target rule.
 *
 * On `card` the detail link is dropped: the whole card, expanded band included, is already the link
 * to the order, so repeating it would be a third affordance for a destination that is one tap away
 * anywhere. The table row has no such overlay over its drawer, so it keeps the link.
 */
export default function OrderListRowActions({
  order,
  baseCurrencyCode,
  locale,
  detailHref,
  surface,
  onCollapse,
}: OrderListRowActionsProps) {
  const t = useTranslations("orders");
  const tList = useTranslations("orderListing");
  const quickArrival = useQuickArrival({
    orderId: order.id,
    locale,
    source: "order_list",
    sourceList: surface,
  });

  const quickArrivalItems = order.items
    .filter((item) => isItemEligibleForDelivery(item.deliveryState))
    .map((item) => ({ id: item.id, name: item.name }));
  // Products the modal cannot offer because they already shipped or arrived. Passed so it can say
  // so, rather than silently showing fewer products than the row's own count.
  const settledItemCount = order.items.length - quickArrivalItems.length;
  // Same gate as the order detail (FR-08-15a): no product a delivery could take, no delivery action.
  const canCreateDelivery = order.status !== "CANCELLED" && quickArrivalItems.length > 0;
  const showDetailLink = surface === "table";

  if (!canCreateDelivery && !showDetailLink && !onCollapse) return null;

  const labelArgs = { code: order.humanReadableId, store: order.store.name };
  // Shared shape for every action in the row: same height, same rhythm, differing only in colour.
  const actionClass =
    "inline-flex min-h-11 items-center gap-1.5 [font-size:var(--text-caption)] md:min-h-9 " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)] rounded-[var(--radius-sm)]";

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex flex-wrap items-center gap-x-5",
        // A hairline seam, not a second tinted box: the row belongs to the band it closes.
        canCreateDelivery && "mt-1 pt-0.5 [border-top:1px_solid_var(--border)]",
      )}
    >
      {canCreateDelivery && (
        <>
          <button
            type="button"
            onClick={quickArrival.open}
            aria-label={tList("rowActions.quickArrivalAriaLabel", labelArgs)}
            className={cn(
              actionClass,
              // The single accent in the band, which is what makes it read as the primary action
              // without any fill.
              "[font-weight:var(--font-weight-medium-body)] [color:var(--accent)] hover:underline hover:underline-offset-4",
            )}
          >
            <PackageCheck width={15} height={15} aria-hidden />
            {t("detail.actions.quickArrival")}
          </button>

          <a
            href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${order.id}`}
            aria-label={tList("rowActions.createDeliveryAriaLabel", labelArgs)}
            data-ph-event={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
            data-ph-props={JSON.stringify({ orderId: order.id, status: order.status, source: "order_list" })}
            className={cn(actionClass, "[color:var(--text-secondary)] hover:[color:var(--text-primary)]")}
          >
            <Truck width={14} height={14} aria-hidden />
            {t("detail.actions.createDelivery")}
          </a>
        </>
      )}

      {showDetailLink && (
        <ViewTransitionLink
          href={detailHref}
          viewTransitionEntity="order"
          className={cn(actionClass, "[color:var(--text-secondary)] hover:[color:var(--text-primary)]")}
        >
          {tList("card.openDetail")}
          <ChevronRight width={12} height={12} aria-hidden />
        </ViewTransitionLink>
      )}

      {onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          className={cn(actionClass, "[color:var(--text-secondary)] hover:[color:var(--text-primary)]")}
        >
          {tList("card.collapse")}
        </button>
      )}

      {canCreateDelivery && (
        <QuickArrivalModal
          isOpen={quickArrival.isOpen}
          onClose={quickArrival.close}
          orderHumanReadableId={order.humanReadableId}
          storeName={order.store.name}
          items={quickArrivalItems}
          settledItemCount={settledItemCount}
          baseCurrencyCode={baseCurrencyCode}
          locale={locale}
          onSubmit={quickArrival.submit}
        />
      )}
    </div>
  );
}
