import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { Lock, MapPin, Minus, Store as StoreIcon, Truck, User as UserIcon } from "lucide-react";
import Chip from "@/components/core/Chip";
import StarRating from "@/components/core/StarRating";
import StoreAvatar from "@/components/core/StoreAvatar";
import type { PublicStoreListingItem } from "@/lib/data/stores/storeQueries";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { cn } from "@/lib/styles";
import { ROUTES } from "@/lib/constants";

export type StoreCardLabels = {
  /** Label preceding the import countries list (e.g. "Importa de ·"). */
  importCountriesLabel: string;
  /** Fallback when no import countries are declared. */
  noImportCountries: string;
  /** Localized country name lookup `{countryCode}` → human label. */
  countryName: (code: string) => string;
  /** Localized product type label lookup `{key}` → human label. */
  productTypeLabel: (key: string) => string;
  /** Plural-aware reviews count formatter. */
  ratingCount: (count: number) => string;
  /** Fallback when no reviews exist yet. */
  ratingFallback: string;
  /** Static label shown below the viewer order count (e.g. "tus pedidos" / "your orders"). */
  ordersForViewerLabel?: string;
  /** Overflow pill for the categories that did not fit, e.g. "+3 más". */
  moreCategories: (count: number) => string;
  /** Short marker shown when the store is the viewer's own private one, e.g. "Privada". */
  privateMarker: string;
  /** Aria-label template for the card link, e.g. "Ver detalle de {name}". */
  ariaLabel: (name: string) => string;
  /**
   * Appended to `ariaLabel` when the private marker shows. A composed suffix rather than a second
   * full label: the card's `aria-label` overrides its own subtree for assistive tech, so the
   * visible marker is never announced on its own, and a separate label per combination of card
   * facts would multiply with every fact we add.
   */
  ariaLabelPrivateSuffix: string;
};

export type StoreCardProps = {
  store: PublicStoreListingItem;
  locale: string;
  labels: StoreCardLabels;
  /** Optional count of viewer orders associated with this store. */
  viewerOrderCount?: number;
  /**
   * Who is looking. The private marker renders only for a store this viewer created, so the card
   * can never assert "private, only you can see it" about somebody else's store — the mistake the
   * detail page makes today by keying that copy on `isPrivate` alone.
   */
  viewerId?: string | null;
  className?: string;
};

/**
 * Hard cap on total chip slots (visible + the "+N más" pill counts as one slot).
 * When there is overflow, 3 chips + the pill are shown = 4 items ≤ 2 chip rows.
 * When there is no overflow, up to 4 chips are shown with no pill.
 */
const MAX_CHIP_SLOTS = 4;

/**
 * Listing card for the public stores directory.
 * Avatar 56px (logo/monogram for RETAILER and PROXY, muted user icon for PERSON) + identity + categories + import countries + stats.
 * Anchored — the entire card is a clickable link to the store detail.
 *
 * Visual contract: see the Stores prototype at `docs/product/prd-02-collector-app/frd-04-store-domain/prototype/store-domain.html`
 * and the Velvet design system at `docs/design/` (`components.md`).
 */
export default function StoreCard({ store, locale, labels, viewerOrderCount, viewerId, className }: StoreCardProps) {
  const detailHref = `/${locale}${ROUTES.stores}/${store.slug}`;
  // When there are more types than the slot cap, reserve one slot for the overflow ("+N") pill
  // so it always fits within the 2-row chip area alongside the visible chips.
  const hasOverflow = store.productTypeKeys.length > MAX_CHIP_SLOTS;
  const visibleCategories = store.productTypeKeys.slice(0, hasOverflow ? MAX_CHIP_SLOTS - 1 : MAX_CHIP_SLOTS);
  const hiddenCategoriesCount = store.productTypeKeys.length - visibleCategories.length;
  const isPerson = store.sellerType === "PERSON";
  const isProxy = store.sellerType === "PROXY";
  // PROXY (intermediary) and RETAILER render a logo/monogram avatar; only PERSON uses the muted user icon.
  const TypeIcon = isPerson ? UserIcon : isProxy ? Truck : StoreIcon;
  const hasImports = store.importCountryCodes.length > 0;
  // Only about the viewer's own store; see the `viewerId` prop. Today the listing can only ever
  // hand this card a private store the viewer created, so this is a second lock on a door that is
  // already locked — kept because the marker states something about the viewer, and a surface that
  // asserts "private" about a store it merely received would be wrong the moment that changes.
  const showsPrivateMarker = store.isPrivate && Boolean(viewerId) && store.createdByUserId === viewerId;
  const ariaLabel = showsPrivateMarker
    ? `${labels.ariaLabel(store.name)}${labels.ariaLabelPrivateSuffix}`
    : labels.ariaLabel(store.name);

  return (
    <ViewTransitionLink
      href={detailHref}
      viewTransitionEntity="store"
      aria-label={ariaLabel}
      style={{ viewTransitionName: `store-${store.slug}` }}
      className={cn(
        "group flex h-[279px] flex-col gap-3 overflow-hidden rounded-[var(--radius-xl)] p-[18px]",
        // Leaf card on the page canvas, so it takes the raised fill (see visual-foundations.md,
        // "Choosing between --surface and --surface-elevated"): --surface is only +3 ΔL over the
        // dark canvas and the card loses its edges there.
        "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
        "transition-[border-color,transform,box-shadow] [transition-duration:var(--motion-fast)] motion-reduce:transition-none",
        "hover:[transform:translateY(-2px)] hover:[border-color:var(--border-strong)] hover:[box-shadow:var(--shadow-2)]",
        "[outline:none] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {store.logoUrl ? (
          <StoreAvatar store={{ name: store.name, logo: { src: store.logoUrl, aspect: "square" } }} size={56} />
        ) : (
          <StoreAvatar store={{ name: store.name }} size={56} isPerson={isPerson} />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <TypeIcon size={14} aria-hidden="true" className="flex-shrink-0 [color:var(--text-muted)]" />
            <h3 className="min-w-0 flex-1 truncate [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
              {store.name}
            </h3>
          </div>
          <div className="flex min-w-0 items-center gap-1 [font-size:var(--text-caption)] [color:var(--text-muted)]">
            <MapPin size={12} aria-hidden="true" className="flex-shrink-0" />
            <span className="truncate">{labels.countryName(store.countryCode)}</span>
            {/*
              The privacy marker lives here rather than in the chip row below for three reasons: the
              chip row is reserved for product-type chips by design, it is optional (a store with no
              categories renders none at all, which is exactly what an intake-created store looks
              like), and its slots are capped, so a marker there would cost a real category. This
              band exists on every card, so the marker sits at a constant position and is scannable
              down a column. It is `shrink-0` so the country keeps the truncation, and it is a step
              stronger than the muted row around it so it reads as a marker rather than as metadata.
            */}
            {showsPrivateMarker && (
              <span className="flex flex-shrink-0 items-center gap-1 [font-weight:var(--font-weight-medium)] [color:var(--text-secondary)]">
                <span aria-hidden="true">·</span>
                <Lock size={11} aria-hidden="true" />
                {labels.privateMarker}
              </span>
            )}
          </div>
        </div>
      </div>

      {visibleCategories.length > 0 && (
        <div className="flex max-h-[58px] flex-wrap items-center gap-1.5 overflow-hidden">
          {visibleCategories.map((key) => {
            const Icon = getStoreProductTypeIcon(key);
            return (
              <Chip key={key} variant="accent" icon={<Icon size={12} aria-hidden="true" />}>
                {labels.productTypeLabel(key)}
              </Chip>
            );
          })}
          {hiddenCategoriesCount > 0 && (
            <Chip variant="neutral" size="sm">
              {labels.moreCategories(hiddenCategoriesCount)}
            </Chip>
          )}
        </div>
      )}

      {hasImports ? (
        <div className="min-h-0 flex-1 overflow-hidden [font-size:var(--text-caption)] [line-height:1.5] [color:var(--text-muted)]">
          <p className="line-clamp-2">
            <span className="[font-weight:var(--font-weight-semibold)]">{labels.importCountriesLabel} </span>
            {store.importCountryCodes.map((code) => labels.countryName(code)).join(" · ")}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-start gap-1.5 [font-size:var(--text-caption)] [color:var(--text-muted)] opacity-70">
          <Minus size={10} aria-hidden="true" className="mt-0.5 flex-shrink-0 opacity-60" />
          <span>{labels.noImportCountries}</span>
        </div>
      )}

      <div
        className={cn(
          "mt-1 flex items-start justify-between gap-4",
          "pt-3 [border-top:1px_solid_var(--border)]",
          "[font-size:var(--text-caption)] [color:var(--text-muted)]",
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex flex-col leading-tight">
            {store.averageRating != null ? (
              <>
                <span className="[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)] [font-variant-numeric:tabular-nums]">
                  {store.averageRating.toFixed(1)}
                </span>
                <span>{labels.ratingCount(store.reviewCount)}</span>
              </>
            ) : (
              <>
                <span className="[font-size:var(--text-body)] [color:var(--text-muted)]">—</span>
                <span>{labels.ratingFallback}</span>
              </>
            )}
          </div>
          {viewerOrderCount != null && viewerOrderCount > 0 && labels.ordersForViewerLabel && (
            <div className="flex flex-col leading-tight">
              <span className="[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)] [font-variant-numeric:tabular-nums]">
                {viewerOrderCount}
              </span>
              <span>{labels.ordersForViewerLabel}</span>
            </div>
          )}
        </div>
        <div className="shrink-0 self-start">
          <StarRating value={store.averageRating} size={14} />
        </div>
      </div>
    </ViewTransitionLink>
  );
}
