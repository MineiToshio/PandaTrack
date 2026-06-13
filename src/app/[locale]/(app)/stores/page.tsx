import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import EmptyState from "@/components/modules/EmptyState";
import Button from "@/components/core/Button/Button";
import { getSession } from "@/lib/auth/auth-server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PUBLIC_STORE_PAGE_SIZE,
  getPublicStoresListingPage,
  getViewerOrderCountsByStoreSlugs,
} from "@/queries/store";
import { listCountryCodes } from "@/queries/country";
import { listActiveStoreProductTypeKeys } from "@/queries/storeProductType";
import { buildPageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/constants";
import { parseListingSearchParams } from "./_utils/listingParams";
import StoreListingContent from "./_components/StoreListingContent";
import StoreListingFilters from "./_components/StoreListingFilters";
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
    if (key === "page" || value == null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        params.append(key, item);
      });
      return;
    }

    params.set(key, value);
  });

  if (page > 1) {
    params.set("page", String(page));
  }

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
  await getTranslations({ locale, namespace: "storeListing" });

  const rawParams = await searchParams;
  const {
    nameQuery,
    productTypeKeys,
    countryCodes,
    importCountryCodes,
    presenceTypes,
    receivesOrders,
    hasStock,
    page,
  } = parseListingSearchParams(rawParams);

  const [session, listingPage, productTypeOptions, countryOptions] = await Promise.all([
    getSession(),
    getPublicStoresListingPage(prisma, {
      nameQuery,
      productTypeKeys: productTypeKeys.length > 0 ? productTypeKeys : undefined,
      countryCodes: countryCodes.length > 0 ? countryCodes : undefined,
      importCountryCodes: importCountryCodes.length > 0 ? importCountryCodes : undefined,
      presenceTypes: presenceTypes.length > 0 ? presenceTypes : undefined,
      receivesOrders,
      hasStock,
      page,
      pageSize: DEFAULT_PUBLIC_STORE_PAGE_SIZE,
    }),
    listActiveStoreProductTypeKeys(prisma),
    listCountryCodes(prisma),
  ]);

  const viewerOrderCountsBySlug =
    session?.user?.id && listingPage.items.length > 0
      ? await getViewerOrderCountsByStoreSlugs(
          prisma,
          session.user.id,
          listingPage.items.map((s) => s.slug),
        )
      : undefined;

  const storesBasePath = `/${locale}/stores`;
  const buildPaginationHref = (targetPage: number) => createStoresPageHref(storesBasePath, rawParams, targetPage);

  return (
    <div className="text-foreground">
      <StoreListingShell>
        {/* `space-y-5` matches the orders/deliveries list stack rhythm. */}
        <div className="space-y-5">
          <StoreListingFilters
            locale={locale}
            productTypeOptions={productTypeOptions}
            countryOptions={countryOptions}
            initialNameQuery={nameQuery ?? ""}
            initialProductTypeKeys={productTypeKeys}
            initialCountryCodes={countryCodes}
            initialImportCountryCodes={importCountryCodes}
            initialPresenceTypes={presenceTypes}
            initialReceivesOrders={receivesOrders}
            initialHasStock={hasStock}
            totalStores={listingPage.totalCount}
          />
          <StoreListingGridWrapper>
            {listingPage.totalCount === 0 ? (
              <StoresEmptyState
                locale={locale}
                hasFilters={Boolean(
                  nameQuery ||
                  productTypeKeys.length > 0 ||
                  countryCodes.length > 0 ||
                  importCountryCodes.length > 0 ||
                  presenceTypes.length > 0 ||
                  receivesOrders ||
                  hasStock,
                )}
              />
            ) : (
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
                  createPageHref={buildPaginationHref}
                />
              </>
            )}
          </StoreListingGridWrapper>
        </div>
      </StoreListingShell>
    </div>
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
