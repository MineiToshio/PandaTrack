/**
 * Data-region skeleton for the Orders "Por tienda" view — a handful of collapsed-looking store
 * group cards. Consumed by the data `<Suspense>` fallback in `page.tsx` when `view === "store"`.
 */

type StoreGroupedViewLoadingSkeletonProps = {
  loadingLabel?: string;
  groups?: number;
};

const SKEL = "skeleton rounded-[6px]";

export default function StoreGroupedViewLoadingSkeleton({
  loadingLabel,
  groups = 3,
}: StoreGroupedViewLoadingSkeletonProps) {
  const groupList = Array.from({ length: groups });

  return (
    <div aria-busy="true" aria-label={loadingLabel} className="flex flex-col gap-3">
      {groupList.map((_, index) => (
        <div
          key={`store-group-skel-${index}`}
          aria-hidden
          className="flex items-center gap-3 rounded-[var(--radius-2xl)] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)] md:p-5"
        >
          <span className={SKEL} style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0 }} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={SKEL} style={{ height: 14, width: "40%" }} />
            <span className={SKEL} style={{ height: 11, width: "55%" }} />
          </div>
          <span className={SKEL} style={{ height: 32, width: 120, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}
