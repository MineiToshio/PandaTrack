"use client";

import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import StoreAvatar from "@/components/core/StoreAvatar";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { isOrderOverdue } from "@/lib/orders/orderDerivedState";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import OrderUnpaidPill from "./share/OrderUnpaidPill";
import { describeOrderListChip, describeOverdueDays, getOrderListChipToneClassName } from "./share/orderListStatusChip";
import { describeItemDeliveryState, getItemDeliveryStateToneClassName } from "./share/orderItemDeliveryChip";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

type OrderCardProps = {
  order: OrdersListPageItem;
  locale: string;
  today: Date;
  returnTo: string;
  /** Expansion is owned by the list coordinator so "expand/collapse all" can drive every card. */
  isExpanded: boolean;
  onToggle: () => void;
};

function formatDate(date: Date, locale: string): string {
  return formatDomainDate(date, locale);
}

export default function OrderCard({ order, locale, today, returnTo, isExpanded, onToggle }: OrderCardProps) {
  const t = useTranslations("orderListing");

  const overdue = isOrderOverdue({ expectedDeliveryTo: order.expectedDeliveryTo, status: order.status }, today);
  const overdueDays = overdue ? describeOverdueDays(order.expectedDeliveryTo, today) : 0;
  const chip = describeOrderListChip({
    status: order.status,
    paymentPercentage: order.paymentPercentage,
    hasUnpaidBalance: order.hasUnpaidBalance,
    isOverdue: overdue,
    overdueDays,
  });
  const ChipIcon = chip.icon;
  const showUnpaid = order.status === "COMPLETED" && order.hasUnpaidBalance;
  const detailHref = `/${locale}${ROUTES.orders}/${order.id}?returnTo=${encodeURIComponent(returnTo)}`;
  const isCompletedOrCancelled = order.status === "COMPLETED" || order.status === "CANCELLED";

  const progressTone = isCompletedOrCancelled
    ? "[background:var(--success)]"
    : overdue || (order.status === "COMPLETED" && order.hasUnpaidBalance)
      ? "[background:var(--warning)]"
      : order.paymentPercentage >= 100
        ? "[background:var(--success)]"
        : "[background:var(--accent)]";

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    // The card is overlaid by a full-bleed detail link; stop the toggle from navigating.
    event.preventDefault();
    event.stopPropagation();
    onToggle();
  };

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 rounded-[var(--radius-2xl)] [background:var(--surface-elevated)]",
        "p-4 [border:1px_solid_var(--border)]",
        "transition-[box-shadow,border-color] [transition-duration:var(--motion-fast)]",
        "hover:[border-color:color-mix(in_oklch,var(--accent)_28%,var(--border))]",
        isCompletedOrCancelled && "opacity-[0.85]",
      )}
      style={{ viewTransitionName: `order-${order.id}` }}
    >
      <ViewTransitionLink
        href={detailHref}
        viewTransitionEntity="order"
        aria-label={`${order.store.name} · ${order.humanReadableId}`}
        className="absolute inset-0 rounded-[var(--radius-2xl)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
      />

      <div className="pointer-events-none relative flex items-start gap-3">
        <StoreAvatar store={{ name: order.store.name }} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {order.store.name}
          </p>
          <p className="truncate [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
            {order.humanReadableId} · {formatDate(order.orderDate, locale)}
          </p>
        </div>
      </div>

      <div className="pointer-events-none relative flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] [font-weight:var(--font-weight-medium)] whitespace-nowrap [border:1px_solid]",
            getOrderListChipToneClassName(chip.toneKey),
          )}
        >
          <ChipIcon width={12} height={12} aria-hidden="true" />
          {t(chip.labelKey, chip.labelVars)}
        </span>
        {showUnpaid && <OrderUnpaidPill label={t("card.unpaid")} />}
      </div>

      <div className="pointer-events-none relative flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-label={t("card.paymentBarLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={order.paymentPercentage}
          className="relative h-[3px] w-full overflow-hidden rounded-full [background:color-mix(in_oklch,var(--text-primary)_10%,transparent)]"
        >
          <div
            className={cn("h-full rounded-full", progressTone)}
            style={{ width: `${Math.min(100, Math.max(0, order.paymentPercentage))}%` }}
          />
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
          <span>{t("card.items", { count: order.itemCount })}</span>
          <span aria-hidden>·</span>
          <span>{t("card.paymentPercentage", { pct: order.paymentPercentage })}</span>
          <span aria-hidden>·</span>
          <span className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {formatAmountWithSymbol(order.totalCost, order.currencyCode, locale)}
          </span>
        </p>
      </div>

      {isExpanded && (
        <ul
          id={`order-card-items-${order.id}`}
          role="list"
          className={cn(
            // Recessed detail band (matches the desktop table drawer) so the items read as this
            // order's interior, distinct from the summary above.
            "pointer-events-none relative -mx-4 flex flex-col py-1 pr-4 pl-[calc(1rem-2px)]",
            "[border-left:2px_solid_color-mix(in_oklch,var(--accent-cool)_55%,transparent)]",
            "[background:color-mix(in_oklch,var(--text-primary)_3.5%,transparent)]",
          )}
        >
          {order.items.map((item, idx) => {
            const ItemIcon = getStoreProductTypeIcon(item.productTypeKey ?? "");
            const itemState = describeItemDeliveryState(item.deliveryState);
            const StateIcon = itemState.icon;
            const isLast = idx === order.items.length - 1;
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
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate [font-size:var(--text-body)] [color:var(--text-primary)]">{item.name}</span>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1 rounded-[var(--radius-pill)] px-1.5 [font-size:11px]",
                      getItemDeliveryStateToneClassName(itemState.toneKey),
                    )}
                  >
                    <StateIcon width={10} height={10} aria-hidden />
                    {t(itemState.labelKey)}
                  </span>
                </div>
                <span className="shrink-0 [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
                  {t("card.itemQuantity", { quantity: item.quantity })}
                  {item.unitPrice != null && (
                    <>
                      {" · "}
                      <span className="[color:var(--text-primary)]">
                        {formatAmountWithSymbol(item.unitPrice, order.currencyCode, locale)}
                      </span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer — full-width expand affordance; bleeds to card edges and tints the whole
          bottom strip on hover (no inner pill, no separator line). */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={`order-card-items-${order.id}`}
        className={cn(
          "pointer-events-auto relative -mx-4 mt-1 -mb-4 flex items-center justify-center gap-1.5 px-4 py-2.5",
          "[font-size:var(--text-caption)] [color:var(--text-secondary)]",
          "rounded-b-[var(--radius-2xl)] transition-colors duration-150",
          "hover:[color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
        )}
      >
        <span>{isExpanded ? t("card.collapse") : t("card.expand")}</span>
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
