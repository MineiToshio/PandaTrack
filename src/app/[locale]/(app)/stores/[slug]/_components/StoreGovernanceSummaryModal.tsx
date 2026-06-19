"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Flag, GitPullRequestArrow, MessageSquareWarning, Pencil, Scale, Users } from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import { getPosthogDataAttributes } from "@/lib/analytics/posthogDataAttributes";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { StoreGovernanceSummary, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import StoreReportModal from "./StoreReportModal";

type StoreGovernanceSummaryModalProps = {
  locale: string;
  storeSlug: string;
  storeName: string;
  summary: StoreGovernanceSummary;
  /**
   * Trigger surface variant.
   *  - `banner` (default): thin info-tinted banner (see the Stores prototype at `docs/product/prd-02-collector-app/frd-04-store-domain/prototype/store-domain.html`).
   *  - `card`: legacy detail-card surface with warning Scale icon and full title/description.
   */
  triggerVariant?: "banner" | "card";
  /** Only used by the legacy `card` trigger — adds a top separator above the trigger when `true`. */
  showTopSeparator?: boolean;
  viewerOpenReport: StoreGovernanceViewerContext["openReport"];
  viewerOpenChangeRequest: StoreGovernanceViewerContext["openChangeRequest"];
};

export default function StoreGovernanceSummaryModal({
  locale,
  storeSlug,
  storeName,
  summary,
  triggerVariant = "banner",
  showTopSeparator = false,
  viewerOpenReport,
  viewerOpenChangeRequest,
}: StoreGovernanceSummaryModalProps) {
  const t = useTranslations("stores");
  const [isOpen, setIsOpen] = useState(false);
  const [reportModalOpenRequest, setReportModalOpenRequest] = useState(0);

  const viewerChangeFieldKeys = useMemo(() => {
    if (!viewerOpenChangeRequest) return [];
    return Object.keys(viewerOpenChangeRequest.changes ?? {});
  }, [viewerOpenChangeRequest]);

  const viewerChangeUpdatedLabel = useMemo(() => {
    if (!viewerOpenChangeRequest) return null;
    return formatRelativeShort(locale, new Date(viewerOpenChangeRequest.updatedAt));
  }, [locale, viewerOpenChangeRequest]);

  const viewerReportCreatedLabel = useMemo(() => {
    if (!viewerOpenReport) return null;
    return formatRelativeShort(locale, new Date(viewerOpenReport.createdAt));
  }, [locale, viewerOpenReport]);

  const storeEditHref = `/${locale}${ROUTES.stores}/${storeSlug}/edit`;
  const continueChangeRequestPhAttrs = getPosthogDataAttributes(
    POSTHOG_EVENTS.STORE.GOVERNANCE_SUMMARY_CONTINUE_CHANGE_REQUEST_CLICKED,
    { store_slug: storeSlug },
  );

  const reportReasonsWithActivity = useMemo(
    () => summary.reportCounts.filter((item) => item.count > 0).sort((a, b) => b.count - a.count),
    [summary.reportCounts],
  );

  // Aggregate community change-request fields across recent pending requests so the
  // community panel can summarize "Campos modificados: …".
  const communityChangeFields = useMemo(() => {
    const seen = new Set<string>();
    summary.recentChangeRequests.forEach((req) => {
      req.changedFieldKeys.forEach((key) => seen.add(key));
    });
    return Array.from(seen);
  }, [summary.recentChangeRequests]);

  const mostRecentChangeUpdatedLabel = useMemo(() => {
    const newest = summary.recentChangeRequests[0];
    if (!newest) return null;
    return formatRelativeShort(locale, new Date(newest.updatedAt));
  }, [locale, summary.recentChangeRequests]);

  // The chip should reflect *pending* requests specifically, not the all-status total
  // which would silently include resolved/rejected ones. Approved/rejected requests
  // are historical and don't belong in a "pending" callout.
  const pendingChangeRequestsCount = useMemo(
    () => summary.changeRequestCounts.find((item) => item.status === "PENDING")?.count ?? 0,
    [summary.changeRequestCounts],
  );

  const hasCommunityChangeRequests = pendingChangeRequestsCount > 0;
  // The community section's pending count includes the viewer's own request when present,
  // so we surface that fact in the caption instead of letting the user infer it.
  const communityIncludesViewerChangeRequest = viewerOpenChangeRequest != null && hasCommunityChangeRequests;
  const hasAnyContent =
    viewerOpenReport != null ||
    summary.totalReports > 0 ||
    viewerOpenChangeRequest != null ||
    hasCommunityChangeRequests;

  const handleOpenReportEditor = () => {
    setIsOpen(false);
    setReportModalOpenRequest((current) => current + 1);
  };

  const handleOpenModal = () => {
    setIsOpen(true);
    posthog.capture(POSTHOG_EVENTS.STORE.GOVERNANCE_SUMMARY_OPENED, {
      store_slug: storeSlug,
      total_reports: summary.totalReports,
      total_change_requests: summary.totalChangeRequests,
    });
  };

  return (
    <>
      {triggerVariant === "banner" ? (
        <div
          role="note"
          className="flex flex-wrap items-center gap-2.5 rounded-[10px] px-3.5 py-3 [background:color-mix(in_oklch,var(--info)_9%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--info)_22%,transparent)]"
        >
          <MessageSquareWarning size={16} aria-hidden className="shrink-0 [color:var(--info)]" />
          <Typography size="sm" className="text-text-secondary min-w-[180px] flex-1">
            {t("redesign.detail.governanceBanner.summary", {
              reportCount: summary.totalReports,
              changeRequestCount: summary.totalChangeRequests,
            })}
          </Typography>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={handleOpenModal}>
            {t("redesign.detail.governanceBanner.viewSummary")}
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
            showTopSeparator && "border-border/50 mt-4 border-t pt-4",
          )}
          role="note"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <Scale className="text-warning mt-1 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <Typography size="sm" className="text-text-title font-semibold">
                {t("detail.governanceAlertTitle")}
              </Typography>
              <Typography size="xs" className="text-text-body mt-1">
                {t("detail.governanceAlertMessage")}
              </Typography>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="border-warning/35 bg-warning/12 text-text-title hover:bg-warning/18 shrink-0 sm:mt-0.5"
            onClick={handleOpenModal}
          >
            {t("governance.summary.openCta")}
          </Button>
        </div>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("governance.summary.title")}
        description={t("governance.summary.description")}
        icon={<MessageSquareWarning size={20} aria-hidden="true" />}
        tone="info"
        closeButtonLabel={t("governance.report.cancelCta")}
        // The Modal's default `pb-1` body assumes a footer below; this modal has no
        // primary/secondary actions, so we restore proper bottom breathing room.
        bodyClassName="pb-6"
      >
        {hasAnyContent ? (
          <div className="space-y-5">
            {/* ─── Tu reporte ───────────────────────────────────────────────── */}
            {viewerOpenReport && (
              <SectionGroup
                icon={<Flag size={14} aria-hidden="true" />}
                eyebrow={t("governance.summary.yourReportEyebrow")}
              >
                <div className="space-y-2.5 rounded-[10px] px-3.5 py-3 [background:color-mix(in_oklch,var(--warning)_9%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--warning)_22%,transparent)]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 [font-size:11px] [font-weight:500] [color:var(--warning)] [background:color-mix(in_oklch,var(--warning)_14%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--warning)_25%,transparent)]">
                      {t(`governance.report.reasonOptions.${viewerOpenReport.reason}`)}
                    </span>
                    {viewerReportCreatedLabel && (
                      <span className="shrink-0 [font-size:11px] [color:var(--text-muted)]">
                        {viewerReportCreatedLabel}
                      </span>
                    )}
                  </div>
                  {viewerOpenReport.details && (
                    <p className="m-0 [font-size:13px] [line-height:1.5] [color:var(--text-secondary)]">
                      &ldquo;{viewerOpenReport.details}&rdquo;
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-warning hover:bg-warning/10"
                    leadingIcon={<Pencil size={11} aria-hidden="true" />}
                    onClick={handleOpenReportEditor}
                  >
                    {t("governance.report.updateCta")}
                  </Button>
                </div>
              </SectionGroup>
            )}

            {/* ─── Reportes de la comunidad ──────────────────────────────── */}
            {summary.totalReports > 0 && (
              <SectionGroup
                icon={<Users size={14} aria-hidden="true" />}
                eyebrow={t("governance.summary.reportSectionTitle")}
              >
                {reportReasonsWithActivity.length > 0 && (
                  <div className="overflow-hidden rounded-[10px] [background:var(--surface)] [border:1px_solid_var(--border)]">
                    {reportReasonsWithActivity.map((item, index) => (
                      <div
                        key={item.reason}
                        className={cn(
                          "flex items-center justify-between px-3.5 py-2.5 [font-size:13px]",
                          index < reportReasonsWithActivity.length - 1 && "[border-bottom:1px_solid_var(--border)]",
                        )}
                      >
                        <span className="[color:var(--text-secondary)]">
                          {t(`governance.report.reasonOptions.${item.reason}`)}
                        </span>
                        <span className="inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 [font-size:11px] [font-weight:500] [color:var(--text-secondary)] tabular-nums [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="m-0 mt-2 [font-size:11.5px] [color:var(--text-muted)]">
                  {t("governance.summary.communityPrivacyNote")}
                </p>
              </SectionGroup>
            )}

            {/* ─── Tu solicitud de cambio ───────────────────────────────── */}
            {viewerOpenChangeRequest && (
              <SectionGroup
                icon={<GitPullRequestArrow size={14} aria-hidden="true" />}
                eyebrow={t("governance.summary.yourChangeRequestEyebrow")}
              >
                <div className="space-y-2.5 rounded-[10px] px-3.5 py-3 [background:color-mix(in_oklch,var(--accent)_6%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_18%,transparent)]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 [font-size:11px] [font-weight:500] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_12%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_25%,transparent)]">
                      {t("governance.summary.yourPendingChangeRequestStatus")}
                    </span>
                    {viewerChangeUpdatedLabel && (
                      <span className="shrink-0 [font-size:11px] [color:var(--text-muted)]">
                        {viewerChangeUpdatedLabel}
                      </span>
                    )}
                  </div>
                  <p className="m-0 [font-size:13px] [line-height:1.5] [color:var(--text-secondary)]">
                    <span className="[font-weight:500] [color:var(--text-primary)]">
                      {t("governance.summary.modifiedFieldsLabel")}:
                    </span>{" "}
                    {viewerChangeFieldKeys.length > 0
                      ? viewerChangeFieldKeys
                          .map((fieldKey) => t(`governance.summary.fieldLabels.${fieldKey}`))
                          .join(", ")
                      : t("governance.summary.noChangedFields")}
                  </p>
                  <Link
                    href={storeEditHref}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "text-accent hover:bg-accent/10 inline-flex gap-1.5 self-start",
                    )}
                    {...continueChangeRequestPhAttrs}
                  >
                    <Pencil size={11} aria-hidden />
                    <span>{t("governance.summary.yourPendingChangeRequestEditCta")}</span>
                  </Link>
                </div>
              </SectionGroup>
            )}

            {/* ─── Solicitudes de cambio de la comunidad ────────────────── */}
            {hasCommunityChangeRequests && (
              <SectionGroup
                icon={<Users size={14} aria-hidden="true" />}
                eyebrow={t("governance.summary.changeRequestSectionTitle")}
              >
                <div className="space-y-2.5 rounded-[10px] px-3.5 py-3 [background:var(--surface)] [border:1px_solid_var(--border)]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 [font-size:11px] [font-weight:500] [color:var(--info)] [background:color-mix(in_oklch,var(--info)_12%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--info)_25%,transparent)]">
                      {t("governance.summary.pendingCountChip", { count: pendingChangeRequestsCount })}
                    </span>
                    {mostRecentChangeUpdatedLabel && (
                      <span className="shrink-0 [font-size:11px] [color:var(--text-muted)]">
                        {mostRecentChangeUpdatedLabel}
                      </span>
                    )}
                  </div>
                  {communityChangeFields.length > 0 && (
                    <p className="m-0 [font-size:13px] [line-height:1.5] [color:var(--text-secondary)]">
                      <span className="[font-weight:500] [color:var(--text-primary)]">
                        {t("governance.summary.modifiedFieldsLabel")}:
                      </span>{" "}
                      {communityChangeFields
                        .map((fieldKey) => t(`governance.summary.fieldLabels.${fieldKey}`))
                        .join(", ")}
                    </p>
                  )}
                </div>
                {communityIncludesViewerChangeRequest && (
                  <p className="m-0 mt-2 [font-size:11.5px] [color:var(--text-muted)]">
                    {t("governance.summary.includesYourChangeRequest")}
                  </p>
                )}
              </SectionGroup>
            )}
          </div>
        ) : (
          <Typography size="xs" className="text-text-muted">
            {t("governance.summary.empty")}
          </Typography>
        )}
      </Modal>

      {viewerOpenReport ? (
        <StoreReportModal
          locale={locale}
          storeSlug={storeSlug}
          storeName={storeName}
          existingReport={viewerOpenReport}
          hideTrigger
          openRequestNonce={reportModalOpenRequest}
        />
      ) : null}
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Section group with an icon + eyebrow heading row, then arbitrary panel content.
 * See the Stores prototype at `docs/product/prd-02-collector-app/frd-04-store-domain/prototype/store-domain.html`.
 */
function SectionGroup({
  icon,
  eyebrow,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-1.5">
        <span aria-hidden="true" className="[color:var(--text-muted)]">
          {icon}
        </span>
        <span className="block [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [font-weight:var(--font-weight-mono)] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
          {eyebrow}
        </span>
      </div>
      {children}
    </section>
  );
}

/** Compact relative-time label (e.g. "hace 3 días", "hace 1 semana"). Falls back to medium date for older. */
function formatRelativeShort(locale: string, date: Date): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "long" });
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const absDays = Math.abs(diffDays);
  if (absDays < 1) return rtf.format(0, "day");
  if (absDays < 7) return rtf.format(diffDays, "day");
  if (absDays < 30) return rtf.format(Math.round(diffDays / 7), "week");
  if (absDays < 365) return rtf.format(Math.round(diffDays / 30), "month");
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}
