import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import AppPlaceholderPage from "../_components/AppPlaceholderPage";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: DashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "dashboard",
    pathSegment: "dashboard",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  });
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;

  const t = await getTranslations({ locale, namespace: "dashboard" });

  return (
    <AppPlaceholderPage title={t("title")} description={t("welcome")} headingAs="h1" />
  );
}
