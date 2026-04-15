import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Typography from "@/components/core/Typography";
import AppPageHero from "@/components/modules/AppPageHero";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import SettingsAccountSection from "@/app/[locale]/(app)/settings/_components/SettingsAccountSection";
import SettingsProfileSection from "@/app/[locale]/(app)/settings/_components/SettingsProfileSection";
import { getSession } from "@/lib/auth/auth-server";
import { getAccountCapabilitiesForUser } from "@/lib/auth/accountCapabilities";
import { buildPageMetadata } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { APP_SHELL_FORM_RAIL_CLASSNAME } from "@/lib/constants";
import { SETTINGS_SECTION_SURFACE_CLASSNAME } from "@/app/[locale]/(app)/settings/settingsSectionChrome";
import { cn } from "@/lib/styles";
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
      select: { email: true, emailVerified: true, username: true, name: true, image: true },
    }),
    getAccountCapabilitiesForUser(session.user.id),
  ]);

  if (!userRow) {
    return null;
  }

  return (
    <div className="text-foreground">
      <div className={cn(APP_SHELL_FORM_RAIL_CLASSNAME, "space-y-6")}>
        <AppPageHero eyebrow={t("hero.eyebrow")} title={t("title")} description={t("intro")} />

        <SettingsProfileSection
          locale={locale}
          initialUsername={userRow.username}
          initialDisplayName={userRow.name}
          initialImageUrl={userRow.image}
        />

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
          <Typography size="sm" className="text-text-body mt-4">
            {t("preferences.placeholder")}
          </Typography>
        </section>
      </div>
    </div>
  );
}
