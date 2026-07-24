import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import BackNavLink from "@/components/core/BackNavLink";
import SettingsAccountPane from "@/app/[locale]/(app)/settings/_components/SettingsAccountPane";
import SettingsPrefsPane from "@/app/[locale]/(app)/settings/_components/SettingsPrefsPane";
import SettingsProfilePane from "@/app/[locale]/(app)/settings/_components/SettingsProfilePane";
import SettingsShell from "@/app/[locale]/(app)/settings/_components/SettingsShell";
import { getSession } from "@/lib/auth/auth-server";
import { getAccountCapabilitiesForUser } from "@/lib/auth/accountCapabilities";
import { buildPageMetadata } from "@/lib/seo";
import { getSettingsPageSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { getNotificationPreferences } from "@/lib/data/notifications/notificationQueries";
import { NotificationType } from "../../../../../generated/prisma/client";
import { RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
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

  const [t, userSnapshot, capabilities, notificationPreferences] = await Promise.all([
    getTranslations({ locale, namespace: "settings" }),
    getSettingsPageSnapshot(session.user.id),
    getAccountCapabilitiesForUser(session.user.id),
    getNotificationPreferences(session.user.id),
  ]);

  if (!userSnapshot) {
    return null;
  }

  return (
    <div className="text-foreground">
      {returnToOrderCreate ? (
        <div className="mb-3">
          <BackNavLink href={`/${locale}${ROUTES.ordersNew}`}>{t("returnToOrderCreate")}</BackNavLink>
        </div>
      ) : null}

      <h1 className="sr-only">{t("title")}</h1>

      <SettingsShell
        profilePane={
          <SettingsProfilePane
            initialUsername={userSnapshot.username}
            initialDisplayName={userSnapshot.name}
            initialImageUrl={userSnapshot.image}
            usernameChangedAt={userSnapshot.usernameChangedAt}
          />
        }
        accountPane={
          <SettingsAccountPane
            locale={locale}
            initialEmail={userSnapshot.email}
            emailVerified={userSnapshot.emailVerified}
            capabilities={capabilities}
            passwordChangedAt={userSnapshot.passwordChangedAt}
          />
        }
        preferencesPane={
          <SettingsPrefsPane
            locale={locale}
            initialCountryCode={userSnapshot.preferredCountryCode}
            initialCurrencyCode={userSnapshot.baseCurrencyCode}
            initialProductTypeKeys={userSnapshot.preferredProductTypeKeys}
            initialBudgetAmount={userSnapshot.budgetAmount}
            initialBudgetResetDayOfMonth={userSnapshot.budgetResetDayOfMonth}
            initialNotificationPreferences={{
              PAYMENT_DUE: notificationPreferences[NotificationType.PAYMENT_DUE],
              ARRIVAL_DUE: notificationPreferences[NotificationType.ARRIVAL_DUE],
              ARRIVAL_OVERDUE: notificationPreferences[NotificationType.ARRIVAL_OVERDUE],
              STORE_REJECTED: notificationPreferences[NotificationType.STORE_REJECTED],
            }}
          />
        }
      />
    </div>
  );
}
