/**
 * Data-region skeleton for the deliveries list — the table (desktop) / cards (mobile) only.
 * The chrome (title, toolbar, chips) renders instantly at the page level and is NOT part of
 * this skeleton; only the data region suspends. Mirrors the real layout so the shimmer doesn't
 * reflow when `getDeliveriesList` resolves. Consumed by the data `<Suspense>` fallback in `page.tsx`.
 */

type DeliveryListLoadingSkeletonProps = {
  /** Localized table headers, shown dimmed while rows shimmer. */
  headers: {
    delivery: string;
    products: string;
    status: string;
    cost: string;
    arrival: string;
  };
  /** Localized accessible name for the busy region (e.g. "Cargando…"). Announced to AT. */
  loadingLabel?: string;
  desktopRows?: number;
  mobileRows?: number;
};

// Canonical skeleton atom (ADR 0013): shimmer defined by `.skeleton` in globals.css,
// static under `prefers-reduced-motion`. Element-level `borderRadius` styles override the default.
const SKEL = "skeleton rounded-[6px]";

const TABLE_GRID =
  "grid items-center gap-3 [grid-template-columns:40px_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_24px]";

const HEADER_CELL_CLASS =
  "[font-family:var(--font-mono)] [font-size:11px] [letter-spacing:0.06em] uppercase [color:var(--text-muted)]";

export default function DeliveryListLoadingSkeleton({
  headers,
  loadingLabel,
  desktopRows = 6,
  mobileRows = 4,
}: DeliveryListLoadingSkeletonProps) {
  const desktopRowList = Array.from({ length: desktopRows });
  const mobileCardList = Array.from({ length: mobileRows });

  return (
    <div aria-busy="true" aria-label={loadingLabel} className="text-foreground">
      {/* Desktop table skeleton — headers shown at opacity:0.6 */}
      <div
        className="hidden overflow-hidden rounded-[var(--radius-2xl)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)] lg:block"
        role="table"
        aria-hidden
      >
        <div
          role="row"
          className={`${TABLE_GRID} px-4 py-2.5 [opacity:0.6] [background:color-mix(in_oklab,var(--text-primary)_3%,var(--surface-elevated))] [border-bottom:1px_solid_var(--border)]`}
        >
          <span aria-hidden />
          <span className={HEADER_CELL_CLASS}>{headers.delivery}</span>
          <span className={`${HEADER_CELL_CLASS} text-center`}>{headers.products}</span>
          <span className={`${HEADER_CELL_CLASS} text-center`}>{headers.status}</span>
          <span className={`${HEADER_CELL_CLASS} text-center`}>{headers.cost}</span>
          <span className={`${HEADER_CELL_CLASS} text-center`}>{headers.arrival}</span>
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
                style={{ height: 22, width: 110, borderRadius: 999 }}
                aria-hidden
              />
              <span className={`${SKEL} justify-self-end`} style={{ height: 13, width: 64 }} aria-hidden />
              <span className={SKEL} style={{ height: 12, width: 90 }} aria-hidden />
              <span aria-hidden />
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
              <span className={SKEL} style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0 }} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={SKEL} style={{ height: 14, width: "65%" }} aria-hidden />
                <span className={SKEL} style={{ height: 11, width: "80%" }} aria-hidden />
              </div>
            </div>
            <span className={SKEL} style={{ height: 22, width: 130, borderRadius: 999 }} aria-hidden />
            <div className="flex items-center justify-between">
              <span className={SKEL} style={{ height: 11, width: 140 }} aria-hidden />
              <span className={SKEL} style={{ height: 13, width: 70 }} aria-hidden />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
