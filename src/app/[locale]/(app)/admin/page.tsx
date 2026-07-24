import { CheckCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import EmptyState from "@/components/modules/EmptyState";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import { getModerationQueue, resolveSelectedItem } from "@/lib/data/admin/moderationQueueQueries";
import AdminSpaceEnteredCapture from "./_components/AdminSpaceEnteredCapture";
import ModerationInbox from "./_components/ModerationInbox";

type AdminPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ item?: string }>;
};

export async function generateMetadata({ params }: AdminPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("meta.landingTitle"), robots: { index: false, follow: false } };
}

/**
 * Moderation inbox. Server Component that reads the impact-ordered aggregate and resolves the selected
 * item from `?item=<type>:<id>` (auto-previewing the top item when none is given, mirroring the audit
 * `?page=N` pattern). It renders the master-detail console when anything is pending and a success-toned
 * empty state otherwise.
 */
export default async function AdminPage({ params, searchParams }: AdminPageProps) {
  const { locale } = await params;
  const { item } = await searchParams;
  const t = await getTranslations({ locale, namespace: "admin" });

  const queue = await getModerationQueue();
  const selectedItem = resolveSelectedItem(queue.items, item);

  return (
    <>
      <SetHeaderTitle title={t("nav.moderation")} />
      <AdminSpaceEnteredCapture />
      {selectedItem === null ? (
        <EmptyState
          appearance="card"
          icon={<CheckCheck className="h-7 w-7" aria-hidden />}
          iconTone="accent"
          title={t("inbox.empty.title")}
          subtitle={t("inbox.empty.subtitle")}
        />
      ) : (
        <ModerationInbox
          queue={queue}
          selectedItem={selectedItem}
          hasExplicitSelection={Boolean(item)}
          locale={locale}
        />
      )}
    </>
  );
}
