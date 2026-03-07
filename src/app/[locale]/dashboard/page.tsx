import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

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
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Heading as="h1" size="sm" className="text-text-title">
          {t("title")}
        </Heading>
        <Typography size="md" className="text-text-body mt-2">
          {t("welcome")}
        </Typography>
      </div>
    </main>
  );
}
