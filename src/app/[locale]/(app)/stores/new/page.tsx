import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { APP_SHELL_FORM_RAIL_CLASSNAME } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { listCountryCodes } from "@/queries/country";
import { listActiveStoreProductTypeKeys } from "@/queries/storeProductType";
import { buildPageMetadata } from "@/lib/seo";
import CreateStoreForm from "./_components/CreateStoreForm";

type StoresNewPageProps = {
  params: Promise<{ locale: string }>;
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

export default async function StoresNewPage({ params }: StoresNewPageProps) {
  const { locale } = await params;
  await getTranslations({ locale, namespace: "stores" });

  const [countries, productTypes] = await Promise.all([
    listCountryCodes(prisma),
    listActiveStoreProductTypeKeys(prisma),
  ]);

  return (
    <div className="text-foreground">
      <div className={APP_SHELL_FORM_RAIL_CLASSNAME}>
        <CreateStoreForm countries={countries} productTypes={productTypes} />
      </div>
    </div>
  );
}
