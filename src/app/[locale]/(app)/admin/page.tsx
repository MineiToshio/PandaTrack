import { Shield } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import EmptyState from "@/components/modules/EmptyState";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import AdminSpaceEnteredCapture from "./_components/AdminSpaceEnteredCapture";

type AdminPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AdminPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("meta.landingTitle"), robots: { index: false, follow: false } };
}

/**
 * Admin space landing. This slice renders a stub inside the inherited collector App Shell; the
 * prioritized moderation inbox fills it in a later slice. The header title and the on-mount
 * analytics island frame the space so it reads as a section of the app, not a separate mini-app.
 */
export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <>
      <SetHeaderTitle title={t("nav.moderation")} />
      <AdminSpaceEnteredCapture />
      <EmptyState
        appearance="card"
        icon={<Shield className="h-7 w-7" aria-hidden />}
        iconTone="accent"
        title={t("landing.title")}
        subtitle={t("landing.placeholder")}
      />
    </>
  );
}
