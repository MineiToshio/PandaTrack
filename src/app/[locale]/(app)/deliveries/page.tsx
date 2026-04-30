import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import AppPlaceholderPage from "../_components/AppPlaceholderPage";

type DeliveriesPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: DeliveriesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "deliveries",
    pathSegment: "deliveries",
    titleKey: "list.title",
    descriptionKey: "list.description",
  });
}

export default async function DeliveriesPage({ params }: DeliveriesPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deliveries" });

  return <AppPlaceholderPage eyebrow={t("list.eyebrow")} title={t("list.title")} description={t("list.description")} />;
}
