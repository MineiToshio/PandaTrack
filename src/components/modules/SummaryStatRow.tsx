import type { ReactNode } from "react";

export type SummaryStatRowProps = {
  /** Muted label (e.g. "Pedidos activos", "Última visita"). */
  label: string;
  /** Bold tabular-nums value rendered to the right. Strings or rich nodes. */
  value: ReactNode;
};

/**
 * Label/value row for sidebar summary blocks (detail asides, dashboards, mini-cards).
 * Visual contract aligned with `_notes/demo-screens.html § .summary-row` — dashed
 * separator between rows handled by `border-bottom` so list containers don't draw it.
 *
 * Use inside any vertical "Resumen" block where rows are read as a glanceable list
 * of named numbers/values.
 */
export default function SummaryStatRow({ label, value }: SummaryStatRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 [border-bottom:1px_dashed_var(--border)] last:[border-bottom:0]">
      <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{label}</span>
      <span className="[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)] [font-variant-numeric:tabular-nums]">
        {value}
      </span>
    </div>
  );
}
