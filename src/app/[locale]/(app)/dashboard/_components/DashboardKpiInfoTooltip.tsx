"use client";

import { AlertTriangle, Info } from "lucide-react";
import Tooltip from "@/components/core/Tooltip";

export type DashboardKpiInfoTooltipProps = {
  /** Accessible name for the trigger, read before the tooltip content. */
  label: string;
  /** Explanation shown on hover/focus (what the figure means; and, when partial, why it excludes orders). */
  note: string;
  /** When true the figure excludes some orders, so the trigger shows a warning icon instead of info. */
  partial?: boolean;
};

/** Hover/focus affordance on a KPI tile explaining what its figure means (warning-toned when partial). */
export default function DashboardKpiInfoTooltip({ label, note, partial = false }: DashboardKpiInfoTooltipProps) {
  const Icon = partial ? AlertTriangle : Info;
  return (
    <Tooltip side="top" alignSelfInFlexRow="center" triggerClassName="-m-0.5 rounded p-0.5" content={note}>
      <span className="inline-flex items-center">
        <span className="sr-only">{label}</span>
        <Icon
          size={11}
          aria-hidden="true"
          className={partial ? "shrink-0 [color:var(--warning)]" : "shrink-0 [color:var(--text-muted)]"}
        />
      </span>
    </Tooltip>
  );
}
