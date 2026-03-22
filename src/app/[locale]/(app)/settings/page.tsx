import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import AppPlaceholderPage from "../_components/AppPlaceholderPage";

type SettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: SettingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "appLayout",
    pathSegment: "settings",
    titleKey: "nav.settings",
    descriptionKey: "meta.description",
  });
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "appLayout" });

  return (
    <AppPlaceholderPage title={t("nav.settings")} description={t("placeholder")} />
  );
}
