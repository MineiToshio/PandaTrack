import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

type TermsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  const t = await getTranslations("legal");

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-2xl">
        <Heading as="h1" size="md" className="text-text-title mb-4">
          {t("termsTitle")}
        </Heading>
        <Typography size="md" className="text-muted-foreground">
          {t("comingSoon")}
        </Typography>
        <Link
          href={`/${locale}`}
          className="text-primary hover:text-link mt-6 inline-block text-sm font-medium transition-colors"
        >
          {t("backToHome")}
        </Link>
      </div>
    </main>
  );
}
