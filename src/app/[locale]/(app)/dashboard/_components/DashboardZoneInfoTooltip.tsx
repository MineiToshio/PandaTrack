"use client";

import { Info } from "lucide-react";
import Tooltip from "@/components/core/Tooltip";

export type DashboardZoneInfoTooltipProps = {
  /** Accessible name for the trigger, read before the tooltip content (e.g. "How this is measured"). */
  label: string;
  /** Explanation shown on hover/focus. */
  content: string;
};

/** Info-icon trigger for a dashboard zone card header's trailing slot; reveals methodology copy on hover/focus. */
export default function DashboardZoneInfoTooltip({ label, content }: DashboardZoneInfoTooltipProps) {
  return (
    <Tooltip triggerClassName="-m-0.5 rounded p-0.5" content={content}>
      <span className="inline-flex items-center">
        <span className="sr-only">{label}</span>
        <Info size={15} aria-hidden="true" className="shrink-0 [color:var(--text-muted)]" />
      </span>
    </Tooltip>
  );
}
