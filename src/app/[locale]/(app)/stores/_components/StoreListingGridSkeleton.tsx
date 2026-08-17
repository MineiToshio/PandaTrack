import { cn } from "@/lib/styles";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

/** Matches `DEFAULT_PUBLIC_STORE_PAGE_SIZE`, which is `DEFAULT_PAGE_SIZE`. */
const SKELETON_COUNT = DEFAULT_PAGE_SIZE;

// Canonical skeleton atom (ADR 0013): `.skeleton` shimmer from globals.css, static under
// `prefers-reduced-motion`. Replaces the prior `animate-pulse` + `--border` fill (no motion-safe guard).
function SkeletonPill({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-full", className)} />;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-[var(--radius-sm)]", className)} />;
}

function StoreCardSkeleton() {
  return (
    <div
      className={cn(
        "flex h-[279px] flex-col gap-3 overflow-hidden rounded-[var(--radius-xl)] p-[18px]",
        // Mirrors `StoreCard`: leaf card on the canvas, so it takes the raised fill.
        "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
      )}
    >
      {/* Header: avatar + name/location */}
      <div className="flex items-start gap-3">
        <SkeletonBlock className="size-14 flex-shrink-0 rounded-[var(--radius-lg)]" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <SkeletonBlock className="h-[14px] w-3/4" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
      </div>

      {/* Product-type chips */}
      <div className="flex gap-1.5">
        <SkeletonPill className="h-[22px] w-20" />
        <SkeletonPill className="h-[22px] w-16" />
        <SkeletonPill className="h-[22px] w-12" />
      </div>

      {/* Import countries — flex-1 fills the variable-height gap */}
      <div className="flex-1 space-y-2 pt-0.5">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-4/5" />
      </div>

      {/* Stats footer */}
      <div className="flex items-center justify-between pt-3 [border-top:1px_solid_var(--border)]">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-[18px] w-7" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
        <SkeletonPill className="h-3.5 w-[72px]" />
      </div>
    </div>
  );
}

export default function StoreListingGridSkeleton({ loadingLabel }: { loadingLabel?: string }) {
  return (
    <ul
      className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3"
      role="list"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <li key={i} aria-hidden="true">
          <StoreCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
