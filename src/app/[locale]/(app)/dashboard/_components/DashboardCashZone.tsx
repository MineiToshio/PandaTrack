import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PiggyBank, Wallet } from "lucide-react";
import EmptyState from "@/components/modules/EmptyState";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { OrderStatus } from "../../../../../../generated/prisma/client";
import type { DashboardData } from "@/lib/data/dashboard/dashboardTypes";
import { formatDashboardMoney } from "../_utils/dashboardMoney";
import DashboardFxPartialNotice from "./DashboardFxPartialNotice";
import DashboardMiniBarChart, { type DashboardMiniBarChartMonth } from "./DashboardMiniBarChart";
import DashboardPaidBar from "./DashboardPaidBar";
import DashboardZoneCard from "./DashboardZoneCard";
import DashboardZoneLink from "./DashboardZoneLink";

export type DashboardCashZoneProps = {
  data: DashboardData;
  locale: string;
};

const CASH_ZONE_TITLE_ID = "dashboard-cash-title";

function formatMonthLabel(year: number, month: number, locale: string): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, { month: "short", timeZone: "UTC" });
}

function toPercent(part: number, whole: number): number {
  if (whole <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

/** Highest-value collector surface: what to have ready this month, ahead, and paid-vs-pending. */
export default async function DashboardCashZone({ data, locale }: DashboardCashZoneProps) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const { cashObligations, paidVsOutstanding, collection, lostOnCancelled, baseCurrencyCode } = data;
  const money = (minor: number): string => formatDashboardMoney(minor, baseCurrencyCode, locale);

  const ordersHref = `/${locale}${ROUTES.orders}`;
  const trailing = (
    <DashboardZoneLink
      href={ordersHref}
      label={t("cash.seeOrders")}
      posthogEvent={POSTHOG_EVENTS.DASHBOARD.OBLIGATION_ORDERS_CTA_CLICKED}
      posthogProps={{ source: "cash_zone_header" }}
    />
  );

  const cardProps = {
    titleId: CASH_ZONE_TITLE_ID,
    eyebrow: t("cash.eyebrow"),
    eyebrowIcon: Wallet,
    title: t("cash.title"),
    tone: "accent" as const,
  };

  if (collection.totalOrders === 0) {
    return (
      <DashboardZoneCard {...cardProps}>
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <p className="mb-2 [font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
              {t("cash.currentMonthLabel")}
            </p>
            <p className="[font-size:clamp(28px,4.4vw,38px)] [line-height:1] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.03em] [color:var(--text-muted)] tabular-nums">
              {money(0)}
            </p>
          </div>
          <EmptyState
            appearance="card"
            iconTone="accent"
            icon={<PiggyBank size={28} aria-hidden="true" />}
            title={t("cash.empty.title")}
            subtitle={t("cash.empty.body")}
          />
        </div>
      </DashboardZoneCard>
    );
  }

  const chartMonths: DashboardMiniBarChartMonth[] = cashObligations.upcomingMonths.map((month) => ({
    label: formatMonthLabel(month.year, month.month, locale),
    value: month.totalMinor,
    formatted: money(month.totalMinor),
  }));
  const chartSummary = chartMonths.map((month) => `${month.label} ${money(month.value)}`).join(", ");

  const committed = paidVsOutstanding.committedMinor;
  const paidPercent = toPercent(paidVsOutstanding.paidMinor, committed);
  const pendingPercent = committed > 0 ? 100 - paidPercent : 0;

  return (
    <DashboardZoneCard {...cardProps} trailing={trailing}>
      <div className="flex flex-1 flex-col gap-[18px]">
        <div>
          <p className="mb-2 [font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
            {t("cash.currentMonthLabel")}
          </p>
          <p className="[font-size:clamp(28px,4.4vw,38px)] [line-height:1] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.03em] [color:var(--text-primary)] tabular-nums">
            {money(cashObligations.currentMonth.totalMinor)}
          </p>
          {cashObligations.overdue.totalMinor > 0 && (
            <p className="mt-2 [font-size:var(--text-body)] [color:var(--text-secondary)]">
              {t("cash.overdueNote", { amount: money(cashObligations.overdue.totalMinor) })}
            </p>
          )}
        </div>

        <div>
          <p className="[font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
            {t("cash.upcomingMonthsLabel")}
          </p>
          <p className="mt-1 mb-3 [font-size:var(--text-body)] [color:var(--text-secondary)]">
            {t("cash.upcomingMonthsHelper")}
          </p>
          <DashboardMiniBarChart
            months={chartMonths}
            ariaLabel={t("cash.upcomingMonthsChartLabel", { summary: chartSummary })}
            emptyLabel={t("cash.upcomingMonthsEmpty")}
          />
        </div>

        <div>
          <p className="mb-2 [font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
            {t("cash.paidVsPendingLabel")}
          </p>
          <p className="mb-2 [font-size:12.5px] [color:var(--text-secondary)]">
            {t("cash.committedLine", { amount: money(committed) })}
          </p>
          <DashboardPaidBar
            paidPercent={paidPercent}
            pendingPercent={pendingPercent}
            paidLegend={t("cash.paidLegend", { amount: money(paidVsOutstanding.paidMinor) })}
            pendingLegend={t("cash.pendingLegend", { amount: money(paidVsOutstanding.outstandingMinor) })}
            ariaLabel={t("cash.paidVsPendingChartLabel", {
              committed: money(committed),
              paid: money(paidVsOutstanding.paidMinor),
              pending: money(paidVsOutstanding.outstandingMinor),
            })}
          />
          {cashObligations.noDateOutstanding.totalMinor > 0 && (
            <p className="mt-2.5 [font-size:var(--text-body)] [color:var(--text-secondary)]">
              {t("cash.noDateNote", { amount: money(cashObligations.noDateOutstanding.totalMinor) })}
            </p>
          )}
          {/*
            Money sunk on cancelled orders (`BR-06-10`). It rides here as a quiet line rather than
            its own zone because the paid figure above is computed from non-cancelled orders only,
            so this is precisely the amount missing from it: the note belongs next to the number it
            corrects. It is also unrecoverable, so it earns no call to action and no standing card
            whose visual weight would stay constant while its relevance decays.
          */}
          {lostOnCancelled.totalMinor > 0 && (
            <p className="mt-2.5 [font-size:var(--text-body)] [color:var(--text-secondary)]">
              {lostOnCancelled.isPartial && lostOnCancelled.excludedOrderCount > 0
                ? t("cash.cancelledNotePartial", {
                    amount: money(lostOnCancelled.totalMinor),
                    count: lostOnCancelled.excludedOrderCount,
                  })
                : t("cash.cancelledNote", { amount: money(lostOnCancelled.totalMinor) })}{" "}
              <Link
                href={`${ordersHref}?status=${OrderStatus.CANCELLED}`}
                className="[font-weight:var(--font-weight-semibold)] whitespace-nowrap [color:var(--accent)] hover:underline"
              >
                {t("cash.cancelledLink")}
              </Link>
            </p>
          )}
        </div>

        {paidVsOutstanding.isPartial && paidVsOutstanding.excludedOrderCount > 0 && (
          <DashboardFxPartialNotice
            message={t("cash.partialWarning", { count: paidVsOutstanding.excludedOrderCount })}
            reconcileLabel={t("cash.reconcileLink")}
            reconcileHref={`/${locale}${ROUTES.orders}?fxPending=true`}
          />
        )}
      </div>
    </DashboardZoneCard>
  );
}
