import { getTranslations } from "next-intl/server";
import Chip from "@/components/core/Chip";
import { formatDomainDate } from "@/lib/domainDate";
import type { PointLedgerEntryDto } from "@/lib/data/progression/progressionQueries";
import { cn } from "@/lib/styles";
import { pointLedgerSourceLabelKey, pointRuleLabelKey, progressionEntityTypeLabelKey } from "../_utils/ledgerRowView";

type PointLedgerTableProps = {
  entries: PointLedgerEntryDto[];
  locale: string;
};

const HEADER_CELL_CLASS = cn(
  "px-4 py-3 text-left align-middle",
  "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] uppercase [letter-spacing:0.06em]",
  "[font-weight:var(--font-weight-semibold)] [color:var(--text-muted)]",
  // Same header tint as `AuditLogTable` / `OrdersTable`: a neutral mix over the shell fill.
  "[border-bottom:1px_solid_var(--border)] [background:color-mix(in_oklab,var(--text-primary)_3%,var(--surface-elevated))]",
);

const BODY_CELL_CLASS = cn(
  "px-4 py-3 align-middle [font-size:var(--text-body)]",
  "[color:var(--text-secondary)] [border-bottom:1px_solid_var(--border)]",
);

const MONO_CLASS = "[font-family:var(--font-mono)] [letter-spacing:0.04em] [font-weight:var(--font-weight-medium)]";

/**
 * Read-only point ledger for one collector, newest first. Semantic `<table>` inside its own
 * horizontally scrollable container so the page body never scrolls sideways on narrow viewports.
 *
 * `ruleKey` and `entityType` render as the raw stored value in mono with the translated label as the
 * tooltip, the same forensic treatment `AuditLogTable` gives `action` / `targetType`: an
 * administrator reading a ledger to decide whether to reverse it needs the value that is actually in
 * the row, not a paraphrase that could drift from it.
 *
 * `occurredOn` is a civil day (stored at UTC midnight), so it goes through `formatDomainDate` and
 * never through the audit instant formatter. `createdAt` is deliberately not a column: the day the
 * fact happened is what the rules price, and showing both invites reading the wrong one.
 */
export default async function PointLedgerTable({ entries, locale }: PointLedgerTableProps) {
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <div className="overflow-x-auto rounded-[var(--radius-xl)] [box-shadow:var(--elevation-1)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <table className="w-full min-w-[720px] border-collapse [font-size:var(--text-body)]">
        <caption className="sr-only">{t("progression.ledger.tableLabel")}</caption>
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("progression.ledger.columns.when")}
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("progression.ledger.columns.rule")}
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("progression.ledger.columns.entity")}
            </th>
            <th scope="col" className={cn(HEADER_CELL_CLASS, "text-right")}>
              {t("progression.ledger.columns.points")}
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("progression.ledger.columns.source")}
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              {t("progression.ledger.columns.state")}
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {entries.map((entry) => (
            // `data-occurred-on` exposes the raw civil day so ordering stays verifiable without
            // parsing the localized cell text.
            <tr key={entry.id} data-occurred-on={entry.occurredOn.toISOString()}>
              <td className={cn(BODY_CELL_CLASS, "whitespace-nowrap [color:var(--text-muted)] tabular-nums")}>
                {formatDomainDate(entry.occurredOn, locale)}
              </td>
              <td className={BODY_CELL_CLASS}>
                <span
                  className={cn(MONO_CLASS, "[color:var(--text-primary)]")}
                  title={t(pointRuleLabelKey(entry.ruleKey))}
                >
                  {entry.ruleKey}
                </span>
              </td>
              <td className={BODY_CELL_CLASS}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="[font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">
                    {t(progressionEntityTypeLabelKey(entry.entityType))}
                  </span>
                  <span
                    className={cn(MONO_CLASS, "block max-w-[22ch] truncate [color:var(--text-muted)]")}
                    title={entry.entityId}
                  >
                    {entry.entityId}
                  </span>
                </div>
              </td>
              <td
                className={cn(
                  BODY_CELL_CLASS,
                  "text-right [font-weight:var(--font-weight-semibold)] tabular-nums",
                  entry.voidedAt ? "[color:var(--text-muted)] line-through" : "[color:var(--text-primary)]",
                )}
              >
                {entry.points}
              </td>
              <td className={BODY_CELL_CLASS}>{t(pointLedgerSourceLabelKey(entry.source))}</td>
              <td className={BODY_CELL_CLASS}>
                {entry.voidedAt ? (
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <Chip variant="destructive" size="sm">
                      {t("progression.ledger.voided")}
                    </Chip>
                    {entry.voidedReason && (
                      <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                        {entry.voidedReason}
                      </span>
                    )}
                  </div>
                ) : (
                  <Chip variant="neutral" size="sm">
                    {t("progression.ledger.live")}
                  </Chip>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
