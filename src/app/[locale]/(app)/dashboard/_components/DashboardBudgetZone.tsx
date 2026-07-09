import { getTranslations } from "next-intl/server";
import { CircleAlert, CircleCheck, Gauge, SlidersHorizontal, Target, TriangleAlert } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Chip, { type ChipVariant } from "@/components/core/Chip";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import type { BudgetStatus, DashboardData } from "@/lib/data/dashboard/dashboardTypes";
import { formatDashboardMoney } from "../_utils/dashboardMoney";
import DashboardBudgetMeter from "./DashboardBudgetMeter";
import DashboardZoneCard from "./DashboardZoneCard";
import DashboardZoneView from "./DashboardZoneView";

export type DashboardBudgetZoneProps = {
  data: DashboardData;
  locale: string;
};

const BUDGET_TITLE_ID = "dashboard-budget-title";

/** Each band pairs its color with an icon, so the state never rests on color alone. */
const STATUS_CHIP: Record<BudgetStatus, { variant: ChipVariant; icon: typeof CircleCheck }> = {
  under: { variant: "success", icon: CircleCheck },
  warning: { variant: "warning", icon: CircleAlert },
  over: { variant: "destructive", icon: TriangleAlert },
};

/** Budget consumption for the current cycle, versus the configured monthly budget (WO-03). */
export default async function DashboardBudgetZone({ data, locale }: DashboardBudgetZoneProps) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const { budget, baseCurrencyCode, collection } = data;
  const money = (minor: number): string => formatDashboardMoney(minor, baseCurrencyCode, locale);

  const cardBase = {
    titleId: BUDGET_TITLE_ID,
    eyebrow: t("budget.eyebrow"),
    eyebrowIcon: Gauge,
    tone: "cool" as const,
  };

  // No budget configured: show a configure affordance instead of a meaningless percentage (FR-06-06).
  if (!budget.isConfigured || budget.budgetAmountMinor === null) {
    const body = collection.totalOrders === 0 ? t("budget.firstRunBody") : t("budget.notConfiguredBody");
    return (
      <>
        <DashboardZoneView event={POSTHOG_EVENTS.DASHBOARD.BUDGET_ZONE_VIEWED} props={{ state: "not_configured" }} />
        <DashboardZoneCard {...cardBase} title={t("budget.titleUnset")}>
          <div className="flex flex-1 flex-col items-start gap-2.5 py-1.5">
            <span
              aria-hidden
              className="grid size-12 place-items-center rounded-[14px] [color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_12%,transparent)]"
            >
              <Target className="size-6" />
            </span>
            <p className="[font-size:13.5px] [line-height:1.55] [color:var(--text-secondary)]">{body}</p>
            <Button
              as="a"
              href={`/${locale}${ROUTES.settings}`}
              variant="primary"
              size="md"
              leadingIcon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
              data-ph-event={POSTHOG_EVENTS.DASHBOARD.CONFIGURE_BUDGET_CTA_CLICKED}
            >
              {t("budget.configureCta")}
            </Button>
          </div>
        </DashboardZoneCard>
      </>
    );
  }

  const budgetAmountMinor = budget.budgetAmountMinor;
  const percent = budget.percentage ?? 0;
  const status = budget.status ?? "under";
  const isOver = status === "over";
  const chip = STATUS_CHIP[status];
  const ChipIcon = chip.icon;
  const chipLabel =
    status === "over"
      ? t("budget.chipOver", { percent })
      : status === "warning"
        ? t("budget.chipWarning", { percent })
        : t("budget.chipUnder", { percent });

  const remainderMinor = isOver ? budget.consumedMinor - budgetAmountMinor : budgetAmountMinor - budget.consumedMinor;
  const remainderLabel = isOver
    ? t("budget.overAmount", { amount: money(remainderMinor) })
    : t("budget.remaining", { amount: money(remainderMinor) });

  // Name the configured reset day, not the current cycle's clamped start day: a collector who set
  // day 31 should read "day 31" even in a cycle that started on the 30th of a short month.
  const cycleHelper =
    budget.resetDayOfMonth === null
      ? t("budget.cycleHelperLastDay")
      : t("budget.cycleHelper", { day: budget.resetDayOfMonth });

  return (
    <>
      <DashboardZoneView event={POSTHOG_EVENTS.DASHBOARD.BUDGET_ZONE_VIEWED} props={{ state: status }} />
      <DashboardZoneCard {...cardBase} title={t("budget.title")}>
        <div className="flex flex-1 flex-col">
          <p className="[font-size:clamp(28px,4.4vw,38px)] [line-height:1] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.03em] [color:var(--text-primary)] tabular-nums">
            {money(budget.consumedMinor)}{" "}
            <span className="[font-size:18px] [font-weight:var(--font-weight-semibold)] [color:var(--text-muted)]">
              / {money(budgetAmountMinor)}
            </span>
          </p>
          <p className="mt-1.5 [font-size:var(--text-body)] [color:var(--text-secondary)]">{cycleHelper}</p>

          <div className="mt-4">
            <DashboardBudgetMeter
              status={status}
              percent={percent}
              ariaLabel={isOver ? t("budget.meterAriaOver", { percent }) : t("budget.meterAriaOk", { percent })}
            />
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 [font-size:13px] [color:var(--text-secondary)]">
              <Chip variant={chip.variant} size="sm" icon={<ChipIcon width={12} height={12} aria-hidden="true" />}>
                {chipLabel}
              </Chip>
              <span className="tabular-nums" style={isOver ? { color: "var(--destructive)" } : undefined}>
                {remainderLabel}
              </span>
            </div>
          </div>

          {isOver && (
            <p className="mt-3.5 [font-size:12px] [line-height:1.5] [color:var(--text-muted)]">
              {t("budget.overHatchCaption")}
            </p>
          )}

          {budget.consumedIsPartial && (
            <p className="mt-2.5 [font-size:12px] [line-height:1.5] [color:var(--text-muted)]">
              {t("budget.partialNote")}
            </p>
          )}
        </div>
      </DashboardZoneCard>
    </>
  );
}
