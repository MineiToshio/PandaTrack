import { getTranslations } from "next-intl/server";
import { Activity, LineChart, TrendingDown, Wallet } from "lucide-react";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { DASHBOARD_RANGE_PRESETS } from "@/lib/data/dashboard/dashboardTypes";
import type { DashboardData, DashboardRangeSelection, MonthKey } from "@/lib/data/dashboard/dashboardTypes";
import { formatDashboardMoney } from "../_utils/dashboardMoney";
import DashboardChartCard from "./DashboardChartCard";
import DashboardLineChart, { type DashboardChartPoint, type DashboardChartSeries } from "./DashboardLineChart";
import DashboardRangeControl from "./DashboardRangeControl";
import DashboardTrendsChartsSurface from "./DashboardTrendsChartsSurface";
import { DashboardTrendsRangeProvider } from "./DashboardTrendsRangeProvider";
import DashboardZoneCard from "./DashboardZoneCard";
import DashboardZoneView from "./DashboardZoneView";
import { TRENDS_GRID_CLASS } from "./dashboardTrendsGrid";

export type DashboardTrendsSectionProps = {
  data: DashboardData;
  locale: string;
  selection: DashboardRangeSelection;
};

const TRENDS_TITLE_ID = "dashboard-trends-title";

/**
 * How many months each trailing preset asks for. A resolved series shorter than this means the
 * window was clamped forward to the collector's first month, which the section then discloses so
 * the preset label never silently promises more history than it shows (`FR-06-25`).
 */
const PRESET_MONTHS: Partial<Record<DashboardRangeSelection["preset"], number>> = {
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

function toChartPoint(month: MonthKey, locale: string): DashboardChartPoint {
  return {
    label: new Date(Date.UTC(month.year, month.month - 1, 1)).toLocaleDateString(locale, {
      month: "short",
      timeZone: "UTC",
    }),
    year: month.year,
  };
}

function formatMonthAndYear(month: MonthKey, locale: string): string {
  return new Date(Date.UTC(month.year, month.month - 1, 1)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Scoped "Gráficos / Tendencias" section. Its header owns the single shared range
 * control, so the range's scope (these charts only) is visually unambiguous.
 *
 * The grid stops at two columns on purpose. A month-bucketed line needs horizontal room, and the
 * page's content column is capped at `max-w-6xl`, so a third column would pin every plot near
 * 300px at any viewport size. See the trends section of `docs/design/interface-patterns.md`.
 */
export default async function DashboardTrendsSection({ data, locale, selection }: DashboardTrendsSectionProps) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const { spend, committedTrend, outstandingTrend, activity, baseCurrencyCode, collection } = data;
  const money = (minor: number): string => formatDashboardMoney(minor, baseCurrencyCode, locale);

  // Dynamic key over a closed union; every preset has a matching key in both locale files.
  const presetLabel = (preset: (typeof DASHBOARD_RANGE_PRESETS)[number]): string =>
    t(`trends.presets.${preset}` as "trends.presets.6m");

  const presets = DASHBOARD_RANGE_PRESETS.map((preset) => ({ value: preset, label: presetLabel(preset) }));
  const activeLabel = selection.preset === "custom" ? t("trends.customLabel") : presetLabel(selection.preset);

  const spendPoints = spend.monthlySeries.map((month) => toChartPoint(month, locale));
  const spendSeries: DashboardChartSeries[] = [
    {
      key: "spend",
      name: t("trends.spend.seriesName"),
      color: "var(--accent)",
      values: spend.monthlySeries.map((month) => month.totalMinor),
      formatted: spend.monthlySeries.map((month) => money(month.totalMinor)),
    },
  ];
  const spendIsEmpty = spend.monthlySeries.every((month) => month.totalMinor === 0);

  const committedPoints = committedTrend.series.map((month) => toChartPoint(month, locale));
  const committedSeries: DashboardChartSeries[] = [
    {
      key: "committed",
      name: t("trends.committed.seriesName"),
      color: "var(--accent-cool)",
      values: committedTrend.series.map((month) => month.totalMinor),
      formatted: committedTrend.series.map((month) => money(month.totalMinor)),
    },
  ];
  const committedIsEmpty = committedTrend.series.every((month) => month.totalMinor === 0);
  const committedTotalMinor = committedTrend.series.reduce((sum, month) => sum + month.totalMinor, 0);

  const debtPoints = outstandingTrend.series.map((month) => toChartPoint(month, locale));
  const debtSeries: DashboardChartSeries[] = [
    {
      key: "debt",
      name: t("trends.debt.seriesName"),
      color: "var(--warning)",
      values: outstandingTrend.series.map((month) => month.totalMinor),
      formatted: outstandingTrend.series.map((month) => money(month.totalMinor)),
    },
  ];
  const debtIsEmpty = outstandingTrend.series.every((month) => month.totalMinor === 0);

  const activityPoints = activity.placedVsArrived.map((month) => toChartPoint(month, locale));
  const formatCount = (count: number): string => count.toLocaleString(locale);
  const activitySeries: DashboardChartSeries[] = [
    {
      key: "placed",
      name: t("trends.activity.placedName"),
      color: "var(--accent)",
      values: activity.placedVsArrived.map((month) => month.placedCount),
      formatted: activity.placedVsArrived.map((month) => formatCount(month.placedCount)),
    },
    {
      key: "arrived",
      name: t("trends.activity.arrivedName"),
      color: "var(--accent-cool)",
      values: activity.placedVsArrived.map((month) => month.arrivedCount),
      formatted: activity.placedVsArrived.map((month) => formatCount(month.arrivedCount)),
    },
  ];
  const activityIsEmpty = activity.placedVsArrived.every(
    (month) => month.placedCount === 0 && month.arrivedCount === 0,
  );

  // The window was trimmed to the collector's first month, so the preset label promises more
  // history than exists. Say so rather than let "Últimos 12 meses" sit above six months of data.
  const requestedMonths = selection.preset === "custom" ? undefined : PRESET_MONTHS[selection.preset];
  const firstMonth = spend.monthlySeries[0];
  const clampNote =
    requestedMonths && firstMonth && spend.monthlySeries.length < requestedMonths
      ? t("trends.clampedNote", { month: formatMonthAndYear(firstMonth, locale) })
      : null;

  const activityLegend = (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 [font-size:12px] [color:var(--text-secondary)]">
      {activitySeries.map((entry) => (
        <span key={entry.key} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: entry.color }} />
          {entry.name}
        </span>
      ))}
    </div>
  );

  return (
    <DashboardTrendsRangeProvider>
      <DashboardZoneView event={POSTHOG_EVENTS.DASHBOARD.SPEND_ZONE_VIEWED} props={{ preset: selection.preset }} />
      <DashboardZoneCard
        titleId={TRENDS_TITLE_ID}
        eyebrow={t("trends.eyebrow")}
        eyebrowIcon={LineChart}
        title={t("trends.title")}
        description={t("trends.scopeNote")}
        tone="warm"
        trailing={
          <DashboardRangeControl
            presets={presets}
            activeLabel={activeLabel}
            customFrom={selection.preset === "custom" ? selection.from : null}
            customTo={selection.preset === "custom" ? selection.to : null}
            clearLabel={t("trends.clearRange")}
            locale={locale}
            disabled={collection.totalOrders === 0}
          />
        }
      >
        {clampNote && (
          <p role="status" className="mb-3.5 [font-size:12px] [line-height:1.5] [color:var(--text-muted)]">
            {clampNote}
          </p>
        )}

        <DashboardTrendsChartsSurface loadingLabel={t("trends.loadingLabel")}>
          <div className={TRENDS_GRID_CLASS}>
            <DashboardChartCard
              title={t("trends.spend.title")}
              subtitle={t("trends.spend.subtitle")}
              isEmpty={spendIsEmpty}
              emptyIcon={<LineChart size={28} aria-hidden="true" />}
              emptyTitle={t("trends.emptyTitle")}
              partialNote={spend.monthlySeriesIsPartial ? t("trends.partialNote") : undefined}
              figure={
                <div className="mt-3">
                  <p className="[font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                    {t("trends.spend.currentMonthLabel")}
                  </p>
                  <p className="mt-1 [font-size:22px] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.02em] [color:var(--text-primary)] tabular-nums">
                    {money(spend.currentMonthMinor)}
                  </p>
                </div>
              }
            >
              <DashboardLineChart
                series={spendSeries}
                points={spendPoints}
                ariaLabel={t("trends.spend.chartAria", { count: spendPoints.length })}
                showArea
                showLastValueLabel
              />
            </DashboardChartCard>

            <DashboardChartCard
              title={t("trends.committed.title")}
              subtitle={t("trends.committed.subtitle")}
              isEmpty={committedIsEmpty}
              emptyIcon={<Wallet size={28} aria-hidden="true" />}
              emptyTitle={t("trends.emptyTitle")}
              partialNote={committedTrend.isPartial ? t("trends.partialNote") : undefined}
              figure={
                <div className="mt-3">
                  <p className="[font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                    {t("trends.committed.totalLabel")}
                  </p>
                  <p className="mt-1 [font-size:22px] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.02em] [color:var(--text-primary)] tabular-nums">
                    {money(committedTotalMinor)}
                  </p>
                </div>
              }
            >
              <DashboardLineChart
                series={committedSeries}
                points={committedPoints}
                ariaLabel={t("trends.committed.chartAria", { count: committedPoints.length })}
                showArea
                showLastValueLabel
              />
            </DashboardChartCard>

            <DashboardChartCard
              title={t("trends.debt.title")}
              subtitle={t("trends.debt.subtitle")}
              isEmpty={debtIsEmpty}
              emptyIcon={<TrendingDown size={28} aria-hidden="true" />}
              emptyTitle={t("trends.emptyTitle")}
              partialNote={outstandingTrend.isPartial ? t("trends.partialNote") : undefined}
            >
              <DashboardLineChart
                series={debtSeries}
                points={debtPoints}
                ariaLabel={t("trends.debt.chartAria", { count: debtPoints.length })}
                showArea
                showLastValueLabel
              />
            </DashboardChartCard>

            <DashboardChartCard
              title={t("trends.activity.title")}
              subtitle={t("trends.activity.subtitle")}
              isEmpty={activityIsEmpty}
              emptyIcon={<Activity size={28} aria-hidden="true" />}
              emptyTitle={t("trends.emptyTitle")}
              figure={activityLegend}
            >
              <DashboardLineChart
                series={activitySeries}
                points={activityPoints}
                ariaLabel={t("trends.activity.chartAria", { count: activityPoints.length })}
              />
            </DashboardChartCard>
          </div>
        </DashboardTrendsChartsSurface>
      </DashboardZoneCard>
    </DashboardTrendsRangeProvider>
  );
}
