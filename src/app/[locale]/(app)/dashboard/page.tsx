import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Heading from "@/components/core/Heading";
import { buildStoresNavHref } from "@/app/[locale]/(app)/_utils/storesNavHref";
import { getSession } from "@/lib/auth/auth-server";
import { getDashboardData } from "@/lib/data/dashboard/dashboardQueries";
import { prisma } from "@/lib/prisma";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { buildPageMetadata } from "@/lib/seo";
import { listCountryCodes } from "@/queries/country";
import { listActiveStoreProductTypeKeys } from "@/queries/storeProductType";
import { getCollectorPreferencesSnapshot } from "@/queries/userSettings";
import DashboardActivityZone from "./_components/DashboardActivityZone";
import DashboardBudgetZone from "./_components/DashboardBudgetZone";
import DashboardCashZone from "./_components/DashboardCashZone";
import DashboardCollectionZone from "./_components/DashboardCollectionZone";
import DashboardKpiStrip from "./_components/DashboardKpiStrip";
import DashboardPunctualityZone from "./_components/DashboardPunctualityZone";
import DashboardTrendsSection from "./_components/DashboardTrendsSection";
import DashboardUpcomingPaymentsZone from "./_components/DashboardUpcomingPaymentsZone";
import DashboardZoneView from "./_components/DashboardZoneView";
import { parseDashboardRangeSelection, type DashboardSearchParams } from "./_utils/dashboardRangeParams";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<DashboardSearchParams>;
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

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const [{ locale }, resolvedSearchParams, session] = await Promise.all([params, searchParams, getSession()]);

  // The (app) layout guarantees an authenticated session before this renders; narrow for types.
  if (!session) {
    return null;
  }

  // The range control writes its selection to the URL, so the trend series are resolved server-side.
  const rangeSelection = parseDashboardRangeSelection(resolvedSearchParams);

  const [t, data, collectorPrefs, catalogCountryCodes, catalogProductTypeKeys] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getDashboardData(session.user.id, rangeSelection),
    getCollectorPreferencesSnapshot(session.user.id),
    listCountryCodes(prisma),
    listActiveStoreProductTypeKeys(prisma),
  ]);

  // Links into the public store listing must be preference-driven, like the shell nav (FR-06-16).
  const storesHref = buildStoresNavHref(
    locale,
    {
      preferredCountryCode: collectorPrefs?.preferredCountryCode ?? null,
      preferredProductTypeKeys: collectorPrefs?.preferredProductTypeKeys ?? [],
    },
    {
      activeCountryCodes: new Set(catalogCountryCodes.map((row) => row.code)),
      activeProductTypeKeys: new Set(catalogProductTypeKeys.map((row) => row.key)),
    },
  );

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
        <div className="lg:col-span-12">
          <DashboardKpiStrip data={data} locale={locale} />
        </div>
        <div className="lg:col-span-8">
          <DashboardCashZone data={data} locale={locale} />
        </div>
        {/* Right column of the top row: budget over arrival punctuality. */}
        <div className="flex flex-col gap-[18px] lg:col-span-4">
          <DashboardBudgetZone data={data} locale={locale} />
          <DashboardPunctualityZone data={data} locale={locale} />
        </div>
        <div className="lg:col-span-12">
          <DashboardTrendsSection data={data} locale={locale} selection={rangeSelection} />
        </div>
        <div className="lg:col-span-6">
          <DashboardActivityZone data={data} locale={locale} />
        </div>
        <div className="lg:col-span-6">
          <DashboardUpcomingPaymentsZone data={data} locale={locale} />
        </div>
        <div className="lg:col-span-12">
          <DashboardCollectionZone data={data} locale={locale} storesHref={storesHref} />
        </div>
      </div>
    </div>
  );
}
