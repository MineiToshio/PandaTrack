import type { ReactNode } from "react";
import StoreAvatar from "@/components/core/StoreAvatar";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";

export type DashboardActivityRowProps = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  storeLogoUrl: string | null;
  href: string;
  ariaLabel: string;
  /** Which list the row belongs to, sent with the click event. */
  listKey: string;
  /** Right-hand content: an amount + date, or a status chip. */
  meta: ReactNode;
  /** Optional trailing control (quick arrival). Rendered above the link overlay so it stays clickable. */
  action?: ReactNode;
};

/**
 * One order row in the activity zone.
 *
 * When the row carries an `action`, the navigation target cannot wrap the whole row any more (a
 * button inside an anchor is invalid and unreachable by keyboard). The row therefore uses the same
 * full-bleed link overlay the order list already relies on: the link covers the row, the passive
 * content is `pointer-events-none`, and the trailing control sits above the overlay.
 */
export default function DashboardActivityRow({
  orderId,
  humanReadableId,
  storeName,
  storeLogoUrl,
  href,
  ariaLabel,
  listKey,
  meta,
  action,
}: DashboardActivityRowProps) {
  return (
    <li className="[&:not(:first-child)]:[border-top:1px_solid_var(--border)]">
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-[var(--radius-md)] px-1 py-2.5 transition-colors",
          "hover:[background:color-mix(in_oklab,var(--text-primary)_4%,transparent)]",
        )}
      >
        <ViewTransitionLink
          href={href}
          viewTransitionEntity="order"
          aria-label={ariaLabel}
          style={{ viewTransitionName: `order-${orderId}` }}
          data-ph-event={POSTHOG_EVENTS.DASHBOARD.ACTIVITY_ITEM_CTA_CLICKED}
          data-ph-props={JSON.stringify({ list: listKey })}
          className={cn(
            "absolute inset-0 rounded-[var(--radius-md)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
          )}
        />
        <div className="pointer-events-none">
          {storeLogoUrl ? (
            <StoreAvatar store={{ name: storeName, logo: { src: storeLogoUrl, aspect: "square" } }} size={32} />
          ) : (
            <StoreAvatar store={{ name: storeName }} size={32} />
          )}
        </div>
        <div className="pointer-events-none min-w-0 flex-1">
          <p className="truncate [font-size:13.5px] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {storeName}
          </p>
          <p className="truncate [font-family:var(--font-mono)] [font-size:11.5px] [color:var(--text-muted)]">
            {humanReadableId}
          </p>
          {/* Narrow + actionable: the store name and the order code are the only way to tell rows
              apart, and a status chip next to a trailing control leaves them ~18px on a 375px
              screen. Below `sm` the chip drops under the code instead of competing for the line.
              Exactly one of the two copies is ever displayed, so neither is announced twice. */}
          {action && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 [font-size:12px] [color:var(--text-secondary)] sm:hidden">
              {meta}
            </div>
          )}
        </div>
        <div
          className={cn(
            "pointer-events-none flex shrink-0 flex-col items-end gap-1 text-right [font-size:12px] [color:var(--text-secondary)]",
            action && "hidden sm:flex",
          )}
        >
          {meta}
        </div>
        {action && <div className="relative shrink-0">{action}</div>}
      </div>
    </li>
  );
}
