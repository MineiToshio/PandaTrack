import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import BackNavLink from "@/components/core/BackNavLink";
import Typography from "@/components/core/Typography";
import AppPageHero from "@/components/modules/AppPageHero";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { APP_SHELL_FORM_RAIL_CLASSNAME, ROUTES } from "@/lib/constants";
import { getDeliveryStubById } from "@/lib/data/deliveries/deliveryQueries";

type DeliveryDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: DeliveryDetailPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "deliveries",
    pathSegment: "deliveries",
    titleKey: "detail.metaTitle",
  });
}

export default async function DeliveryDetailPage({ params }: DeliveryDetailPageProps) {
  const { locale, id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);

  const t = await getTranslations({ locale, namespace: "deliveries" });
  const delivery = await getDeliveryStubById(id, session.user.id);

  if (!delivery) notFound();

  return (
    <div className={`${APP_SHELL_FORM_RAIL_CLASSNAME} space-y-6`}>
      <BackNavLink href={`/${locale}${ROUTES.deliveriesNew}`}>{t("detail.backToCreate")}</BackNavLink>
      <AppPageHero
        eyebrow={t("detail.heroEyebrow")}
        title={t("detail.title", { humanReadableId: delivery.humanReadableId })}
        description={t("detail.stubDescription")}
      />
      <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-sm" aria-labelledby="delivery-summary-title">
        <SectionTitleWithAccent id="delivery-summary-title" as="h2">
          {t("detail.summaryTitle")}
        </SectionTitleWithAccent>
        <Typography size="sm" className="text-text-body">
          {t("detail.deliveryDate", {
            date: delivery.deliveryDate.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }),
          })}
        </Typography>
      </section>
    </div>
  );
}
