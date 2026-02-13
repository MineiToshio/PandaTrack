import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import LegalPageLayout from "../_components/LegalPageLayout";

const PRIVACY_SECTION_KEYS = [
  "whoWeAre",
  "dataWeCollect",
  "howWeUse",
  "legalBasis",
  "sharing",
  "retention",
  "yourRights",
  "cookies",
  "security",
  "children",
  "changes",
  "contact",
] as const;

type PrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return {
    title: t("title"),
    description: t("intro"),
  };
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;

  return <LegalPageLayout namespace="privacy" sectionKeys={PRIVACY_SECTION_KEYS} locale={locale} />;
}
