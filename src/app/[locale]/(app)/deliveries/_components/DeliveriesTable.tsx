"use client";

import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import StatusChip from "@/components/core/StatusChip";
import StoreAvatar from "@/components/core/StoreAvatar";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { formatArrivalWindow, formatShortDate, getDeliveryOverdueDays } from "../_utils/deliveryDates";
import type { DeliveriesListPageItem } from "@/lib/data/deliveries/deliveryQueries";

type DeliveriesTableProps = {
  deliveries: DeliveriesListPageItem[];
  locale: string;
  today: Date;
  returnTo: string;
  /** Multi-open expansion owned by the list coordinator (drives "expand/collapse all"). */
  expandedIds: Set<string>;
  onToggle: (deliveryId: string) => void;
};

const GRID_COLS =
  "[grid-template-columns:40px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_24px]";

const HEADER_CELL_CLASS =
  "[font-family:var(--font-mono)] [font-size:11px] [letter-spacing:0.06em] uppercase [color:var(--text-muted)]";

export default function DeliveriesTable({
  deliveries,
  locale,
  today,
  returnTo,
  expandedIds,
  onToggle,
}: DeliveriesTableProps) {
  const t = useTranslations("deliveries");

  return (
    <div
      className="hidden overflow-hidden rounded-[var(--radius-2xl)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)] lg:block"
      role="table"
      aria-label={t("list.title")}
    >
      <div
        role="row"
        className={cn(
          "grid items-center gap-3 px-4 py-2.5 [background:color-mix(in_oklab,var(--text-primary)_3%,var(--surface-elevated))] [border-bottom:1px_solid_var(--border)]",
          GRID_COLS,
        )}
      >
        <span aria-hidden />
        <span className={HEADER_CELL_CLASS}>{t("list.table.headerDelivery")}</span>
        <span className={cn(HEADER_CELL_CLASS, "text-center")}>{t("list.table.headerProducts")}</span>
        <span className={cn(HEADER_CELL_CLASS, "text-center")}>{t("list.table.headerStatus")}</span>
        <span className={cn(HEADER_CELL_CLASS, "text-center")}>{t("list.table.headerCost")}</span>
        <span className={cn(HEADER_CELL_CLASS, "text-center")}>{t("list.table.headerArrival")}</span>
        <span aria-hidden />
      </div>

      <ul role="rowgroup" className="flex flex-col">
        {deliveries.map((delivery) => {
          const overdueDays =
            delivery.status === "IN_TRANSIT" ? getDeliveryOverdueDays(delivery.expectedArrivalTo, today) : 0;
          const isExpanded = expandedIds.has(delivery.id);
          const detailHref = `/${locale}${ROUTES.deliveries}/${delivery.id}?returnTo=${encodeURIComponent(returnTo)}`;
          const arrivalWindow = formatArrivalWindow(delivery.expectedArrivalFrom, delivery.expectedArrivalTo, locale);

          // Delivered rows show the received date; cancelled rows show nothing.
          let arrivalLabel = "—";
          if (delivery.status === "DELIVERED") {
            arrivalLabel = delivery.receivedDate
              ? t("list.table.received", { date: formatShortDate(delivery.receivedDate, locale) })
              : "—";
          } else if (delivery.status === "IN_TRANSIT" && arrivalWindow) {
            arrivalLabel =
              overdueDays > 0
                ? t("list.table.expected", { window: arrivalWindow })
                : t("list.table.arrives", { window: arrivalWindow });
          }


          return (
            <li
              key={delivery.id}
              role="row"
              className={cn(
                "relative grid items-center gap-3 px-4 py-3",
                GRID_COLS,
                "[border-top:1px_solid_var(--border)]",
                "transition-[background-color] [transition-duration:var(--motion-fast)]",
                "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
                delivery.status === "DELIVERED" && "opacity-[0.75]",
                delivery.status === "CANCELLED" && "opacity-[0.6]",
              )}
              style={{ viewTransitionName: `dlv-${delivery.id}` }}
            >
              <ViewTransitionLink
                href={detailHref}
                viewTransitionEntity="delivery"
                aria-label={`${delivery.store.name} · ${delivery.humanReadableId}`}
                className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
              />

              {delivery.store.logoUrl ? (
                <StoreAvatar
                  store={{ name: delivery.store.name, logo: { src: delivery.store.logoUrl, aspect: "square" } }}
                  size={32}
                  className="pointer-events-none"
                />
              ) : (
                <StoreAvatar store={{ name: delivery.store.name }} size={32} className="pointer-events-none" />
              )}

              <div className="pointer-events-none relative min-w-0">
                <p className="truncate [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                  {delivery.store.name}
                </p>
                <p className="truncate [font-family:var(--font-mono)] [font-size:12px] [color:var(--text-muted)] tabular-nums">
                  {delivery.humanReadableId} ·{" "}
                  {t("list.table.shipped", { date: formatDomainDate(delivery.deliveryDate, locale) })}
                </p>
              </div>

              <p className="pointer-events-none relative text-center [font-size:13px] [color:var(--text-secondary)] tabular-nums">
                <span className="[font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">
                  {delivery.productCount}
                </span>{" "}
                {t("list.card.itemsSuffix", { count: delivery.productCount })}
              </p>

              <div className="pointer-events-none relative flex flex-wrap items-center gap-1.5">
                <StatusChip
                  kind="deliveryStatus"
                  value={delivery.status}
                  overdueDays={overdueDays}
                  ariaLabel={overdueDays > 0 ? t("list.card.overdueAriaLabel", { days: overdueDays }) : undefined}
                />
              </div>

              <p className="pointer-events-none relative text-right [font-size:var(--text-body)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)] tabular-nums">
                {formatAmountWithSymbol(delivery.cost, delivery.currencyCode, locale)}
              </p>

              <p className="pointer-events-none relative [font-size:12px] [color:var(--text-muted)] tabular-nums">
                {arrivalLabel}
              </p>

              <button
                type="button"
                onClick={() => onToggle(delivery.id)}
                aria-expanded={isExpanded}
                aria-controls={`delivery-row-items-${delivery.id}`}
                aria-label={isExpanded ? t("list.card.collapse") : t("list.card.expand")}
                className={cn(
                  "pointer-events-auto relative inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)]",
                  "[color:var(--text-secondary)] hover:[color:var(--text-primary)]",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
                )}
              >
                <ChevronRight
                  width={16}
                  height={16}
                  aria-hidden="true"
                  className={cn("transition-transform duration-200", isExpanded && "rotate-90")}
                />
              </button>

              {/* Expanded items — flat list with no source-order grouping, no
                  secondary metadata. Traceability by order lives in the detail screen. */}
              {isExpanded && (
                <div
                  id={`delivery-row-items-${delivery.id}`}
                  className={cn(
                    // Recessed "drawer" so the expanded detail reads as this delivery's interior,
                    // not another row: bleeds to the row edges, tinted surface + accent-cool rail,
                    // ending before the next delivery's clean row divider.
                    "relative col-span-7 -mx-4 mt-3 -mb-3 flex flex-col gap-1.5 py-3 pr-4 pl-[calc(1rem-2px)]",
                    "[border-left:2px_solid_color-mix(in_oklch,var(--accent-cool)_55%,transparent)]",
                    "[background:color-mix(in_oklch,var(--text-primary)_3.5%,transparent)]",
                  )}
                >
                  <ul role="list" className="flex max-w-[720px] flex-col">
                    {delivery.items.map((item, idx) => {
                      const ItemIcon = getStoreProductTypeIcon(item.productTypeKey ?? "");
                      const isLast = idx === delivery.items.length - 1;
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "grid [grid-template-columns:32px_minmax(0,1fr)_50px] items-center gap-3 py-2",
                            !isLast && "[border-bottom:1px_solid_var(--border)]",
                          )}
                        >
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] [color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_10%,transparent)]"
                            aria-hidden
                          >
                            <ItemIcon width={14} height={14} />
                          </span>
                          <span className="min-w-0 truncate [font-size:var(--text-body)] [color:var(--text-primary)]">
                            {item.name}
                          </span>
                          <span className="text-right [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
                            {t("list.card.itemQuantity", { quantity: item.quantity })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {/*
                    The chevron that opened this drawer is in the row's first grid row, so a long
                    product list leaves it far above the fold with no way back. The drawer carries
                    its own collapse action, mirroring the mobile card, whose toggle already sits
                    below its items.
                  */}
                  <div className="pointer-events-auto relative mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
                    <ViewTransitionLink
                      href={detailHref}
                      viewTransitionEntity="delivery"
                      className="inline-flex items-center gap-1 [font-size:var(--text-caption)] [color:var(--accent)] hover:underline"
                    >
                      {t("list.card.openDetail")}
                      <ChevronRight width={12} height={12} aria-hidden />
                    </ViewTransitionLink>
                    <button
                      type="button"
                      onClick={() => onToggle(delivery.id)}
                      className="inline-flex items-center gap-1 [font-size:var(--text-caption)] [color:var(--text-secondary)] hover:underline"
                    >
                      {t("list.card.collapse")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
