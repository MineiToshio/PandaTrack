import type { Metadata } from "next";
import LegalPageLayout from "../_components/LegalPageLayout";
import { buildPageMetadata } from "@/lib/seo";

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
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "privacy",
    pathSegment: "privacy",
    titleKey: "title",
    descriptionKey: "intro",
  });
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;

  return <LegalPageLayout namespace="privacy" sectionKeys={PRIVACY_SECTION_KEYS} locale={locale} />;
}
