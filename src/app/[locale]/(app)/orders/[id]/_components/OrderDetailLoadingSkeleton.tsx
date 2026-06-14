import Skeleton from "@/components/core/Skeleton";

/**
 * Detail skeleton for the order detail route (`#s10-detail-loading`). Mirrors the real
 * `OrderDetailContent` layout — back-link, 2-column grid (hero + items in the main column,
 * payments/actions in the aside) — so the shimmer doesn't reflow when the server payload
 * arrives. Consumed by `loading.tsx`. Decorative: container owns `aria-busy` + label.
 */
const CARD_CLASS =
  "rounded-[var(--radius-2xl)] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]";

export default function OrderDetailLoadingSkeleton({ label }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="text-foreground">
      {/* Back-link placeholder */}
      <Skeleton variant="text" width={88} height={13} className="mb-2" />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        {/* Main column */}
        <div className="space-y-4">
          {/* Hero card */}
          <div className={`${CARD_CLASS} flex flex-col gap-4`}>
            <div className="flex items-center gap-3.5">
              <Skeleton variant="circle" width={52} height={52} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton variant="text" width="48%" height={18} />
                <Skeleton variant="text" width="32%" height={12} />
              </div>
              <Skeleton variant="pill" width={108} height={26} />
            </div>
            <Skeleton variant="rect" width="100%" height={1} />
            <div className="flex gap-4">
              <Skeleton variant="rect" height={48} className="flex-1" />
              <Skeleton variant="rect" height={48} className="flex-1" />
              <Skeleton variant="rect" height={48} className="flex-1" />
            </div>
          </div>

          {/* Items subcard */}
          <div className={`${CARD_CLASS} flex flex-col gap-3.5`}>
            <Skeleton variant="text" width={120} height={14} />
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton variant="rect" width={28} height={28} className="rounded-lg" />
                <Skeleton variant="text" height={13} className="max-w-[55%] flex-1" />
                <Skeleton variant="text" width={70} height={13} />
              </div>
            ))}
          </div>
        </div>

        {/* Aside column (desktop) */}
        <div className="mt-5 space-y-3.5 lg:mt-0">
          <div className={`${CARD_CLASS} flex flex-col gap-3`}>
            <Skeleton variant="text" width={64} height={12} />
            <Skeleton variant="rect" width="100%" height={8} className="rounded-full" />
            <div className="flex items-center justify-between gap-3">
              <Skeleton variant="text" width={80} height={12} />
              <Skeleton variant="text" width={56} height={12} />
            </div>
          </div>
          <div className={`${CARD_CLASS} flex flex-col gap-3`}>
            <Skeleton variant="text" width={80} height={12} />
            <Skeleton variant="rect" width="100%" height={36} className="rounded-lg" />
            <Skeleton variant="rect" width="100%" height={36} className="rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
