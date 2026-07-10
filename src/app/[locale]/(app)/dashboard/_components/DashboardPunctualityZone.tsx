import { getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";
import type { DashboardData } from "@/lib/data/dashboard/dashboardTypes";
import DashboardDonut from "./DashboardDonut";
import DashboardZoneCard from "./DashboardZoneCard";

export type DashboardPunctualityZoneProps = {
  data: DashboardData;
  locale: string;
};

const PUNCTUALITY_TITLE_ID = "dashboard-punctuality-title";

/** "Puntualidad de llegadas": share of judged arrivals that landed inside their window. */
export default async function DashboardPunctualityZone({ data, locale }: DashboardPunctualityZoneProps) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const { onTimeCount, lateCount, unknownCount } = data.activity.punctuality;
  const judgedCount = onTimeCount + lateCount;

  const cardProps = {
    titleId: PUNCTUALITY_TITLE_ID,
    eyebrow: t("punctuality.eyebrow"),
    eyebrowIcon: Clock,
    title: t("punctuality.title"),
    tone: "success" as const,
  };

  if (judgedCount === 0) {
    return (
      <DashboardZoneCard {...cardProps}>
        <p className="flex flex-1 items-center [font-size:var(--text-body)] [color:var(--text-muted)]">
          {t("punctuality.empty")}
        </p>
      </DashboardZoneCard>
    );
  }

  const onTimePercent = Math.round((onTimeCount / judgedCount) * 100);
  const latePercent = 100 - onTimePercent;

  return (
    <DashboardZoneCard {...cardProps}>
      <div className="flex flex-1 flex-col items-center gap-3.5">
        <DashboardDonut
          className="w-full max-w-[170px]"
          slices={[
            { key: "onTime", color: "var(--success)", percent: onTimePercent },
            { key: "late", color: "var(--warning)", percent: latePercent },
          ]}
          centerValue={`${onTimePercent}%`}
          centerLabel={t("punctuality.centerLabel")}
          ariaLabel={t("punctuality.aria", { onTime: onTimePercent, late: latePercent })}
        />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 [font-size:12.5px] [color:var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] [background:var(--success)]" />
            {t("punctuality.onTime")}
            <span className="[color:var(--text-primary)] tabular-nums">{onTimePercent}%</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] [background:var(--warning)]" />
            {t("punctuality.late")}
            <span className="[color:var(--text-primary)] tabular-nums">{latePercent}%</span>
          </span>
        </div>

        <p className="text-center [font-size:12px] [line-height:1.5] [color:var(--text-muted)]">
          {t("punctuality.methodNote")}
        </p>

        {unknownCount > 0 && (
          <p className="text-center [font-size:12px] [line-height:1.5] [color:var(--text-muted)]">
            {t("punctuality.unknownNote", { count: unknownCount })}
          </p>
        )}
      </div>
    </DashboardZoneCard>
  );
}
