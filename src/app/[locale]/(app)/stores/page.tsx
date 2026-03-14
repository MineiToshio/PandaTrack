import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/constants";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

type StoresPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: StoresPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "appLayout",
    pathSegment: "stores",
    titleKey: "nav.stores",
    descriptionKey: "meta.description",
  });
}

export default async function StoresPage({ params }: StoresPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "appLayout" });
  const tStores = await getTranslations({ locale, namespace: "stores" });

  return (
    <div className="bg-background text-foreground px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <Heading as="h2" size="sm" className="text-text-title shrink-0">
            {t("nav.stores")}
          </Heading>
          <Link
            href={`/${locale}${ROUTES.storesNew}`}
            className={cn(buttonVariants({ variant: "primary" }), "shrink-0")}
          >
            {tStores("create.title")}
          </Link>
        </div>
        <Typography size="md" className="text-text-body mt-2">
          {t("placeholder")}
        </Typography>
      </div>
    </div>
  );
}
