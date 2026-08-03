"use client";

import type { ReactNode } from "react";
import Skeleton from "@/components/core/Skeleton";
import { TRENDS_GRID_CLASS } from "./dashboardTrendsGrid";
import { useTrendsRangeTransition } from "./DashboardTrendsRangeProvider";

export type DashboardTrendsChartsSurfaceProps = {
  /** Announced while a newly picked range resolves on the server. */
  loadingLabel: string;
  /** The server-rendered chart grid, shown whenever no range change is in flight. */
  children: ReactNode;
};

/** One chart card placeholder, matching the real card's chrome so the swap does not jump. */
function ChartCardSkeleton() {
  return (
    <div className="flex flex-col rounded-[14px] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <Skeleton variant="text" width="45%" height={15} />
      <Skeleton variant="text" className="mt-1.5" width="72%" height={13} />
      <Skeleton variant="rect" className="mt-4" height={220} />
    </div>
  );
}

/**
 * Swaps the trend charts for skeletons while a range change is resolving on the server.
 *
 * Without this the charts simply sit there: React holds the previous render for the length of a
 * transition, so picking "Últimos 3 meses" looked like nothing had happened until the new series
 * arrived. The placeholder reuses the same grid class and card chrome as the real charts, so the
 * only thing that changes on arrival is the content, not the layout.
 */
export default function DashboardTrendsChartsSurface({ loadingLabel, children }: DashboardTrendsChartsSurfaceProps) {
  const { isPending } = useTrendsRangeTransition();

  if (!isPending) {
    return <>{children}</>;
  }

  return (
    <div className={TRENDS_GRID_CLASS} aria-busy="true" aria-live="polite" aria-label={loadingLabel}>
      {Array.from({ length: 4 }, (_, index) => (
        <ChartCardSkeleton key={index} />
      ))}
    </div>
  );
}
