import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { buildPageMetadata } from "@/lib/seo";
import AppComingSoonCard from "../_components/AppComingSoonCard";
import AppPlaceholderPage from "../_components/AppPlaceholderPage";

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

  const [tDashboard, tLayout] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "appLayout" }),
  ]);

  return (
    <AppPlaceholderPage
      eyebrow={tLayout("pageHero.eyebrow")}
      title={tDashboard("title")}
      description={tDashboard("welcome")}
    >
      <AppComingSoonCard
        icon={LayoutDashboard}
        title={tDashboard("placeholder.title")}
        description={tDashboard("placeholder.description")}
        actions={
          <>
            <Button
              as="a"
              href={`/${locale}${ROUTES.orders}`}
              variant="primary"
              size="md"
              data-ph-event={POSTHOG_EVENTS.APP_SHELL.PLACEHOLDER_CTA_CLICKED}
              data-ph-props={JSON.stringify({ source: "dashboard", target: "orders" })}
            >
              {tDashboard("placeholder.ctaOrders")}
            </Button>
            <Button
              as="a"
              href={`/${locale}${ROUTES.stores}`}
              variant="ghost"
              size="md"
              data-ph-event={POSTHOG_EVENTS.APP_SHELL.PLACEHOLDER_CTA_CLICKED}
              data-ph-props={JSON.stringify({ source: "dashboard", target: "stores" })}
            >
              {tDashboard("placeholder.ctaStores")}
            </Button>
          </>
        }
      />
    </AppPlaceholderPage>
  );
}
