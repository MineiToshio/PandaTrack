import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Heading from "@/components/core/Heading";
import { getSession } from "@/lib/auth/auth-server";
import { getDashboardData } from "@/lib/data/dashboard/dashboardQueries";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { buildPageMetadata } from "@/lib/seo";
import DashboardBudgetZone from "./_components/DashboardBudgetZone";
import DashboardCashZone from "./_components/DashboardCashZone";
import DashboardUpcomingPaymentsZone from "./_components/DashboardUpcomingPaymentsZone";
import DashboardZoneView from "./_components/DashboardZoneView";

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

  // The (app) layout guarantees an authenticated session before this renders; narrow for types.
  if (!session) {
    return null;
  }

  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getDashboardData(session.user.id),
  ]);

  const displayName = session.user.name?.trim();
  const greeting = displayName ? t("page.greeting", { name: displayName }) : t("page.greetingGuest");

  return (
    <div className="flex flex-col gap-6">
      <DashboardZoneView event={POSTHOG_EVENTS.DASHBOARD.CASH_ZONE_VIEWED} />

      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Heading as="h1" size="sm">
          {greeting}
        </Heading>
        {data.baseCurrencyCode && (
          <span className="[font-size:13px] whitespace-nowrap [color:var(--text-muted)]">
            {t("page.baseCurrencyReminder", { currency: data.baseCurrencyCode })}
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-12 lg:items-start lg:gap-5">
        <div className="lg:col-span-8">
          <DashboardCashZone data={data} locale={locale} />
        </div>
        {/* Right column of the top row. The arrival-punctuality card joins this stack later. */}
        <div className="flex flex-col gap-[18px] lg:col-span-4">
          <DashboardBudgetZone data={data} locale={locale} />
        </div>
        <div className="lg:col-span-6">
          <DashboardUpcomingPaymentsZone data={data} locale={locale} />
        </div>
      </div>
    </div>
  );
}
