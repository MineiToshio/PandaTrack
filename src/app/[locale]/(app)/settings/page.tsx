import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import AppPageHero from "@/components/modules/AppPageHero";
import SettingsAccountSection from "@/app/[locale]/(app)/settings/_components/SettingsAccountSection";
import { getSession } from "@/lib/auth/auth-server";
import { getAccountCapabilitiesForUser } from "@/lib/auth/accountCapabilities";
import { buildPageMetadata } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { SETTINGS_SECTION_SURFACE_CLASSNAME } from "@/app/[locale]/(app)/settings/settingsSectionChrome";
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
    <div className="text-foreground">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <AppPageHero eyebrow={t("hero.eyebrow")} title={t("title")} description={t("intro")} />

        <section className={SETTINGS_SECTION_SURFACE_CLASSNAME} aria-labelledby="settings-profile-heading">
          <Heading id="settings-profile-heading" as="h2" size="xs" className="text-text-title">
            {t("profile.title")}
          </Heading>
          <div className="border-border/55 bg-muted/32 mt-4 rounded-xl border p-4">
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
          <Heading id="settings-preferences-heading" as="h2" size="xs" className="text-text-title">
            {t("preferences.title")}
          </Heading>
          <div className="border-border/55 bg-muted/32 mt-4 rounded-xl border p-4">
            <Typography size="sm" className="text-text-body">
              {t("preferences.placeholder")}
            </Typography>
          </div>
        </section>
      </div>
    </div>
  );
}
