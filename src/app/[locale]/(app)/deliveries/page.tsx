import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Truck } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { buildPageMetadata } from "@/lib/seo";
import AppComingSoonCard from "../_components/AppComingSoonCard";
import AppPlaceholderPage from "../_components/AppPlaceholderPage";

type DeliveriesPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: DeliveriesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "deliveries",
    pathSegment: "deliveries",
    titleKey: "list.title",
    descriptionKey: "list.description",
  });
}

export default async function DeliveriesPage({ params }: DeliveriesPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deliveries" });

  return (
    <AppPlaceholderPage eyebrow={t("list.eyebrow")} title={t("list.title")} description={t("list.description")}>
      <AppComingSoonCard
        icon={Truck}
        title={t("list.placeholder.title")}
        description={t("list.placeholder.description")}
        actions={
          <Button
            as="a"
            href={`/${locale}${ROUTES.orders}`}
            variant="primary"
            size="md"
            data-ph-event={POSTHOG_EVENTS.APP_SHELL.PLACEHOLDER_CTA_CLICKED}
            data-ph-props={JSON.stringify({ source: "deliveries", target: "orders" })}
          >
            {t("list.placeholder.cta")}
          </Button>
        }
      />
    </AppPlaceholderPage>
  );
}
