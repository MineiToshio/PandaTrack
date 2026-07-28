import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Flag, Lock, User } from "lucide-react";
import Chip from "@/components/core/Chip";
import type { AdminOpenStoreReport } from "@/lib/data/admin/adminStoreReportQueries";

/**
 * A single open report card: reason chip, the raw free-text detail, and the reporter identity. Both the
 * detail and the identity come from the server-only admin DAL and are marked "Solo visible para
 * administradores" (`BR-02-03`), never sourced from the public governance read model.
 *
 * `actions` is the per-report decision footer used by the report-cluster review, where each report is
 * resolved or dismissed on its own; the single-report review keeps its decisions in the review footer.
 */
export default async function ReportCard({
  report,
  locale,
  actions,
}: {
  report: AdminOpenStoreReport;
  locale: string;
  actions?: ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "admin.review" });

  return (
    <div className="border-border bg-surface flex flex-col gap-2 rounded-[var(--radius-md)] border p-3">
      <Chip variant="destructive" icon={<Flag className="size-3" aria-hidden />}>
        {t(`reportReason.${report.reason}`)}
      </Chip>
      {report.details && <p className="text-text-primary text-sm italic">&ldquo;{report.details}&rdquo;</p>}
      <div className="flex flex-wrap items-center gap-1.5 text-xs [color:var(--text-muted)]">
        <User className="size-3.5 shrink-0" aria-hidden />
        <span>{t("reportedBy")}</span>
        <span className="text-text-secondary font-medium">@{report.reporter.username}</span>
        <span className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 [color:var(--warning)] [background:color-mix(in_oklch,var(--warning)_12%,transparent)]">
          <Lock className="size-3" aria-hidden />
          {t("adminOnlyShort")}
        </span>
      </div>
      {actions != null && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
