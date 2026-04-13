import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Typography from "@/components/core/Typography";
import AppPageHero from "@/components/modules/AppPageHero";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import SettingsAccountSection from "@/app/[locale]/(app)/settings/_components/SettingsAccountSection";
import { getSession } from "@/lib/auth/auth-server";
import { getAccountCapabilitiesForUser } from "@/lib/auth/accountCapabilities";
import { buildPageMetadata } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { SETTINGS_SECTION_SURFACE_CLASSNAME } from "@/app/[locale]/(app)/settings/settingsSectionChrome";
import { COLLECTOR_MUTED_INSET_CLASSNAME, cn } from "@/lib/styles";
import { isLocale } from "@/types/locale";

type SettingsPageProps = {
  params: Promise<{ locale: string }>;
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

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale = localeParam;
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

  const [t, userRow, capabilities] = await Promise.all([
    getTranslations({ locale, namespace: "settings" }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, emailVerified: true },
    }),
    getAccountCapabilitiesForUser(session.user.id),
  ]);

  if (!userRow) {
    return null;
  }

  return (
    <div className="text-foreground space-y-8">
      <AppPageHero eyebrow={t("hero.eyebrow")} title={t("title")} description={t("intro")} />

      <section className={SETTINGS_SECTION_SURFACE_CLASSNAME} aria-labelledby="settings-profile-heading">
        <SectionTitleWithAccent id="settings-profile-heading" as="h2">
          {t("profile.title")}
        </SectionTitleWithAccent>
        <div className={cn(COLLECTOR_MUTED_INSET_CLASSNAME, "mt-4")}>
          <Typography size="sm" className="text-text-body">
            {t("profile.placeholder")}
          </Typography>
        </div>
      </section>

      <SettingsAccountSection
        locale={locale}
        initialEmail={userRow.email}
        emailVerified={userRow.emailVerified}
        capabilities={capabilities}
      />

      <section className={SETTINGS_SECTION_SURFACE_CLASSNAME} aria-labelledby="settings-preferences-heading">
        <SectionTitleWithAccent id="settings-preferences-heading" as="h2">
          {t("preferences.title")}
        </SectionTitleWithAccent>
        <div className={cn(COLLECTOR_MUTED_INSET_CLASSNAME, "mt-4")}>
          <Typography size="sm" className="text-text-body">
            {t("preferences.placeholder")}
          </Typography>
        </div>
      </section>
    </div>
  );
}
