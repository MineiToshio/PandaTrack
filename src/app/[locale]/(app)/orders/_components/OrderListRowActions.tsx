"use client";

import { ChevronRight, PackageCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { QuickArrivalModal } from "@/components/modules/QuickArrival";
import { useQuickArrival } from "@/components/modules/QuickArrival/useQuickArrival";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { isItemEligibleForDelivery } from "@/lib/orders/orderState";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

export type OrderListRowActionsProps = {
  order: OrdersListPageItem;
  baseCurrencyCode: string | null;
  locale: string;
  /** Where the row's "Ver detalle" link points, so the actions can sit on the same line. */
  detailHref: string;
  /** `table` or `card`, sent with the funnel event so the two breakpoints stay comparable. */
  surface: "table" | "card";
};

/**
 * Delivery actions on an orders-list row, rendered inside the row's expanded drawer.
 *
 * They live in the drawer rather than in a column of their own, and that placement is measured, not
 * stylistic: the desktop grid is `40px 1.6fr 0.9fr 1.2fr 0.9fr 1.1fr 24px`, which at the `lg`
 * breakpoint (1024px) leaves the five data tracks about 96px each. The status chip already needs
 * ~120px in a ~100px track there, so the row is at its limit before anything is added; a control
 * column would take roughly a fifth of the remaining width and start truncating the store name.
 * The drawer costs one click, already renders every product with its live delivery chip (which is
 * the modal's own content), and "Expandir todo" opens every row at once.
 *
 * The two actions are deliberately not peers. Logging an arrival is a two-second modal, so it is a
 * button; creating a delivery navigates to a four-step wizard on another page, so it reads as a
 * link next to "Ver detalle" instead of competing with the action that does the work in place.
 */
export default function OrderListRowActions({
  order,
  baseCurrencyCode,
  locale,
  detailHref,
  surface,
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
  // Same gate as the order detail (FR-08-15a): no product a delivery could take, no delivery action.
  const canCreateDelivery = order.status !== "CANCELLED" && quickArrivalItems.length > 0;

  const labelArgs = { code: order.humanReadableId, store: order.store.name };

  return (
    <div className="pointer-events-auto relative mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
      {canCreateDelivery && (
        <>
          <Button
            type="button"
            variant="tonal"
            // `md` carries the system's 44px mobile tap target; `sm` is 32px and this sits in a
            // band that is thumb-reachable on a phone.
            size="md"
            onClick={quickArrival.open}
            leadingIcon={<PackageCheck size={14} aria-hidden />}
            aria-label={tList("rowActions.quickArrivalAriaLabel", labelArgs)}
          >
            {t("detail.actions.quickArrival")}
          </Button>

          <a
            href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${order.id}`}
            aria-label={tList("rowActions.createDeliveryAriaLabel", labelArgs)}
            data-ph-event={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
            data-ph-props={JSON.stringify({ orderId: order.id, status: order.status, source: "order_list" })}
            className="inline-flex items-center gap-1 [font-size:var(--text-caption)] [color:var(--accent)] hover:underline"
          >
            <Truck width={12} height={12} aria-hidden />
            {t("detail.actions.createDelivery")}
          </a>
        </>
      )}

      <ViewTransitionLink
        href={detailHref}
        viewTransitionEntity="order"
        className="inline-flex items-center gap-1 [font-size:var(--text-caption)] [color:var(--accent)] hover:underline"
      >
        {tList("card.openDetail")}
        <ChevronRight width={12} height={12} aria-hidden />
      </ViewTransitionLink>

      {canCreateDelivery && (
        <QuickArrivalModal
          isOpen={quickArrival.isOpen}
          onClose={quickArrival.close}
          orderHumanReadableId={order.humanReadableId}
          storeName={order.store.name}
          items={quickArrivalItems}
          baseCurrencyCode={baseCurrencyCode}
          locale={locale}
          onSubmit={quickArrival.submit}
        />
      )}
    </div>
  );
}
