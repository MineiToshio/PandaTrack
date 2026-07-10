import type { ReactNode } from "react";
import StoreAvatar from "@/components/core/StoreAvatar";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";

export type DashboardActivityRowProps = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  href: string;
  ariaLabel: string;
  /** Which list the row belongs to, sent with the click event. */
  listKey: string;
  /** Right-hand content: an amount + date, or a status chip. */
  meta: ReactNode;
};

/** One order row in the activity zone. The whole row is a single link into the order. */
export default function DashboardActivityRow({
  orderId,
  humanReadableId,
  storeName,
  href,
  ariaLabel,
  listKey,
  meta,
}: DashboardActivityRowProps) {
  return (
    <li className="[&:not(:first-child)]:[border-top:1px_solid_var(--border)]">
      <ViewTransitionLink
        href={href}
        viewTransitionEntity="order"
        aria-label={ariaLabel}
        style={{ viewTransitionName: `order-${orderId}` }}
        data-ph-event={POSTHOG_EVENTS.DASHBOARD.ACTIVITY_ITEM_CTA_CLICKED}
        data-ph-props={JSON.stringify({ list: listKey })}
        className={cn(
          "flex items-center gap-3 rounded-[var(--radius-md)] px-1 py-2.5 transition-colors",
          "hover:[background:color-mix(in_oklab,var(--text-primary)_4%,transparent)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
        )}
      >
        <StoreAvatar store={{ name: storeName }} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate [font-size:13.5px] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {storeName}
          </p>
          <p className="truncate [font-family:var(--font-mono)] [font-size:11.5px] [color:var(--text-muted)]">
            {humanReadableId}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right [font-size:12px] [color:var(--text-secondary)]">
          {meta}
        </div>
      </ViewTransitionLink>
    </li>
  );
}
