import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import EmptyState from "@/components/modules/EmptyState";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";

type AdminAuditPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AdminAuditPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("meta.auditTitle"), robots: { index: false, follow: false } };
}

/**
 * Admin audit route. This slice renders a stub inside the inherited collector App Shell; the
 * read-only audit-log table fills it in a later slice.
 */
export default async function AdminAuditPage({ params }: AdminAuditPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <>
      <SetHeaderTitle title={t("nav.audit")} />
      <EmptyState
        appearance="card"
        icon={<ScrollText className="h-7 w-7" aria-hidden />}
        iconTone="neutral"
        title={t("audit.title")}
        subtitle={t("audit.placeholder")}
      />
    </>
  );
}
