import Skeleton from "@/components/core/Skeleton";

export type DashboardLoadingSkeletonProps = {
  /** Announced while the dashboard's server work resolves. */
  label: string;
};

/** One zone card placeholder: the eyebrow, title, and a block of content. */
function ZoneCardSkeleton({ contentHeight }: { contentHeight: number }) {
  return (
    <div className="rounded-[var(--radius-xl)] p-[18px] [background:var(--surface)] [border:1px_solid_var(--border)] md:p-[22px]">
      <Skeleton variant="pill" width={140} height={18} />
      <Skeleton variant="text" className="mt-3" width="55%" height={16} />
      <Skeleton variant="rect" className="mt-4" height={contentHeight} />
    </div>
  );
}

/**
 * Route-level loading boundary for the dashboard (ADR 0013). Mirrors the real grid — KPI strip,
 * the 8/4 top row, the trends section, and the bottom pair — so the shimmer does not jump when
 * the server payload arrives.
 */
export default function DashboardLoadingSkeleton({ label }: DashboardLoadingSkeletonProps) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite" aria-label={label}>
      <Skeleton variant="text" width={260} height={30} />

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-12 lg:items-start lg:gap-5">
        <div className="lg:col-span-12">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} variant="rect" height={62} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-8">
          <ZoneCardSkeleton contentHeight={280} />
        </div>
        <div className="flex flex-col gap-[18px] lg:col-span-4">
          <ZoneCardSkeleton contentHeight={120} />
          <ZoneCardSkeleton contentHeight={180} />
        </div>

        <div className="lg:col-span-12">
          <ZoneCardSkeleton contentHeight={240} />
        </div>

        <div className="lg:col-span-6">
          <ZoneCardSkeleton contentHeight={200} />
        </div>
        <div className="lg:col-span-6">
          <ZoneCardSkeleton contentHeight={200} />
        </div>

        <div className="lg:col-span-12">
          <ZoneCardSkeleton contentHeight={220} />
        </div>
      </div>
    </div>
  );
}
