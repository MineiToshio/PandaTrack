import { getTranslations } from "next-intl/server";
import type { AuditLogEntry } from "@/lib/data/admin/adminAuditQueries";
import { formatAuditInstant } from "@/lib/formatAuditInstant";
import { cn } from "@/lib/styles";
import { auditActionTitleKey, auditTargetTypeLabelKey } from "../_utils/auditRowView";

type AuditLogTableProps = {
  entries: AuditLogEntry[];
  locale: string;
};

const HEADER_CELL_CLASS = cn(
  "px-4 py-3 text-left align-middle",
  "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] uppercase [letter-spacing:0.06em]",
  "[font-weight:var(--font-weight-semibold)] [color:var(--text-muted)]",
  "[border-bottom:1px_solid_var(--border)] [background:var(--surface-elevated)]",
);

const BODY_CELL_CLASS = cn(
  "px-4 py-3 align-middle [font-size:var(--text-body)]",
  "[color:var(--text-secondary)] [border-bottom:1px_solid_var(--border)]",
);

const MONO_CLASS = "[font-family:var(--font-mono)] [letter-spacing:0.04em] [font-weight:var(--font-weight-medium)]";

/**
 * Read-only audit log table (newest first). Semantic `<table>` inside its own horizontally
 * scrollable container so the page body never scrolls sideways on narrow viewports. Columns:
 * Cuando (UTC instant), Admin (actor username), Accion (raw action key), Objetivo (target type
 * label plus id), Motivo (reason, or the null placeholder when absent).
 */
export default async function AuditLogTable({ entries, locale }: AuditLogTableProps) {
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <div className="overflow-x-auto rounded-[var(--radius-xl)] [box-shadow:var(--elevation-1)] [background:var(--surface)] [border:1px_solid_var(--border)]">
      <table className="w-full min-w-[640px] border-collapse [font-size:var(--text-body)]">
        <caption className="sr-only">{t("audit.tableLabel")}</caption>
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("audit.columns.when")}
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("audit.columns.admin")}
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("audit.columns.action")}
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("audit.columns.target")}
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("audit.columns.reason")}
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {entries.map((entry) => (
            // `data-created-at` exposes the raw instant so ordering is verifiable without parsing
            // the localized cell text (used by the audit-viewer E2E to assert newest-first order).
            <tr key={entry.id} data-created-at={entry.createdAt.toISOString()}>
              <td className={cn(BODY_CELL_CLASS, "whitespace-nowrap [color:var(--text-muted)] tabular-nums")}>
                {formatAuditInstant(entry.createdAt, locale)}{" "}
                <span className="[color:var(--text-muted)]">{t("audit.utcLabel")}</span>
              </td>
              <td className={BODY_CELL_CLASS}>
                <span className="[color:var(--text-primary)]" title={entry.actor.name}>
                  {entry.actor.username}
                </span>
              </td>
              <td className={BODY_CELL_CLASS}>
                <span
                  className={cn(MONO_CLASS, "[color:var(--text-primary)]")}
                  title={t(auditActionTitleKey(entry.action))}
                >
                  {entry.action}
                </span>
              </td>
              <td className={BODY_CELL_CLASS}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="[font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">
                    {t(auditTargetTypeLabelKey(entry.targetType))}
                  </span>
                  <span
                    className={cn(MONO_CLASS, "block max-w-[22ch] truncate [color:var(--text-muted)]")}
                    title={entry.targetId}
                  >
                    {entry.targetId}
                  </span>
                </div>
              </td>
              <td className={BODY_CELL_CLASS}>{entry.reason ? entry.reason : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
