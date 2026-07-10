import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AlertCircle, List, PackagePlus, Plus, Truck } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Chip from "@/components/core/Chip";
import EmptyState from "@/components/modules/EmptyState";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { formatDomainShortDate } from "@/lib/domainDate";
import { getTodayStart } from "@/lib/data/dashboard/dashboardPeriods";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import type { DashboardData, OrderSummary } from "@/lib/data/dashboard/dashboardTypes";
import DashboardActivityRow from "./DashboardActivityRow";
import DashboardActivityTabs, { type DashboardActivityTab } from "./DashboardActivityTabs";
import DashboardZoneCard from "./DashboardZoneCard";
import DashboardZoneLink from "./DashboardZoneLink";
import DashboardZoneView from "./DashboardZoneView";

export type DashboardActivityZoneProps = {
  data: DashboardData;
  locale: string;
};

const ACTIVITY_TITLE_ID = "dashboard-activity-title";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days an unfulfilled arrival is past its expected window close. */
function countOverdueDays(order: OrderSummary, todayStart: Date): number {
  const dueDate = order.expectedDeliveryTo ?? order.expectedDeliveryFrom;
  if (!dueDate) {
    return 0;
  }
  return Math.max(0, Math.floor((todayStart.getTime() - dueDate.getTime()) / MILLISECONDS_PER_DAY));
}

/** "Movimiento de pedidos": recent, upcoming arrivals, and overdue arrivals. */
export default async function DashboardActivityZone({ data, locale }: DashboardActivityZoneProps) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const { activity, collection } = data;

  const ordersHref = `/${locale}${ROUTES.orders}`;
  const orderHref = (orderId: string): string =>
    `/${locale}${ROUTES.orders}/${orderId}?returnTo=${encodeURIComponent(ROUTES.dashboard)}`;
  const rowLabel = (order: OrderSummary): string =>
    t("activity.rowLabel", { store: order.storeName, code: order.humanReadableId });

  // The heading promises every figure in the base currency, so an order reads in its own currency
  // only when it cannot be converted — the same fallback the upcoming-payments list applies.
  const rowAmount = (order: OrderSummary): string =>
    order.baseTotalCostMinor !== null && data.baseCurrencyCode
      ? formatAmountSymbolOnly(order.baseTotalCostMinor, data.baseCurrencyCode, locale)
      : formatAmountSymbolOnly(order.totalCostMinor, order.currencyCode, locale);

  const cardProps = {
    titleId: ACTIVITY_TITLE_ID,
    eyebrow: t("activity.eyebrow"),
    eyebrowIcon: List,
    title: t("activity.title"),
    tone: "cool" as const,
  };

  if (collection.totalOrders === 0) {
    return (
      <>
        <DashboardZoneView event={POSTHOG_EVENTS.DASHBOARD.ACTIVITY_ZONE_VIEWED} props={{ state: "empty" }} />
        <DashboardZoneCard {...cardProps}>
          <EmptyState
            appearance="card"
            iconTone="accent"
            icon={<PackagePlus size={28} aria-hidden="true" />}
            title={t("activity.empty.title")}
            subtitle={t("activity.empty.body")}
            className="flex-1"
            actions={
              <Button
                as="a"
                href={`/${locale}${ROUTES.ordersNew}`}
                variant="primary"
                size="md"
                leadingIcon={<Plus className="size-4" aria-hidden="true" />}
                data-ph-event={POSTHOG_EVENTS.DASHBOARD.ACTIVITY_ITEM_CTA_CLICKED}
                data-ph-props={JSON.stringify({ list: "empty" })}
              >
                {t("activity.empty.cta")}
              </Button>
            }
          />
        </DashboardZoneCard>
      </>
    );
  }

  const todayStart = getTodayStart(data.generatedAt, data.timezone);

  const emptyPane = (message: string) => (
    <p className="py-6 text-center [font-size:var(--text-body)] [color:var(--text-muted)]">{message}</p>
  );

  const recentPane =
    activity.recentOrders.length === 0 ? (
      emptyPane(t("activity.emptyRecent"))
    ) : (
      <ul role="list" className="flex flex-col">
        {activity.recentOrders.map((order) => (
          <DashboardActivityRow
            key={order.orderId}
            orderId={order.orderId}
            humanReadableId={order.humanReadableId}
            storeName={order.storeName}
            href={orderHref(order.orderId)}
            ariaLabel={rowLabel(order)}
            listKey="recent"
            meta={
              <>
                <span className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)] tabular-nums">
                  {rowAmount(order)}
                </span>
                <span className="[color:var(--text-muted)]">
                  {formatDomainShortDate(order.orderDate, locale)}
                  {order.isFxPending && ` · ${t("activity.fxPending")}`}
                </span>
              </>
            }
          />
        ))}
      </ul>
    );

  const upcomingPane =
    activity.upcomingArrivals.length === 0 ? (
      emptyPane(t("activity.emptyUpcoming"))
    ) : (
      <ul role="list" className="flex flex-col">
        {activity.upcomingArrivals.map((order) => (
          <DashboardActivityRow
            key={order.orderId}
            orderId={order.orderId}
            humanReadableId={order.humanReadableId}
            storeName={order.storeName}
            href={orderHref(order.orderId)}
            ariaLabel={rowLabel(order)}
            listKey="upcoming"
            meta={
              <Chip variant="info" size="sm" icon={<Truck width={12} height={12} aria-hidden="true" />}>
                {t("activity.arrivesOn", {
                  date: formatDomainShortDate(order.expectedDeliveryFrom!, locale),
                })}
              </Chip>
            }
          />
        ))}
      </ul>
    );

  const overduePane =
    activity.overdueArrivals.length === 0 ? (
      emptyPane(t("activity.emptyOverdue"))
    ) : (
      <ul role="list" className="flex flex-col">
        {activity.overdueArrivals.map((order) => (
          <DashboardActivityRow
            key={order.orderId}
            orderId={order.orderId}
            humanReadableId={order.humanReadableId}
            storeName={order.storeName}
            href={orderHref(order.orderId)}
            ariaLabel={rowLabel(order)}
            listKey="overdue"
            meta={
              <Chip variant="warning" size="sm" icon={<AlertCircle width={12} height={12} aria-hidden="true" />}>
                {t("activity.overdueDays", { days: countOverdueDays(order, todayStart) })}
              </Chip>
            }
          />
        ))}
      </ul>
    );

  const withFooter = (pane: ReactNode, href: string, label: string) => (
    <div className="flex flex-1 flex-col">
      <div className="flex-1">{pane}</div>
      <div className="mt-2.5">
        <DashboardZoneLink href={href} label={label} />
      </div>
    </div>
  );

  const tabs: DashboardActivityTab[] = [
    {
      key: "recent",
      label: t("activity.tabs.recent"),
      panel: withFooter(recentPane, ordersHref, t("activity.seeAllOrders")),
    },
    {
      key: "upcoming",
      label: t("activity.tabs.upcoming"),
      panel: withFooter(upcomingPane, `/${locale}${ROUTES.deliveries}`, t("activity.goToDeliveries")),
    },
    {
      key: "overdue",
      label: t("activity.tabs.overdue"),
      count: activity.overdueArrivals.length,
      panel: withFooter(overduePane, `${ordersHref}?delOverdue=true`, t("activity.reviewOverdue")),
    },
  ];

  return (
    <>
      <DashboardZoneView event={POSTHOG_EVENTS.DASHBOARD.ACTIVITY_ZONE_VIEWED} props={{ state: "populated" }} />
      <DashboardZoneCard {...cardProps}>
        <DashboardActivityTabs tabs={tabs} tablistLabel={t("activity.tablistLabel")} />
      </DashboardZoneCard>
    </>
  );
}
