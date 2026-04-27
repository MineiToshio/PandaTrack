"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import posthog from "posthog-js";
import { useTranslations } from "next-intl";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn, COLLECTOR_CARD_SURFACE_CLASSNAME } from "@/lib/styles";
import { formatAmount } from "@/lib/currency";
import { isOrderOverdue } from "@/lib/orders/orderDerivedState";
import OrderStatusBadge from "./share/OrderStatusBadge";
import OrderUnpaidPill from "./share/OrderUnpaidPill";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

type OrderCardProps = {
  order: OrdersListPageItem;
  locale: string;
  today: Date;
  returnTo: string;
};

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

function formatDeliveryRange(
  from: Date | null,
  to: Date | null,
  locale: string,
  labels: {
    range: (vars: { from: string; to: string }) => string;
    from: (vars: { from: string }) => string;
    to: (vars: { to: string }) => string;
  },
): string | null {
  if (from && to) return labels.range({ from: formatDate(from, locale), to: formatDate(to, locale) });
  if (from) return labels.from({ from: formatDate(from, locale) });
  if (to) return labels.to({ to: formatDate(to, locale) });
  return null;
}

export default function OrderCard({ order, locale, today, returnTo }: OrderCardProps) {
  const t = useTranslations("orderListing");
  const [isExpanded, setIsExpanded] = useState(false);

  const overdue = isOrderOverdue({ expectedDeliveryTo: order.expectedDeliveryTo, status: order.status }, today);
  const showUnpaid = order.status === "COMPLETED" && order.hasUnpaidBalance;

  const deliveryText = formatDeliveryRange(order.expectedDeliveryFrom, order.expectedDeliveryTo, locale, {
    range: (vars) => t("card.delivery", vars),
    from: (vars) => t("card.deliveryFrom", vars),
    to: (vars) => t("card.deliveryTo", vars),
  });

  const detailHref = `/${locale}${ROUTES.orders}/${order.id}?returnTo=${encodeURIComponent(returnTo)}`;

  const toggleExpanded = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    posthog.capture(next ? POSTHOG_EVENTS.ORDER.LIST_CARD_EXPANDED : POSTHOG_EVENTS.ORDER.LIST_CARD_COLLAPSED, {
      order_id: order.id,
    });
  };

  return (
    <article
      className={cn(
        COLLECTOR_CARD_SURFACE_CLASSNAME,
        "hover:border-primary/60 hover:shadow-primary/15 group relative p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <Link
        href={detailHref}
        aria-label={order.store.name}
        className="focus-visible:ring-ring absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
      />
      <div className="pointer-events-none relative space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Heading as="h3" size="xs" className="text-text-title line-clamp-2 leading-snug">
              {order.store.name}
            </Heading>
            <Typography size="xs" className="text-text-muted">
              {formatDate(order.orderDate, locale)}
            </Typography>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <OrderStatusBadge status={order.status} />
            {showUnpaid && <OrderUnpaidPill label={t("card.unpaid")} />}
            {overdue && (
              <span className="border-warning/40 bg-warning/15 text-warning inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
                <AlertTriangle className="size-3.5" aria-hidden />
                {t("card.overdue")}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Typography size="xs" className="text-text-muted">
              {t("card.items", { count: order.itemCount })}
            </Typography>
            <span className="text-text-muted/70" aria-hidden>
              ·
            </span>
            <Typography size="xs" className="text-text-body font-semibold">
              {formatAmount(order.totalCost, order.currencyCode)}
            </Typography>
            <span className="text-text-muted/70" aria-hidden>
              ·
            </span>
            <Typography size="xs" className="text-text-muted">
              {t("card.paymentPercentage", { pct: order.paymentPercentage })}
            </Typography>
          </div>
          {deliveryText && (
            <Typography
              size="xs"
              className={cn("sm:text-right", overdue ? "text-warning font-medium" : "text-text-muted")}
            >
              {deliveryText}
            </Typography>
          )}
        </div>

        <div
          className="bg-muted/40 relative h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-label={t("card.paymentBarLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={order.paymentPercentage}
        >
          <div
            className="bg-success h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, order.paymentPercentage))}%` }}
          />
        </div>
      </div>

      <div className="pointer-events-auto relative z-20 mt-3 flex justify-end">
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-controls={`order-card-items-${order.id}`}
          className="text-text-muted hover:text-primary focus-visible:ring-ring inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {isExpanded ? t("card.collapse") : t("card.expand")}
          {isExpanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </button>
      </div>

      {isExpanded && (
        <div
          id={`order-card-items-${order.id}`}
          className="border-border/60 pointer-events-none relative mt-3 border-t pt-3"
        >
          <Typography size="2xs" className="text-text-muted mb-2 block font-medium">
            {t("card.itemsSectionTitle")}
          </Typography>
          <ul className="space-y-2" role="list">
            {order.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="text-text-body line-clamp-2 min-w-0">{item.name}</span>
                  <span className="text-text-muted text-xs tabular-nums">
                    {t("card.itemQuantity", { quantity: item.quantity })}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    item.deliveryState === "delivered"
                      ? "border-success/40 bg-success/15 text-success"
                      : item.deliveryState === "in_transit"
                        ? "border-info/40 bg-info/15 text-info"
                        : "border-border bg-muted/40 text-text-muted",
                  )}
                >
                  {t(`card.itemDelivery.${item.deliveryState}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
