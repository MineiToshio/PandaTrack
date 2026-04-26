import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import AppPlaceholderPage from "../../_components/AppPlaceholderPage";

type PreOrdersPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PreOrdersPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "appLayout",
    pathSegment: "orders/pre-orders",
    titleKey: "nav.preOrders",
    descriptionKey: "meta.description",
  });
}

export default async function PreOrdersPage({ params }: PreOrdersPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "appLayout" });

  return (
    <AppPlaceholderPage
      eyebrow={t("pageHero.eyebrow")}
      title={t("nav.preOrders")}
      description={t("pageHero.preOrdersDescription")}
    />
  );
}
