import { getTranslations } from "next-intl/server";
import { TrendingDown } from "lucide-react";
import type { DashboardData } from "@/lib/data/dashboard/dashboardTypes";
import { formatDashboardMoney } from "../_utils/dashboardMoney";
import DashboardZoneCard from "./DashboardZoneCard";

export type DashboardLostOnCancelledZoneProps = {
  data: DashboardData;
  locale: string;
  className?: string;
};

/**
 * Awareness figure for money sunk on cancelled orders (`BR-06-10`): the total of payments
 * deliberately kept on orders the collector cancelled and was never refunded for. This is a rare
 * corner case, so the surface renders only when there is lost money to show — when the figure is 0
 * (no cancelled order retains payments) it renders nothing at all and reserves no dashboard space.
 */
export default async function DashboardLostOnCancelledZone({
  data,
  locale,
  className,
}: DashboardLostOnCancelledZoneProps) {
  const { lostOnCancelled, baseCurrencyCode } = data;

  if (lostOnCancelled.totalMinor <= 0) {
    return null;
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const amount = formatDashboardMoney(lostOnCancelled.totalMinor, baseCurrencyCode, locale);
  const partialNote =
    lostOnCancelled.isPartial && lostOnCancelled.excludedOrderCount > 0
      ? t("lostOnCancelled.partial", { count: lostOnCancelled.excludedOrderCount })
      : null;

  return (
    <DashboardZoneCard
      titleId="dashboard-lost-on-cancelled-title"
      eyebrow={t("lostOnCancelled.eyebrow")}
      eyebrowIcon={TrendingDown}
      title={t("lostOnCancelled.title")}
      description={t("lostOnCancelled.help")}
      tone="destructive"
      className={className}
      trailing={
        <span className="shrink-0 [font-size:24px] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.02em] [color:var(--destructive)] tabular-nums">
          {amount}
        </span>
      }
    >
      {partialNote && <p className="[font-size:12px] [line-height:1.5] [color:var(--text-muted)]">{partialNote}</p>}
    </DashboardZoneCard>
  );
}
