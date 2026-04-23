import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppPageHero from "@/components/modules/AppPageHero";
import SettingsAccountSection from "@/app/[locale]/(app)/settings/_components/SettingsAccountSection";
import SettingsProfileSection from "@/app/[locale]/(app)/settings/_components/SettingsProfileSection";
import SettingsPreferencesSection from "@/app/[locale]/(app)/settings/_components/SettingsPreferencesSection";
import { getSession } from "@/lib/auth/auth-server";
import { getAccountCapabilitiesForUser } from "@/lib/auth/accountCapabilities";
import { buildPageMetadata } from "@/lib/seo";
import { getSettingsPageSnapshot } from "@/queries/userSettings";
import BackNavLink from "@/components/core/BackNavLink";
import { APP_SHELL_FORM_RAIL_CLASSNAME, RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { isLocale } from "@/types/locale";

type SettingsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export async function generateMetadata({ params }: SettingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "settings",
    pathSegment: "settings",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  });
}

export default async function SettingsPage({ params, searchParams }: SettingsPageProps) {
  const { locale: localeParam } = await params;
  const resolvedSearchParams = await searchParams;
  const returnToRaw = resolvedSearchParams.returnTo;
  const returnToValue = Array.isArray(returnToRaw) ? returnToRaw[0] : returnToRaw;
  const returnToOrderCreate = returnToValue === RETURN_TO_ORDER_CREATE;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale = localeParam;
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

  const [t, userSnapshot, capabilities] = await Promise.all([
    getTranslations({ locale, namespace: "settings" }),
    getSettingsPageSnapshot(session.user.id),
    getAccountCapabilitiesForUser(session.user.id),
  ]);

  if (!userSnapshot) {
    return null;
  }

  return (
    <div className="text-foreground">
      <div className={cn(APP_SHELL_FORM_RAIL_CLASSNAME, "space-y-6")}>
        <div className="space-y-3">
          {returnToOrderCreate ? (
            <BackNavLink href={`/${locale}${ROUTES.purchasesNew}`}>{t("returnToOrderCreate")}</BackNavLink>
          ) : null}
          <AppPageHero eyebrow={t("hero.eyebrow")} title={t("title")} description={t("intro")} />
        </div>

        <SettingsProfileSection
          locale={locale}
          initialUsername={userSnapshot.username}
          initialDisplayName={userSnapshot.name}
          initialImageUrl={userSnapshot.image}
        />

        <SettingsAccountSection
          locale={locale}
          initialEmail={userSnapshot.email}
          emailVerified={userSnapshot.emailVerified}
          capabilities={capabilities}
        />

        <SettingsPreferencesSection
          initialCountryCode={userSnapshot.preferredCountryCode}
          initialCurrencyCode={userSnapshot.baseCurrencyCode}
          initialProductTypeKeys={userSnapshot.preferredProductTypeKeys}
          initialBudgetAmount={userSnapshot.budgetAmount}
          initialBudgetResetDayOfMonth={userSnapshot.budgetResetDayOfMonth}
          redirectToOrderCreateAfterSave={returnToOrderCreate}
        />
      </div>
    </div>
  );
}
