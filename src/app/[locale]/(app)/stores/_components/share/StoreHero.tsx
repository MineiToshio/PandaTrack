import { CalendarClock, Globe, MapPin, PackageCheck, Store as StoreIcon } from "lucide-react";
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
};

export type StoreHeroProps = {
  store: StoreDetail;
  labels: StoreHeroLabels;
  className?: string;
};

/**
 * Detail hero card matching `.detail-hero` from `_notes/demo-screens.html § s6-store-detail-published-viewer`.
 * Layout: avatar (s56) + identity column + rating block (right-aligned) → description → chips row.
 */
export default function StoreHero({ store, labels, className }: StoreHeroProps) {
  const isPerson = store.storeType === "PERSON";
  const hasPhysical = store.presenceTypes.includes("PHYSICAL");
  const hasOnline = store.presenceTypes.includes("ONLINE");

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
        ) : (
          <StoreAvatar store={{ name: store.name }} size={56} isPerson={isPerson} />
        )}
        <div className="min-w-0 flex-1">
          <div className="[font-size:17px] [font-weight:600] [color:var(--text-primary)]">{store.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5 [font-size:12px] [color:var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden="true" />
              {labels.countryName(store.countryCode)}
            </span>
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

      {!isPerson && (hasPhysical || hasOnline || store.hasStock === true || store.receivesOrders === true) && (
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
