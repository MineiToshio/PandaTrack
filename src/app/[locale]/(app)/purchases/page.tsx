import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import AppPlaceholderPage from "../_components/AppPlaceholderPage";

type PurchasesPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PurchasesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "appLayout",
    pathSegment: "purchases",
    titleKey: "nav.purchases",
    descriptionKey: "meta.description",
  });
}

export default async function PurchasesPage({ params }: PurchasesPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "appLayout" });

  return (
    <AppPlaceholderPage
      eyebrow={t("pageHero.eyebrow")}
      title={t("nav.purchases")}
      description={t("pageHero.purchasesDescription")}
    />
  );
}
