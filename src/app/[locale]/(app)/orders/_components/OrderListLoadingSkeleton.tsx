/**
 * Data-region skeleton for the orders list — the 7-column table (desktop) / cards (mobile) +
 * pagination only. The chrome (title, toolbar, chips) renders instantly at the page level and is
 * NOT part of this skeleton; only the data region suspends. Consumed by the data `<Suspense>`
 * fallback in `page.tsx`.
 */

type OrderListLoadingSkeletonProps = {
  /** Localized accessible name for the busy region (e.g. "Cargando…"). Announced to AT. */
  loadingLabel?: string;
  /** Localized column headers — reuse the same `orderListing.table.*` keys as `OrdersTable`. */
  headerOrder: string;
  headerProducts: string;
  headerStatus: string;
  headerTotal: string;
  headerProgress: string;
  /** Number of skeleton rows / cards. Defaults: 6 desktop, 4 mobile (matches the demo). */
  desktopRows?: number;
  mobileRows?: number;
};

// Canonical skeleton atom (ADR 0013): shimmer defined by `.skeleton` in globals.css,
// static under `prefers-reduced-motion`. Element-level `borderRadius` styles override the default.
const SKEL = "skeleton rounded-[6px]";

const TABLE_GRID =
  "grid items-center gap-3 [grid-template-columns:40px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_24px]";

const HEADER_CELL =
  "[font-size:var(--text-caption)] [font-weight:var(--font-weight-semibold)] [color:var(--text-secondary)]";

export default function OrderListLoadingSkeleton({
  loadingLabel,
  headerOrder,
  headerProducts,
  headerStatus,
  headerTotal,
  headerProgress,
  desktopRows = 6,
  mobileRows = 4,
}: OrderListLoadingSkeletonProps) {
  const desktopRowList = Array.from({ length: desktopRows });
  const mobileCardList = Array.from({ length: mobileRows });

  return (
    <div aria-busy="true" aria-label={loadingLabel} className="text-foreground">
      <div className="space-y-5">
        {/* Desktop table skeleton — 7-column grid, headers shown at opacity:0.6 */}
        <div
          className="hidden overflow-hidden rounded-[var(--radius-2xl)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)] lg:block"
          role="table"
          aria-hidden
        >
          <div
            role="row"
            className={`${TABLE_GRID} px-4 py-2.5 [opacity:0.6] [background:color-mix(in_oklch,var(--text-primary)_3%,var(--surface-elevated))] [border-bottom:1px_solid_var(--border)]`}
          >
            <span aria-hidden />
            <span className={HEADER_CELL}>{headerOrder}</span>
            <span className={`text-center ${HEADER_CELL}`}>{headerProducts}</span>
            <span className={`text-center ${HEADER_CELL}`}>{headerStatus}</span>
            <span className={`text-right ${HEADER_CELL}`}>{headerTotal}</span>
            <span className={`text-center ${HEADER_CELL}`}>{headerProgress}</span>
            <span aria-hidden />
          </div>
          <ul role="rowgroup" className="m-0 list-none p-0">
            {desktopRowList.map((_, index) => (
              <li
                key={`desk-skel-${index}`}
                role="row"
                className={`${TABLE_GRID} px-4 py-3 [border-top:1px_solid_var(--border)]`}
              >
                <span className={SKEL} style={{ width: 32, height: 32, borderRadius: 999 }} aria-hidden />
                <div className="flex flex-col gap-1.5">
                  <span className={SKEL} style={{ height: 14, width: "70%" }} aria-hidden />
                  <span className={SKEL} style={{ height: 11, width: "55%" }} aria-hidden />
                </div>
                <span className={`${SKEL} justify-self-center`} style={{ height: 11, width: "60%" }} aria-hidden />
                <span
                  className={`${SKEL} justify-self-center`}
                  style={{ height: 22, width: 120, borderRadius: 999 }}
                  aria-hidden
                />
                <span className={`${SKEL} justify-self-end`} style={{ height: 13, width: 70 }} aria-hidden />
                <div className="flex items-center gap-2 justify-self-start">
                  <span className={SKEL} style={{ height: 6, width: 60, borderRadius: 999 }} aria-hidden />
                  <span className={SKEL} style={{ width: 36, height: 11 }} aria-hidden />
                </div>
                <span
                  className={`${SKEL} justify-self-end`}
                  style={{ width: 18, height: 18, borderRadius: 4 }}
                  aria-hidden
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile cards skeleton */}
        <ul role="list" aria-hidden className="flex flex-col gap-3 lg:hidden">
          {mobileCardList.map((_, index) => (
            <li
              key={`mob-skel-${index}`}
              className="flex flex-col gap-3 rounded-[var(--radius-2xl)] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={SKEL}
                  style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0 }}
                  aria-hidden
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className={SKEL} style={{ height: 14, width: "65%" }} aria-hidden />
                  <span className={SKEL} style={{ height: 11, width: "80%" }} aria-hidden />
                </div>
              </div>
              <span className={SKEL} style={{ height: 22, width: 140, borderRadius: 999 }} aria-hidden />
              <span className={SKEL} style={{ height: 6, width: "100%", borderRadius: 999 }} aria-hidden />
              <div className="flex items-center justify-between">
                <span className={SKEL} style={{ height: 11, width: 100 }} aria-hidden />
                <span className={SKEL} style={{ height: 13, width: 80 }} aria-hidden />
              </div>
            </li>
          ))}
        </ul>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between gap-4">
          <span className={SKEL} style={{ width: 160, height: 14 }} aria-hidden />
          <div className="hidden items-center gap-1.5 lg:flex">
            <span className={SKEL} style={{ width: 32, height: 32, borderRadius: 6 }} aria-hidden />
            <span className={SKEL} style={{ width: 32, height: 32, borderRadius: 6 }} aria-hidden />
            <span className={SKEL} style={{ width: 32, height: 32, borderRadius: 6 }} aria-hidden />
          </div>
          <span className={`${SKEL} lg:hidden`} style={{ width: 120, height: 36, borderRadius: 8 }} aria-hidden />
        </div>
      </div>
    </div>
  );
}
