import type { CSSProperties } from "react";
import type { BudgetStatus } from "@/lib/data/dashboard/dashboardTypes";

/** Solid fill token per consumption band. */
const FILL_TOKEN: Record<BudgetStatus, string> = {
  under: "var(--success)",
  warning: "var(--warning)",
  over: "var(--destructive)",
};

/**
 * Diagonal hatch layered over the red fill. This is the non-color cue required by the
 * over-budget state, so the overage stays legible without relying on hue alone (ADR 0006).
 */
const OVER_HATCH_IMAGE =
  "repeating-linear-gradient(45deg, transparent, transparent 6px," +
  " color-mix(in oklch, var(--destructive) 60%, black) 6px," +
  " color-mix(in oklch, var(--destructive) 60%, black) 12px)";

export type DashboardBudgetMeterProps = {
  status: BudgetStatus;
  /** Consumed share of the budget. Values above 100 are clamped so the bar never overflows. */
  percent: number;
  /** Full sentence describing the consumption, for screen readers. */
  ariaLabel: string;
};

/** Budget consumption meter: a rounded track whose fill color encodes the band. */
export default function DashboardBudgetMeter({ status, percent, ariaLabel }: DashboardBudgetMeterProps) {
  const fillWidth = Math.min(100, Math.max(0, percent));
  const fillStyle: CSSProperties = {
    width: `${fillWidth}%`,
    backgroundColor: FILL_TOKEN[status],
    ...(status === "over" ? { backgroundImage: OVER_HATCH_IMAGE } : {}),
  };

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="h-3 w-full overflow-hidden rounded-full [background:color-mix(in_oklab,var(--text-primary)_8%,transparent)]"
    >
      <div className="h-full rounded-full" style={fillStyle} />
    </div>
  );
}
