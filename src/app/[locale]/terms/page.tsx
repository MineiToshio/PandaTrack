import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/types/locale";
import LegalPageLayout from "../_components/LegalPageLayout";
import { buildPageMetadata } from "@/lib/seo";

const TERMS_SECTION_KEYS = [
  "acceptance",
  "service",
  "eligibility",
  "conduct",
  "aiFeatures",
  "ip",
  "privacyRef",
  "disclaimers",
  "governingLaw",
  "changes",
  "contact",
] as const;

type TermsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "terms",
    pathSegment: "terms",
    titleKey: "title",
    descriptionKey: "intro",
  });
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  setRequestLocale(locale);

  return <LegalPageLayout namespace="terms" sectionKeys={TERMS_SECTION_KEYS} locale={locale} />;
}
