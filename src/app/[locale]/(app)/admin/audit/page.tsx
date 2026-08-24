import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import EmptyState from "@/components/modules/EmptyState";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import { listAuditEntries } from "@/lib/data/admin/adminAuditQueries";
import AdminPager from "../_components/share/AdminPager";
import AuditLogTable from "./_components/AuditLogTable";
import AuditViewedCapture from "./_components/AuditViewedCapture";

type AdminAuditPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: AdminAuditPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("meta.auditTitle"), robots: { index: false, follow: false } };
}

/** Parse the 1-based `?page=N` param; anything non-numeric falls back to page 1. */
function parsePageParam(rawPage: string | undefined): number {
  const parsed = Number.parseInt(rawPage ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Admin audit route: a read-only, server-rendered view over `AdminAuditLog`, newest first, with
 * offset pagination via `?page=N` (page replacement, server round-trip). The read comes solely from
 * `listAuditEntries`; the only client island is the on-mount analytics capture.
 */
export default async function AdminAuditPage({ params, searchParams }: AdminAuditPageProps) {
  const { locale } = await params;
  const { page } = await searchParams;
  const t = await getTranslations({ locale, namespace: "admin" });

  const { items, totalPages, currentPage, totalCount } = await listAuditEntries({ page: parsePageParam(page) });

  return (
    <>
      <SetHeaderTitle title={t("nav.audit")} />
      <AuditViewedCapture />
      {totalCount === 0 ? (
        <EmptyState
          appearance="card"
          icon={<ScrollText className="h-7 w-7" aria-hidden />}
          iconTone="neutral"
          title={t("audit.empty.title")}
          subtitle={t("audit.empty.subtitle")}
        />
      ) : (
        <section className="flex flex-col gap-4">
          <AuditLogTable entries={items} locale={locale} />
          {totalPages > 1 && (
            <AdminPager
              currentPage={currentPage}
              totalPages={totalPages}
              regionLabel={t("audit.pagination.regionLabel")}
              olderLabel={t("audit.pagination.older")}
              newerLabel={t("audit.pagination.newer")}
            />
          )}
        </section>
      )}
    </>
  );
}
