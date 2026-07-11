"use client";

import { AlertTriangle } from "lucide-react";
import Tooltip from "@/components/core/Tooltip";

export type DashboardKpiPartialTooltipProps = {
  /** Accessible name for the trigger, read before the tooltip content (e.g. "Partial figure"). */
  label: string;
  /** Explanation shown on hover/focus (e.g. why the figure excludes some orders). */
  note: string;
};

/** Hover/focus affordance on a KPI tile's warning icon explaining why its figure is partial. */
export default function DashboardKpiPartialTooltip({ label, note }: DashboardKpiPartialTooltipProps) {
  return (
    <Tooltip side="top" alignSelfInFlexRow="center" triggerClassName="-m-0.5 rounded p-0.5" content={note}>
      <span className="inline-flex items-center">
        <span className="sr-only">{label}</span>
        <AlertTriangle size={11} aria-hidden="true" className="shrink-0 [color:var(--warning)]" />
      </span>
    </Tooltip>
  );
}
