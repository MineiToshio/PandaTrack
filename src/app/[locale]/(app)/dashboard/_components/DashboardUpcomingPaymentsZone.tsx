import { getTranslations } from "next-intl/server";
import { AlarmClock, Calendar, CalendarCheck, CalendarClock } from "lucide-react";
import Chip from "@/components/core/Chip";
import StoreAvatar from "@/components/core/StoreAvatar";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import EmptyState from "@/components/modules/EmptyState";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { formatDomainShortDate } from "@/lib/domainDate";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { DashboardData } from "@/lib/data/dashboard/dashboardTypes";
import DashboardZoneCard from "./DashboardZoneCard";
import DashboardZoneLink from "./DashboardZoneLink";

export type DashboardUpcomingPaymentsZoneProps = {
  data: DashboardData;
  locale: string;
};

const UPCOMING_PAYMENTS_TITLE_ID = "dashboard-upcoming-payments-title";

/** How many rows the zone shows before deferring to the orders list. */
const DASHBOARD_UPCOMING_PAYMENTS_LIMIT = 5;

/** "Próximos pagos": per-order outstanding + due date, sorted by due date. */
export default async function DashboardUpcomingPaymentsZone({ data, locale }: DashboardUpcomingPaymentsZoneProps) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const payments = data.cashObligations.upcomingPayments.slice(0, DASHBOARD_UPCOMING_PAYMENTS_LIMIT);
  const ordersHref = `/${locale}${ROUTES.orders}`;

  const cardProps = {
    titleId: UPCOMING_PAYMENTS_TITLE_ID,
    eyebrow: t("upcomingPayments.eyebrow"),
    eyebrowIcon: AlarmClock,
    title: t("upcomingPayments.title"),
    tone: "warning" as const,
  };

  if (payments.length === 0) {
    return (
      <DashboardZoneCard {...cardProps}>
        <div className="flex flex-1 items-center">
          <EmptyState
            appearance="card"
            iconTone="neutral"
            icon={<CalendarCheck size={28} aria-hidden="true" />}
            title={t("upcomingPayments.empty.title")}
            subtitle={t("upcomingPayments.empty.body")}
            className="w-full"
          />
        </div>
      </DashboardZoneCard>
    );
  }

  return (
    <DashboardZoneCard {...cardProps}>
      <div className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-col">
          {payments.map((payment, index) => {
            const amount =
              payment.baseOutstandingMinor != null && data.baseCurrencyCode
                ? formatAmountSymbolOnly(payment.baseOutstandingMinor, data.baseCurrencyCode, locale)
                : formatAmountSymbolOnly(payment.outstandingMinor, payment.currencyCode, locale);
            const isSoonest = index === 0;
            const chipLabel = isSoonest
              ? t("upcomingPayments.dueSoon")
              : t("upcomingPayments.dueOn", { date: formatDomainShortDate(payment.dueDate, locale) });
            const ChipIcon = isSoonest ? CalendarClock : Calendar;
            const detailHref = `/${locale}${ROUTES.orders}/${payment.orderId}?returnTo=${encodeURIComponent(ROUTES.dashboard)}`;

            return (
              <li key={payment.orderId} className="[&:not(:first-child)]:[border-top:1px_solid_var(--border)]">
                <ViewTransitionLink
                  href={detailHref}
                  viewTransitionEntity="order"
                  aria-label={t("upcomingPayments.rowLabel", {
                    store: payment.storeName,
                    code: payment.humanReadableId,
                    amount,
                  })}
                  style={{ viewTransitionName: `order-${payment.orderId}` }}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-md)] px-1 py-2.5 transition-colors",
                    "hover:[background:color-mix(in_oklab,var(--text-primary)_4%,transparent)]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
                  )}
                >
                  <StoreAvatar store={{ name: payment.storeName }} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate [font-size:13.5px] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                      {payment.storeName}
                    </p>
                    <p className="truncate [font-family:var(--font-mono)] [font-size:11.5px] [color:var(--text-muted)]">
                      {payment.humanReadableId}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                    <span className="[font-size:13.5px] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)] tabular-nums">
                      {amount}
                    </span>
                    <Chip
                      variant={isSoonest ? "warning" : "info"}
                      size="sm"
                      icon={<ChipIcon width={12} height={12} aria-hidden="true" />}
                    >
                      {chipLabel}
                    </Chip>
                  </div>
                </ViewTransitionLink>
              </li>
            );
          })}
        </ul>
        <div className="mt-2.5">
          <DashboardZoneLink href={ordersHref} label={t("upcomingPayments.seeOrders")} />
        </div>
      </div>
    </DashboardZoneCard>
  );
}
