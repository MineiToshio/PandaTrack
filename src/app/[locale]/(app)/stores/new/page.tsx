import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { listCountryCodesCached } from "@/queries/country";
import { listActiveStoreProductTypeKeysCached } from "@/queries/storeProductType";
import { buildPageMetadata } from "@/lib/seo";
import CreateStoreForm from "./_components/CreateStoreForm";

type StoresNewPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string>>;
};

export async function generateMetadata({ params }: StoresNewPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "stores",
    pathSegment: "stores",
    titleKey: "create.title",
  });
}

export default async function StoresNewPage({ params, searchParams }: StoresNewPageProps) {
  const { locale } = await params;
  const { returnTo } = await searchParams;
  await getTranslations({ locale, namespace: "stores" });

  const [countries, productTypes] = await Promise.all([
    listCountryCodesCached(),
    listActiveStoreProductTypeKeysCached(),
  ]);

  return (
    <div className="text-foreground">
      <CreateStoreForm countries={countries} productTypes={productTypes} returnTo={returnTo} />
    </div>
  );
}
