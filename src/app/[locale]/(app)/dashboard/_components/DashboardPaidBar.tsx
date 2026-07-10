/** Blended token for the "pending" segment, matching the prototype's warning-into-text mix. */
const PENDING_FILL = "color-mix(in oklch, var(--warning) 82%, var(--text-primary))";

export type DashboardPaidBarProps = {
  paidPercent: number;
  pendingPercent: number;
  paidLegend: string;
  pendingLegend: string;
  /** Full sentence describing the split, for screen readers. */
  ariaLabel: string;
};

/** Segmented bar splitting committed value into paid and pending / live debt. */
export default function DashboardPaidBar({
  paidPercent,
  pendingPercent,
  paidLegend,
  pendingLegend,
  ariaLabel,
}: DashboardPaidBarProps) {
  return (
    <div>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-2.5 w-full overflow-hidden rounded-full [background:var(--surface-elevated)]"
      >
        <span className="h-full [background:var(--success)]" style={{ width: `${paidPercent}%` }} />
        <span className="h-full" style={{ width: `${pendingPercent}%`, background: PENDING_FILL }} />
      </div>
      <div className="mt-2 flex flex-col gap-1.5 [font-size:12.5px] [color:var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] [background:var(--success)]" />
          {paidLegend}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: PENDING_FILL }} />
          {pendingLegend}
        </span>
      </div>
    </div>
  );
}
