import type { ReactNode } from "react";

export type SummaryStatRowProps = {
  /** Muted label (e.g. "Pedidos activos", "Última visita"). */
  label: string;
  /** Bold tabular-nums value rendered to the right. Strings or rich nodes. */
  value: ReactNode;
};

/**
 * Label/value row for sidebar summary blocks (detail asides, dashboards, mini-cards).
 * Visual contract aligned with `_notes/demo-screens.html § .summary-row`:
 *   - 13.5px font, same size on label and value (no visual mismatch).
 *   - Label: `--text-secondary`. Value: `font-weight: 500` and tabular nums.
 *   - Solid `border-top` between consecutive rows — first row has no rule above,
 *     and there is never a stray rule under the last row even when followed by
 *     other elements (CTAs, captions) in the same parent container.
 */
export default function SummaryStatRow({ label, value }: SummaryStatRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 [font-size:13.5px] [border-top:1px_solid_var(--border)] [&:first-of-type]:[border-top:0]">
      <span className="[color:var(--text-secondary)]">{label}</span>
      <span className="[font-weight:500] [color:var(--text-primary)] [font-variant-numeric:tabular-nums]">{value}</span>
    </div>
  );
}
