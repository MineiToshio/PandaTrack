import type { ReactNode } from "react";
import EmptyState from "@/components/modules/EmptyState";

export type DashboardChartCardProps = {
  title: string;
  subtitle: string;
  /** Optional figure rendered under the subtitle (e.g. the disbursed-this-month total). */
  figure?: ReactNode;
  /** Rendered instead of the chart when the series carries no data. */
  isEmpty: boolean;
  emptyIcon: ReactNode;
  emptyTitle: string;
  /** Quiet note shown when the series excludes FX-unreconciled orders. */
  partialNote?: string;
  children: ReactNode;
};

/** Framed card holding one trend chart inside the scoped trends section. */
export default function DashboardChartCard({
  title,
  subtitle,
  figure,
  isEmpty,
  emptyIcon,
  emptyTitle,
  partialNote,
  children,
}: DashboardChartCardProps) {
  return (
    <div className="flex flex-col rounded-[14px] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <div className="mb-3">
        <h3 className="[font-size:14.5px] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {title}
        </h3>
        <p className="mt-0.5 [font-size:12.5px] [color:var(--text-secondary)]">{subtitle}</p>
        {figure}
      </div>

      {isEmpty ? (
        <EmptyState appearance="card" iconTone="accent" icon={emptyIcon} title={emptyTitle} className="flex-1" />
      ) : (
        children
      )}

      {partialNote && (
        <p className="mt-2 [font-size:12px] [line-height:1.5] [color:var(--text-muted)]">{partialNote}</p>
      )}
    </div>
  );
}
