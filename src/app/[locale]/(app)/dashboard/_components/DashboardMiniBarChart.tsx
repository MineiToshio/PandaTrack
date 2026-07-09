import { cn } from "@/lib/styles";

export type DashboardMiniBarChartMonth = {
  /** Short month label, e.g. "jul". */
  label: string;
  /** Value driving the bar height (base-currency minor units). */
  value: number;
  /** Pre-formatted value shown under the bar. */
  formatted: string;
};

export type DashboardMiniBarChartProps = {
  months: DashboardMiniBarChartMonth[];
  /** Full sentence describing every value, for screen readers. */
  ariaLabel: string;
  /** Shown when there is nothing to plot. */
  emptyLabel: string;
};

/** Minimum bar height (%) so a non-zero month stays visible next to the tallest one. */
const MIN_VISIBLE_BAR_PERCENT = 4;

/** Framed mini bar chart for the forward obligations breakdown (FR-06-03). */
export default function DashboardMiniBarChart({ months, ariaLabel, emptyLabel }: DashboardMiniBarChartProps) {
  const maxValue = months.reduce((max, month) => Math.max(max, month.value), 0);

  if (maxValue <= 0) {
    return <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{emptyLabel}</p>;
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="rounded-[var(--radius-lg)] px-3.5 pt-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
    >
      <div className="grid h-[116px] auto-cols-fr grid-flow-col items-end justify-items-center gap-3.5 px-1.5 pt-1.5 [border-bottom:1.5px_solid_color-mix(in_oklab,var(--text-primary)_15%,transparent)]">
        {months.map((month) => (
          <div
            key={month.label}
            className="w-full max-w-[30px] self-end rounded-t-[6px] [background:var(--accent)]"
            style={{
              height: `${Math.max(MIN_VISIBLE_BAR_PERCENT, Math.round((month.value / maxValue) * 100))}%`,
            }}
          />
        ))}
      </div>
      <div className="grid auto-cols-fr grid-flow-col justify-items-center gap-3.5 pt-2 pb-1">
        {months.map((month) => (
          <div key={month.label} className="flex flex-col items-center gap-0.5">
            <span className="[font-size:11px] [font-weight:var(--font-weight-semibold)] [color:var(--text-secondary)] tabular-nums">
              {month.formatted}
            </span>
            <span className={cn("[font-size:11px] [color:var(--text-muted)] uppercase")}>{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
