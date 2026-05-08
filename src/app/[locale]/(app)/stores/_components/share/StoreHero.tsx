import { CalendarClock, Clock, Globe, Info, MapPin, PackageCheck, Store as StoreIcon, User } from "lucide-react";
import Chip from "@/components/core/Chip";
import StarRating from "@/components/core/StarRating";
import StoreAvatar from "@/components/core/StoreAvatar";
import type { StoreDetail } from "@/queries/store";
import { cn } from "@/lib/styles";

export type StoreHeroLabels = {
  countryName: (code: string) => string;
  ratingCount: (count: number) => string;
  ratingFallback: string;
  presencePhysical: string;
  presenceOnline: string;
  hasStock: string;
  acceptsPreorders: string;
  /** "Persona" — chip shown on PERSON-type stores after the country line. */
  personChip?: string;
  /** Info note shown under the description on PERSON-type stores explaining why no contacts are public. */
  personNote?: string;
  /** "En revisión" — chip shown when status is PENDING. */
  pendingChip?: string;
};

export type StoreHeroProps = {
  store: StoreDetail;
  labels: StoreHeroLabels;
  className?: string;
};

/**
 * Detail hero card matching `_notes/demo-screens.html` variants:
 *  - `#store-detail` / `#s6-store-detail-published-viewer` — base/owner
 *  - `#s6-store-detail-pending` — info-tinted logo + "En revisión" chip
 *  - `#s6-store-detail-person` — User-icon avatar + "Persona" chip + info note
 *
 * Layout: avatar (s56) + identity column + rating block (right-aligned) → description → chips row.
 */
export default function StoreHero({ store, labels, className }: StoreHeroProps) {
  const isPerson = store.storeType === "PERSON";
  const isPending = store.status === "PENDING";
  const hasPhysical = store.presenceTypes.includes("PHYSICAL");
  const hasOnline = store.presenceTypes.includes("ONLINE");

  const showCommercialChips =
    !isPerson && (hasPhysical || hasOnline || store.hasStock === true || store.receivesOrders === true);

  return (
    <section
      className={cn(
        "rounded-[18px] p-5 md:p-[22px]",
        "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
        "[box-shadow:var(--shadow-2)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {store.logoUrl ? (
          <StoreAvatar store={{ name: store.name, logo: { src: store.logoUrl, aspect: "square" } }} size={56} />
        ) : isPending && !isPerson ? (
          // Pending without logo → info-tinted placeholder (matches `s6-store-detail-pending` hero avatar).
          <span
            className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full [font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--info)] [background:color-mix(in_oklch,var(--info)_18%,var(--surface-elevated))] md:rounded-[var(--radius-lg)]"
            aria-label={store.name}
          >
            {store.name.trim().match(/\p{L}/u)?.[0]?.toUpperCase() ?? ""}
          </span>
        ) : (
          <StoreAvatar store={{ name: store.name }} size={56} isPerson={isPerson} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 [font-size:17px] [font-weight:600] [color:var(--text-primary)]">
            {isPerson && <User size={14} aria-hidden="true" className="flex-shrink-0 [color:var(--text-muted)]" />}
            <span className="min-w-0 truncate">{store.name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5 [font-size:12px] [color:var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden="true" />
              {labels.countryName(store.countryCode)}
            </span>
            {isPending && labels.pendingChip && (
              <Chip variant="info" size="sm" icon={<Clock size={11} aria-hidden="true" />}>
                {labels.pendingChip}
              </Chip>
            )}
            {isPerson && labels.personChip && (
              <Chip variant="neutral" size="sm" icon={<User size={11} aria-hidden="true" />}>
                {labels.personChip}
              </Chip>
            )}
          </div>
        </div>
        <div className="text-right">
          {store.averageRating != null ? (
            <>
              <StarRating value={store.averageRating} size={16} />
              <div className="mt-0.5 [font-size:12px] [color:var(--text-muted)]">
                {store.averageRating.toFixed(1)} · {labels.ratingCount(store.reviewCount)}
              </div>
            </>
          ) : (
            <div className="[font-size:12px] [color:var(--text-muted)]">{labels.ratingFallback}</div>
          )}
        </div>
      </div>

      {store.description && (
        <p className="mt-4 [font-size:14px] [line-height:1.5] [color:var(--text-secondary)]">{store.description}</p>
      )}

      {isPerson && labels.personNote && (
        <div
          className={cn(
            "mt-4 flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2",
            "[font-size:12.5px] [color:var(--text-muted)]",
            "[background:color-mix(in_oklch,var(--text-muted)_7%,transparent)]",
            "[border:1px_solid_var(--border)]",
          )}
        >
          <Info size={13} aria-hidden="true" className="flex-shrink-0" />
          <span>{labels.personNote}</span>
        </div>
      )}

      {showCommercialChips && (
        <div className="mt-4 flex flex-wrap gap-2">
          {hasPhysical && (
            <Chip variant="info" icon={<StoreIcon size={12} aria-hidden="true" />}>
              {labels.presencePhysical}
            </Chip>
          )}
          {hasOnline && (
            <Chip variant="info" icon={<Globe size={12} aria-hidden="true" />}>
              {labels.presenceOnline}
            </Chip>
          )}
          {store.hasStock === true && (
            <Chip variant="success" icon={<PackageCheck size={12} aria-hidden="true" />}>
              {labels.hasStock}
            </Chip>
          )}
          {store.receivesOrders === true && (
            <Chip variant="warning" icon={<CalendarClock size={12} aria-hidden="true" />}>
              {labels.acceptsPreorders}
            </Chip>
          )}
        </div>
      )}
    </section>
  );
}
