import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import LegalPageLayout from "../_components/LegalPageLayout";

const TERMS_SECTION_KEYS = [
  "acceptance",
  "service",
  "eligibility",
  "conduct",
  "ip",
  "privacyRef",
  "disclaimers",
  "changes",
  "contact",
] as const;

type TermsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const t = await getTranslations("terms");
  return {
    title: t("title"),
    description: t("intro"),
  };
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;

  return <LegalPageLayout namespace="terms" sectionKeys={TERMS_SECTION_KEYS} locale={locale} />;
}
