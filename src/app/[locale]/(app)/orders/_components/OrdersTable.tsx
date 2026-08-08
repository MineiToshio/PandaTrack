"use client";

import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import StoreAvatar from "@/components/core/StoreAvatar";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { isOrderOverdue, resolveOrderArrivalDueDate } from "@/lib/orders/orderDerivedState";
import { formatArrivalWindow } from "@/lib/arrivalWindow";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import StoreTombstoneNotice from "./share/StoreTombstoneNotice";
import { describeOrderListChip, describeOverdueDays, getOrderListChipToneClassName } from "./share/orderListStatusChip";
import { resolveStoreTombstone } from "@/lib/store/storeTombstone";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";
import OrderItemStateChip from "./share/OrderItemStateChip";
import OrderListRowActions from "./OrderListRowActions";

type OrdersTableProps = {
  orders: OrdersListPageItem[];
  locale: string;
  today: Date;
  returnTo: string;
  baseCurrencyCode: string | null;
  /** Multi-open expansion owned by the list coordinator (drives "expand/collapse all"). */
  expandedIds: Set<string>;
  onToggle: (orderId: string) => void;
};

const GRID_COLS = "[grid-template-columns:40px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1fr)_24px]";

const HEADER_CELL_CLASS =
  "[font-family:var(--font-mono)] [font-size:11px] [letter-spacing:0.06em] uppercase [color:var(--text-muted)]";

function formatDate(date: Date, locale: string): string {
  return formatDomainDate(date, locale);
}

export default function OrdersTable({
  orders,
  locale,
  today,
  returnTo,
  baseCurrencyCode,
  expandedIds,
  onToggle,
}: OrdersTableProps) {
  const t = useTranslations("orderListing");

  return (
    <div
      className="hidden overflow-hidden rounded-[var(--radius-2xl)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)] lg:block"
      role="table"
      aria-label={t("hero.title")}
    >
      {/* Headers — JetBrains Mono uppercase per demo HTML .orders-table-head */}
      <div
        role="row"
        className={cn(
          "grid items-center gap-3 px-4 py-2.5 [background:color-mix(in_oklab,var(--text-primary)_3%,var(--surface-elevated))] [border-bottom:1px_solid_var(--border)]",
          GRID_COLS,
        )}
      >
        <span aria-hidden />
        <span className={HEADER_CELL_CLASS}>{t("table.headerOrder")}</span>
        <span className={cn(HEADER_CELL_CLASS, "text-center")}>{t("table.headerProducts")}</span>
        <span className={cn(HEADER_CELL_CLASS, "text-center")}>{t("table.headerStatus")}</span>
        <span className={cn(HEADER_CELL_CLASS, "text-right")}>{t("table.headerTotal")}</span>
        <span aria-hidden />
      </div>

      <ul role="rowgroup" className="flex flex-col">
        {orders.map((order) => {
          const overdue = isOrderOverdue(
            {
              expectedDeliveryFrom: order.expectedDeliveryFrom,
              expectedDeliveryTo: order.expectedDeliveryTo,
              status: order.status,
            },
            today,
          );
          const overdueDays = overdue ? describeOverdueDays(resolveOrderArrivalDueDate(order), today) : 0;
          const arrivalWindow = formatArrivalWindow(order.expectedDeliveryFrom, order.expectedDeliveryTo, locale);
          const chip = describeOrderListChip({
            status: order.status,
            paymentPercentage: order.paymentPercentage,
            hasUnpaidBalance: order.hasUnpaidBalance,
            isOverdue: overdue,
            overdueDays,
          });
          const ChipIcon = chip.icon;
          const isCompletedOrCancelled = order.status === "COMPLETED" || order.status === "CANCELLED";
          const isExpanded = expandedIds.has(order.id);
          const detailHref = `/${locale}${ROUTES.orders}/${order.id}?returnTo=${encodeURIComponent(returnTo)}`;
          const storeTombstone = resolveStoreTombstone(order.store);

          return (
            <li
              key={order.id}
              role="row"
              className={cn(
                "relative grid items-center gap-3 px-4 py-3",
                GRID_COLS,
                "[border-top:1px_solid_var(--border)]",
                "transition-[background-color] [transition-duration:var(--motion-fast)]",
                "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
                isCompletedOrCancelled && "opacity-[0.75]",
              )}
              style={{ viewTransitionName: `order-${order.id}` }}
            >
              <ViewTransitionLink
                href={detailHref}
                viewTransitionEntity="order"
                aria-label={`${order.store.name} · ${formatDate(order.orderDate, locale)}`}
                className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
              />

              {/* Avatar — center-aligned to the row, not the top */}
              {order.store.logoUrl ? (
                <StoreAvatar
                  store={{ name: order.store.name, logo: { src: order.store.logoUrl, aspect: "square" } }}
                  size={32}
                  className="pointer-events-none"
                />
              ) : (
                <StoreAvatar store={{ name: order.store.name }} size={32} className="pointer-events-none" />
              )}

              <div className="pointer-events-none relative min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="min-w-0 truncate [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                    {order.store.name}
                  </p>
                  {storeTombstone.isRemoved && <StoreTombstoneNotice tone={storeTombstone.tone} variant="compact" />}
                </div>
                {/*
                  One line where the cell is wide enough, stacked where it is not. Joining the two
                  dates everywhere is what the earlier attempt got wrong: this cell truncates, and
                  `truncate` cuts from the right, so a cell too narrow silently eats the arrival —
                  the value being added. Stacking everywhere is safe but spends a row of vertical
                  space on every order for a line that is often short. The switch is at the width
                  where the longest real string stops fitting, measured rather than guessed; below
                  it each date gets the full cell width on its own line.
                */}
                <div className="flex min-w-0 flex-col [@media(min-width:1360px)]:flex-row [@media(min-width:1360px)]:items-baseline [@media(min-width:1360px)]:gap-1.5">
                  <p className="truncate [font-family:var(--font-mono)] [font-size:12px] [color:var(--text-muted)] tabular-nums">
                    {formatDate(order.orderDate, locale)}
                  </p>
                  {!isCompletedOrCancelled && arrivalWindow && (
                    <>
                      <span aria-hidden className="hidden [color:var(--text-muted)] [@media(min-width:1360px)]:inline">
                        ·
                      </span>
                      <p
                        className={cn(
                          "truncate [font-size:12px] tabular-nums",
                          overdue ? "[color:var(--warning)]" : "[color:var(--text-secondary)]",
                        )}
                      >
                        {overdue
                          ? t("table.arrivalExpected", { window: arrivalWindow })
                          : t("table.arrivalArrives", { window: arrivalWindow })}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* "N productos" / "1 producto" per spec §5.5 / demo `col-product` */}
              <p className="pointer-events-none relative text-center [font-size:13px] [color:var(--text-secondary)] tabular-nums">
                <span className="[font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">
                  {order.itemCount}
                </span>{" "}
                {t("card.itemsSuffix", { count: order.itemCount })}
              </p>

              {/* Status chip — left-aligned (demo `col-status` no centering) */}
              <div className="pointer-events-none relative flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] [font-weight:var(--font-weight-medium)] whitespace-nowrap [border:1px_solid]",
                    getOrderListChipToneClassName(chip.toneKey),
                  )}
                >
                  <ChipIcon width={12} height={12} aria-hidden="true" />
                  {t(chip.labelKey, chip.labelVars)}
                </span>
              </div>

              <p className="pointer-events-none relative text-right [font-size:var(--text-body)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)] tabular-nums">
                {formatAmountWithSymbol(order.totalCost, order.currencyCode, locale)}
              </p>

              {/* Chevron — center-aligned to the row */}
              <button
                type="button"
                onClick={() => onToggle(order.id)}
                aria-expanded={isExpanded}
                aria-controls={`order-row-items-${order.id}`}
                aria-label={isExpanded ? t("card.collapse") : t("card.expand")}
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

              {/* Expanded items — mirrors demo .item-row: icon | name+state | qty | price */}
              {isExpanded && (
                <div
                  id={`order-row-items-${order.id}`}
                  className={cn(
                    // Recessed "drawer" so the expanded detail reads as this order's interior,
                    // not another row: bleeds to the row edges, tinted surface + accent-cool rail,
                    // ending before the next order's clean row divider.
                    "relative col-span-6 -mx-4 mt-3 -mb-3 flex flex-col gap-1.5 py-3 pr-4 pl-[calc(1rem-2px)]",
                    "[border-left:2px_solid_color-mix(in_oklch,var(--accent-cool)_55%,transparent)]",
                    "[background:color-mix(in_oklch,var(--text-primary)_3.5%,transparent)]",
                  )}
                >
                  {/* Width cap brings qty + price closer to the name on wide tables. Demo uses
                       a narrower viewport implicitly; mirroring that here avoids the orphaned
                       right edge when the row stretches to the full content rail. */}
                  <ul role="list" className="flex max-w-[720px] flex-col">
                    {order.items.map((item, idx) => {
                      const ItemIcon = getStoreProductTypeIcon(item.productTypeKey ?? "");
                      const isLast = idx === order.items.length - 1;
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "grid [grid-template-columns:32px_minmax(0,1fr)_50px_100px] items-center gap-3 py-2",
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
                            <span className="min-w-0 truncate [font-size:var(--text-body)] [color:var(--text-primary)]">
                              {item.name}
                            </span>
                            <OrderItemStateChip
                              orderId={order.id}
                              itemId={item.id}
                              initialState={item.deliveryState}
                              lockedByCancellation={order.status === "CANCELLED"}
                            />
                          </div>
                          <span className="text-right [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
                            {t("card.itemQuantity", { quantity: item.quantity })}
                          </span>
                          <span className="text-right [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
                            {item.unitPrice != null
                              ? formatAmountWithSymbol(item.unitPrice, order.currencyCode, locale)
                              : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <OrderListRowActions
                    order={order}
                    baseCurrencyCode={baseCurrencyCode}
                    locale={locale}
                    detailHref={detailHref}
                    surface="table"
                    onCollapse={() => onToggle(order.id)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
