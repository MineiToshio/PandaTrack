import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

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
    <div className="bg-background text-foreground px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Heading as="h2" size="sm" className="text-text-title">
          {t("nav.shipments")}
        </Heading>
        <Typography size="md" className="text-text-body mt-2">
          {t("placeholder")}
        </Typography>
      </div>
    </div>
  );
}
