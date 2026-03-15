import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicStoresListing } from "@/queries/store";
import { buildPageMetadata } from "@/lib/seo";
import { parseListingSearchParams } from "./_utils/listingParams";
import StoreListingContent from "./_components/StoreListingContent";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { Sparkles } from "lucide-react";
import StoreListingFilters from "./_components/StoreListingFilters";

type StoresPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const { nameQuery, categoryKeys, countryCodes, importCountryCodes, presenceTypes, receivesOrders, hasStock } =
    parseListingSearchParams(rawParams);

  const [stores, categoryOptions, countryOptions] = await Promise.all([
    getPublicStoresListing(prisma, {
      nameQuery,
      categoryKeys: categoryKeys.length > 0 ? categoryKeys : undefined,
      countryCodes: countryCodes.length > 0 ? countryCodes : undefined,
      importCountryCodes: importCountryCodes.length > 0 ? importCountryCodes : undefined,
      presenceTypes: presenceTypes.length > 0 ? presenceTypes : undefined,
      receivesOrders,
      hasStock,
    }),
    prisma.storeCategory.findMany({
      where: { isActive: true },
      select: { key: true },
      orderBy: { key: "asc" },
    }),
    prisma.country.findMany({
      select: { code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const tApp = await getTranslations({ locale, namespace: "appLayout" });
  const tStores = await getTranslations({ locale, namespace: "stores" });
  const tListing = await getTranslations({ locale, namespace: "storeListing" });

  return (
    <div className="bg-background text-foreground px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="border-border/70 from-primary/12 via-background to-accent/10 rounded-2xl border bg-linear-to-br p-5 shadow-sm sm:p-6">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="bg-primary/15 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                <Sparkles className="size-3.5" aria-hidden />
                {tListing("title")}
              </span>
              <Heading as="h1" size="xs" className="text-text-title">
                {tApp("nav.stores")}
              </Heading>
              <Typography size="sm" className="text-text-muted max-w-2xl">
                {tListing("meta.description")}
              </Typography>
            </div>
          </div>
        </div>
        <StoreListingFilters
          locale={locale}
          createStoreLabel={tStores("create.title")}
          categoryOptions={categoryOptions}
          countryOptions={countryOptions}
          initialNameQuery={nameQuery ?? ""}
          initialCategoryKeys={categoryKeys}
          initialCountryCodes={countryCodes}
          initialImportCountryCodes={importCountryCodes}
          initialPresenceTypes={presenceTypes}
          initialReceivesOrders={receivesOrders}
          initialHasStock={hasStock}
        />
        <StoreListingContent locale={locale} stores={stores} />
      </div>
    </div>
  );
}
