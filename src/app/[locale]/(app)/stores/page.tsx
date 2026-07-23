import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import EmptyState from "@/components/modules/EmptyState";
import Button from "@/components/core/Button/Button";
import { getSession } from "@/lib/auth/auth-server";
import {
  countPublicStores,
  getPublicStoresListingPage,
  getViewerOrderCountsByStoreSlugs,
  type PublicStoreListingFilters,
} from "@/lib/data/stores/storeQueries";
import { listCountryCodesCached } from "@/lib/data/catalog/countryQueries";
import { listActiveStoreProductTypeKeysCached } from "@/lib/data/catalog/storeProductTypeQueries";
import { buildPageMetadata } from "@/lib/seo";
import { DEFAULT_PAGE_SIZE, ROUTES } from "@/lib/constants";
import { parseListingSearchParams } from "./_utils/listingParams";
import StoreListingContent from "./_components/StoreListingContent";
import StoreListingFilters from "./_components/StoreListingFilters";
import StoreListingGridSkeleton from "./_components/StoreListingGridSkeleton";
import StoreListingGridWrapper from "./_components/StoreListingGridWrapper";
import StoreListingPagination from "./_components/StoreListingPagination";
import StoreListingShell from "./_components/StoreListingShell";

type StoresPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function createStoresPageHref(
  basePath: string,
  rawParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (key === "page" || value == null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }
    params.set(key, value);
  });
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/** Changing the page size always resets to page 1; only a non-default size is kept in the URL. */
function createStoresPerPageHref(
  basePath: string,
  rawParams: Record<string, string | string[] | undefined>,
  perPageSize: number,
): string {
  const params = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (key === "page" || key === "perPage" || value == null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }
    params.set(key, value);
  });
  if (perPageSize !== DEFAULT_PAGE_SIZE) params.set("perPage", String(perPageSize));
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export async function generateMetadata({ params }: StoresPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "storeListing",
    pathSegment: "stores",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  });
}

export default async function StoresPage({ params, searchParams }: StoresPageProps) {
  const { locale } = await params;
  const rawParams = await searchParams;
  const parsed = parseListingSearchParams(rawParams);
  const filters: PublicStoreListingFilters = {
    nameQuery: parsed.nameQuery,
    productTypeKeys: parsed.productTypeKeys.length > 0 ? parsed.productTypeKeys : undefined,
    countryCodes: parsed.countryCodes.length > 0 ? parsed.countryCodes : undefined,
    importCountryCodes: parsed.importCountryCodes.length > 0 ? parsed.importCountryCodes : undefined,
    presenceTypes: parsed.presenceTypes.length > 0 ? parsed.presenceTypes : undefined,
    receivesOrders: parsed.receivesOrders,
    hasStock: parsed.hasStock,
    includeClosed: parsed.includeClosed,
    page: parsed.page,
    pageSize: parsed.perPage,
  };
  const hasFilters = Boolean(
    parsed.nameQuery ||
    parsed.productTypeKeys.length > 0 ||
    parsed.countryCodes.length > 0 ||
    parsed.importCountryCodes.length > 0 ||
    parsed.presenceTypes.length > 0 ||
    parsed.receivesOrders ||
    parsed.hasStock ||
    parsed.includeClosed,
  );

  const storesBasePath = `/${locale}/stores`;
  const fingerprint = JSON.stringify(rawParams);

  // Chrome data only (no heavy listing query): catalog options feed the filter drawer.
  const [tListing, tc, session, productTypeOptions, countryOptions] = await Promise.all([
    getTranslations({ locale, namespace: "storeListing" }),
    getTranslations({ locale, namespace: "components" }),
    getSession(),
    listActiveStoreProductTypeKeysCached(),
    listCountryCodesCached(),
  ]);

  return (
    <div className="text-foreground">
      <StoreListingShell>
        {/* `space-y-5` matches the orders/deliveries list stack rhythm. */}
        <div className="space-y-5">
          {/* Chrome — renders instantly. Only the count (data) is a skeleton; the title is real. */}
          <div className="flex items-baseline gap-2.5">
            <h1 className="[font-size:var(--text-display)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
              {tListing("s6.hero.title")}
            </h1>
            <Suspense
              fallback={
                <span
                  className="skeleton rounded-[6px]"
                  style={{ width: 64, height: 16, display: "inline-block" }}
                  aria-hidden
                />
              }
            >
              <StoresCount locale={locale} filters={filters} />
            </Suspense>
          </div>

          <StoreListingFilters
            locale={locale}
            productTypeOptions={productTypeOptions}
            countryOptions={countryOptions}
            initialNameQuery={parsed.nameQuery ?? ""}
            initialProductTypeKeys={parsed.productTypeKeys}
            initialCountryCodes={parsed.countryCodes}
            initialImportCountryCodes={parsed.importCountryCodes}
            initialPresenceTypes={parsed.presenceTypes}
            initialReceivesOrders={parsed.receivesOrders}
            initialHasStock={parsed.hasStock}
            initialIncludeClosed={parsed.includeClosed}
          />

          {/* Grid: useTransition swaps to the card skeleton on filter/sort/page changes;
              the inner Suspense shows the same card-grid skeleton on the initial server load. */}
          <StoreListingGridWrapper>
            <Suspense key={fingerprint} fallback={<StoreListingGridSkeleton loadingLabel={tc("skeleton.loading")} />}>
              <StoresGridSection
                locale={locale}
                filters={filters}
                userId={session?.user?.id}
                hasFilters={hasFilters}
                buildPaginationHref={(targetPage) => createStoresPageHref(storesBasePath, rawParams, targetPage)}
                buildPerPageHref={(size) => createStoresPerPageHref(storesBasePath, rawParams, size)}
              />
            </Suspense>
          </StoreListingGridWrapper>
        </div>
      </StoreListingShell>
    </div>
  );
}

/** Filtered store count for the heading. Suspended (the counter is a skeleton). */
async function StoresCount({ locale, filters }: { locale: string; filters: PublicStoreListingFilters }) {
  const [tListing, totalStores] = await Promise.all([
    getTranslations({ locale, namespace: "storeListing" }),
    countPublicStores(filters),
  ]);
  return (
    <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
      {tListing("s6.count", { count: totalStores })}
    </span>
  );
}

/** Heavy listing query + card grid + pagination (or empty state). The only part that suspends. */
async function StoresGridSection({
  locale,
  filters,
  userId,
  hasFilters,
  buildPaginationHref,
  buildPerPageHref,
}: {
  locale: string;
  filters: PublicStoreListingFilters;
  userId: string | undefined;
  hasFilters: boolean;
  buildPaginationHref: (page: number) => string;
  buildPerPageHref: (size: number) => string;
}) {
  const listingPage = await getPublicStoresListingPage(filters);

  if (listingPage.totalCount === 0) {
    return <StoresEmptyState locale={locale} hasFilters={hasFilters} />;
  }

  const viewerOrderCountsBySlug =
    userId && listingPage.items.length > 0
      ? await getViewerOrderCountsByStoreSlugs(
          userId,
          listingPage.items.map((s) => s.slug),
        )
      : undefined;

  return (
    <>
      <StoreListingContent
        locale={locale}
        stores={listingPage.items}
        viewerOrderCountsBySlug={viewerOrderCountsBySlug}
      />
      <StoreListingPagination
        locale={locale}
        totalPages={listingPage.totalPages}
        currentPage={listingPage.currentPage}
        totalCount={listingPage.totalCount}
        pageSize={listingPage.pageSize}
        createPageHref={buildPaginationHref}
        buildPerPageHref={buildPerPageHref}
      />
    </>
  );
}

function StoresEmptyState({ locale, hasFilters }: { locale: string; hasFilters: boolean }) {
  const tListing = useTranslations("storeListing");
  const clearHref = `/${locale}${ROUTES.stores}`;

  return (
    <EmptyState
      appearance="card"
      headingAs="h2"
      icon={<Sparkles width={28} height={28} />}
      iconTone={hasFilters ? "neutral" : "accent"}
      title={hasFilters ? tListing("s6.empty.title") : tListing("empty")}
      subtitle={hasFilters ? tListing("s6.empty.subtitle") : undefined}
      actions={
        hasFilters ? (
          <Button as="a" href={clearHref} variant="ghost" size="md">
            {tListing("s6.empty.clearFilters")}
          </Button>
        ) : null
      }
    />
  );
}
