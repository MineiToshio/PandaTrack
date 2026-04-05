import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PUBLIC_STORE_PAGE_SIZE, getPublicStoresListingPage } from "@/queries/store";
import { buildPageMetadata } from "@/lib/seo";
import { parseListingSearchParams } from "./_utils/listingParams";
import StoreListingContent from "./_components/StoreListingContent";
import AppPageHero from "@/components/modules/AppPageHero";
import StoreListingFilters from "./_components/StoreListingFilters";
import StoreListingPagination from "./_components/StoreListingPagination";

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

  const [listingPage, productTypeOptions, countryOptions] = await Promise.all([
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
    prisma.storeProductType.findMany({
      where: { isActive: true },
      select: { key: true },
      orderBy: { key: "asc" },
    }),
    prisma.country.findMany({
      select: { code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const tStores = await getTranslations({ locale, namespace: "stores" });
  const tListing = await getTranslations({ locale, namespace: "storeListing" });
  const showingFrom = listingPage.totalCount === 0 ? 0 : (listingPage.currentPage - 1) * listingPage.pageSize + 1;
  const showingTo = Math.min(listingPage.currentPage * listingPage.pageSize, listingPage.totalCount);
  const storesBasePath = `/${locale}/stores`;
  const buildPaginationHref = (targetPage: number) => createStoresPageHref(storesBasePath, rawParams, targetPage);

  return (
    <div className="text-foreground px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <AppPageHero
          eyebrow={tListing("hero.eyebrow")}
          title={tListing("hero.title")}
          description={tListing("meta.description")}
        />
        <StoreListingFilters
          locale={locale}
          createStoreLabel={tStores("create.title")}
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
          showingFrom={showingFrom}
          showingTo={showingTo}
        />
        <StoreListingContent locale={locale} stores={listingPage.items} />
        <StoreListingPagination
          locale={locale}
          totalPages={listingPage.totalPages}
          currentPage={listingPage.currentPage}
          createPageHref={buildPaginationHref}
        />
      </div>
    </div>
  );
}
