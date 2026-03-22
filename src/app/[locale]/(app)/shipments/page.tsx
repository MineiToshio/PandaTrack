import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import AppPlaceholderPage from "../_components/AppPlaceholderPage";

type ShipmentsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ShipmentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "appLayout",
    pathSegment: "shipments",
    titleKey: "nav.shipments",
    descriptionKey: "meta.description",
  });
}

export default async function ShipmentsPage({ params }: ShipmentsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "appLayout" });

  return (
    <AppPlaceholderPage title={t("nav.shipments")} description={t("placeholder")} />
  );
}
