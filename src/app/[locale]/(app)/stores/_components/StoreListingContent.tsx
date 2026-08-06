import { useTranslations } from "next-intl";
import type { PublicStoreListingItem } from "@/lib/data/stores/storeQueries";
import {
  resolveStoreProductTypeName,
  type AuthoredStoreProductTypeNameMap,
} from "@/lib/catalog/resolveStoreProductTypeName";
import StoreCard from "./share/StoreCard";

export type StoreListingContentProps = {
  locale: string;
  stores: PublicStoreListingItem[];
  /** Authored (non-seed) catalog names so cards resolve admin-authored types; seeds use i18n. */
  authoredProductTypeNames: AuthoredStoreProductTypeNameMap;
  /** Map of store slug → total viewer order count. Only populated for authenticated viewers. */
  viewerOrderCountsBySlug?: Record<string, number>;
  /** Who is looking, so a card marks a store private only when it is that viewer's own. */
  viewerId?: string | null;
};

/**
 * Grid of public stores rendered with the redesigned `StoreCard` (S6).
 * Empty state is rendered by the parent `StoresPage` when `stores.length === 0`.
 */
export default function StoreListingContent({
  locale,
  stores,
  authoredProductTypeNames,
  viewerOrderCountsBySlug,
  viewerId,
}: StoreListingContentProps) {
  const tListing = useTranslations("storeListing");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");

  return (
    <ul className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3" role="list">
      {stores.map((store) => (
        <li key={store.slug}>
          <StoreCard
            store={store}
            locale={locale}
            labels={{
              importCountriesLabel: tListing("s6.importCountriesLabel"),
              noImportCountries: tListing("s6.noImportCountries"),
              countryName: (code) => tCountries(code),
              productTypeLabel: (key) =>
                resolveStoreProductTypeName(authoredProductTypeNames[key], tProductTypes(key), locale),
              ratingCount: (count) => tListing("ratingCount", { count }),
              ratingFallback: tListing("s6.card.ratingFallback"),
              moreCategories: (count) => tListing("s6.card.moreCategories", { count }),
              privateMarker: tListing("s6.card.privateMarker"),
              ariaLabel: (name) => tListing("s6.card.ariaLabel", { name }),
              ariaLabelPrivateSuffix: tListing("s6.card.ariaLabelPrivateSuffix"),
              ordersForViewerLabel: tListing("s6.card.ordersForViewerLabel"),
            }}
            viewerOrderCount={viewerOrderCountsBySlug?.[store.slug]}
            viewerId={viewerId}
          />
        </li>
      ))}
    </ul>
  );
}
