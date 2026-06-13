"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import StatusChip from "@/components/core/StatusChip";
import StoreAvatar from "@/components/core/StoreAvatar";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { formatArrivalWindow, formatShortDate, getDeliveryOverdueDays } from "../_utils/deliveryDates";
import type { DeliveriesListPageItem } from "@/lib/data/deliveries/deliveryQueries";

type DeliveryCardProps = {
  delivery: DeliveriesListPageItem;
  locale: string;
  today: Date;
  returnTo: string;
};

export default function DeliveryCard({ delivery, locale, today, returnTo }: DeliveryCardProps) {
  const t = useTranslations("deliveries");
  const [isExpanded, setIsExpanded] = useState(false);

  const overdueDays = delivery.status === "IN_TRANSIT" ? getDeliveryOverdueDays(delivery.expectedArrivalTo, today) : 0;
  const detailHref = `/${locale}${ROUTES.deliveries}/${delivery.id}?returnTo=${encodeURIComponent(returnTo)}`;
  const arrivalWindow = formatArrivalWindow(delivery.expectedArrivalFrom, delivery.expectedArrivalTo, locale);

  let arrivalLabel: string | null = null;
  if (delivery.status === "DELIVERED") {
    arrivalLabel = delivery.receivedDate
      ? t("list.table.received", { date: formatShortDate(delivery.receivedDate, locale) })
      : null;
  } else if (delivery.status === "IN_TRANSIT" && arrivalWindow) {
    arrivalLabel =
      overdueDays > 0
        ? t("list.table.expected", { window: arrivalWindow })
        : t("list.table.arrives", { window: arrivalWindow });
  }

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const next = !isExpanded;
    setIsExpanded(next);
    posthog.capture(next ? POSTHOG_EVENTS.DELIVERY.LIST_CARD_EXPANDED : POSTHOG_EVENTS.DELIVERY.LIST_CARD_COLLAPSED, {
      delivery_id: delivery.id,
    });
  };

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 rounded-[var(--radius-2xl)] [background:var(--surface-elevated)]",
        "p-4 [border:1px_solid_var(--border)]",
        "transition-[box-shadow,border-color] [transition-duration:var(--motion-fast)]",
        "hover:[border-color:color-mix(in_oklch,var(--accent)_28%,var(--border))]",
        delivery.status === "DELIVERED" && "opacity-[0.78]",
        delivery.status === "CANCELLED" && "opacity-[0.6]",
      )}
      style={{ viewTransitionName: `dlv-${delivery.id}` }}
    >
      <Link
        href={detailHref}
        aria-label={`${delivery.store.name} · ${delivery.humanReadableId}`}
        className="absolute inset-0 rounded-[var(--radius-2xl)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
      />

      <div className="pointer-events-none relative flex items-start gap-3">
        <StoreAvatar store={{ name: delivery.store.name }} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {delivery.store.name}
          </p>
          <p className="truncate [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
            {delivery.humanReadableId} ·{" "}
            {t("list.table.shipped", { date: formatDomainDate(delivery.deliveryDate, locale) })}
          </p>
        </div>
      </div>

      <div className="pointer-events-none relative flex flex-wrap items-center gap-2">
        <StatusChip
          kind="deliveryStatus"
          value={delivery.status}
          overdueDays={overdueDays}
          ariaLabel={overdueDays > 0 ? t("list.card.overdueAriaLabel", { days: overdueDays }) : undefined}
        />
      </div>

      <p className="pointer-events-none relative flex flex-wrap items-center gap-x-1.5 [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
        <span>{t("list.card.items", { count: delivery.productCount })}</span>
        {arrivalLabel && (
          <>
            <span aria-hidden>·</span>
            <span>{arrivalLabel}</span>
          </>
        )}
        <span className="ml-auto [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {formatAmountWithSymbol(delivery.cost, delivery.currencyCode, locale)}
        </span>
      </p>

      {isExpanded && (
        <ul
          id={`delivery-card-items-${delivery.id}`}
          role="list"
          className="pointer-events-none relative flex flex-col"
        >
          {delivery.items.map((item, idx) => {
            const ItemIcon = getStoreProductTypeIcon(item.productTypeKey ?? "");
            const isLast = idx === delivery.items.length - 1;
            return (
              <li
                key={item.id}
                className={cn(
                  "grid [grid-template-columns:32px_minmax(0,1fr)_auto] items-center gap-2 py-2",
                  !isLast && "[border-bottom:1px_solid_var(--border)]",
                )}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] [color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_10%,transparent)]"
                  aria-hidden
                >
                  <ItemIcon width={14} height={14} />
                </span>
                <span className="truncate [font-size:var(--text-body)] [color:var(--text-primary)]">{item.name}</span>
                <span className="shrink-0 [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
                  {t("list.card.itemQuantity", { quantity: item.quantity })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={`delivery-card-items-${delivery.id}`}
        className={cn(
          "pointer-events-auto relative -mx-4 mt-1 -mb-4 flex items-center justify-center gap-1.5 px-4 py-2.5",
          "[font-size:var(--text-caption)] [color:var(--text-secondary)]",
          "rounded-b-[var(--radius-2xl)] transition-colors duration-150",
          "hover:[color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
        )}
      >
        <span>
          {isExpanded ? t("list.card.collapse") : t("list.card.expandCount", { count: delivery.items.length })}
        </span>
        <ChevronDown
          width={14}
          height={14}
          aria-hidden="true"
          className={cn("transition-transform duration-200", isExpanded && "rotate-180")}
        />
      </button>
    </article>
  );
}
