"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Flag,
  GitPullRequestArrow,
  Lock,
  MessageSquareWarning,
  Pencil,
  Scale,
  ShieldAlert,
  Users,
} from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import { useToast } from "@/contexts/ToastContext";
import { getPosthogDataAttributes } from "@/lib/analytics/posthogDataAttributes";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { StoreGovernanceSummary, StoreGovernanceViewerContext } from "@/lib/data/stores/storeGovernanceQueries";
import type { AdminOpenStoreReport } from "@/lib/data/admin/adminStoreReportQueries";
import type {
  AdminChangeRequestScalarValue,
  AdminPendingStoreChangeRequest,
} from "@/lib/data/admin/adminStoreChangeRequestQueries";
import {
  dismissStoreReportAction,
  resolveStoreReportAction,
  type ModerateStoreReportResult,
} from "../_actions/moderateStoreReport";
import { applyStoreChangeRequestAction, rejectStoreChangeRequestAction } from "../_actions/moderateStoreChangeRequest";
import StoreReportModal from "./StoreReportModal";
import { useStoreReportNotice } from "./StoreReportNoticeProvider";

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
  /**
   * Open reports with reporter identity and raw free-text, present only when the viewer is an
   * administrator. When present, the admin resolution section renders; when absent (every non-admin
   * viewer), it does not and no admin data reaches the client.
   */
  adminReports?: AdminOpenStoreReport[];
  /**
   * Pending change requests with the rebased diff and requester identity, present only when the
   * viewer is an administrator. When present, the admin change-request review section renders; when
   * absent (every non-admin viewer), it does not and no admin data reaches the client.
   */
  adminChangeRequests?: AdminPendingStoreChangeRequest[];
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
  adminReports,
  adminChangeRequests,
}: StoreGovernanceSummaryModalProps) {
  const t = useTranslations("stores");
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [reportModalOpenRequest, setReportModalOpenRequest] = useState(0);
  // Optimistic resolution lives in the store-detail report-notice provider, because the same set
  // drives the derived public notice: hiding the row and clearing the banner are one update. On
  // failure the id is restored (row and notice both return); on success the server revalidation drops
  // it from `adminReports` for good. The modal stays open so several reports can be resolved in a row.
  const { pendingResolvedReportIds, markReportResolved, restoreReport } = useStoreReportNotice();
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  // Optimistic change-request review: an id here leaves the admin list immediately on action. On
  // failure it is restored; on success the server revalidation drops it from `adminChangeRequests`.
  // The modal stays open so several requests can be reviewed in a row (Optimistic Confirmation).
  const [pendingReviewedChangeRequestIds, setPendingReviewedChangeRequestIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [reviewingChangeRequestId, setReviewingChangeRequestId] = useState<string | null>(null);

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
  // Admin-only open reports still awaiting a resolution, minus any optimistically resolved this
  // session. Empty for every non-admin viewer (the prop is absent).
  const visibleAdminReports = useMemo(
    () => (adminReports ?? []).filter((report) => !pendingResolvedReportIds.has(report.id)),
    [adminReports, pendingResolvedReportIds],
  );

  // Admin-only pending change requests still awaiting review, minus any optimistically reviewed this
  // session. Empty for every non-admin viewer (the prop is absent).
  const visibleAdminChangeRequests = useMemo(
    () => (adminChangeRequests ?? []).filter((changeRequest) => !pendingReviewedChangeRequestIds.has(changeRequest.id)),
    [adminChangeRequests, pendingReviewedChangeRequestIds],
  );

  const hasAnyContent =
    viewerOpenReport != null ||
    summary.totalReports > 0 ||
    viewerOpenChangeRequest != null ||
    hasCommunityChangeRequests ||
    visibleAdminReports.length > 0 ||
    visibleAdminChangeRequests.length > 0;

  const translateReportError = (errorKey: string) =>
    t.has(`moderation.errors.${errorKey}`)
      ? t(`moderation.errors.${errorKey}`)
      : t("moderation.errors.moderationFailed");

  /**
   * Optimistic resolve / dismiss: hide the row and, when it was the store's last open report, the
   * derived notice with it; run the action; restore both and toast on failure. The action's
   * `openReportsRemaining` is what the notice settles on once the revalidated payload arrives.
   */
  const runReportResolution = async (
    reportId: string,
    action: () => Promise<ModerateStoreReportResult>,
    successToastKey: string,
  ) => {
    if (resolvingReportId != null) return;
    setResolvingReportId(reportId);
    markReportResolved(reportId);

    const result = await action();

    if (result.success) {
      addToast(t(successToastKey), { variant: "success" });
    } else {
      restoreReport(reportId);
      addToast(translateReportError(result.error), { variant: "error" });
    }
    setResolvingReportId(null);
  };

  const handleResolveReport = (reportId: string) => {
    void runReportResolution(
      reportId,
      () => resolveStoreReportAction({ slug: storeSlug, locale, reportId }),
      "moderation.reports.toasts.resolved",
    );
  };

  const handleDismissReport = (reportId: string) => {
    void runReportResolution(
      reportId,
      () => dismissStoreReportAction({ slug: storeSlug, locale, reportId }),
      "moderation.reports.toasts.dismissed",
    );
  };

  const translateChangeRequestError = (errorKey: string) =>
    t.has(`moderation.errors.${errorKey}`)
      ? t(`moderation.errors.${errorKey}`)
      : t("moderation.errors.moderationFailed");

  /**
   * Optimistic Confirmation: hide the request block, run the review action, restore it and toast on
   * failure. `action` resolves to `true` on success (already toasted by the caller) or `false` on
   * failure. The modal stays open so several requests can be reviewed in a row.
   */
  const reviewChangeRequest = async (changeRequestId: string, action: () => Promise<boolean>) => {
    if (reviewingChangeRequestId != null) return;
    setReviewingChangeRequestId(changeRequestId);
    setPendingReviewedChangeRequestIds((current) => new Set(current).add(changeRequestId));

    const succeeded = await action();

    if (!succeeded) {
      setPendingReviewedChangeRequestIds((current) => {
        const next = new Set(current);
        next.delete(changeRequestId);
        return next;
      });
    }
    setReviewingChangeRequestId(null);
  };

  const handleApplyChangeRequest = (changeRequestId: string) => {
    void reviewChangeRequest(changeRequestId, async () => {
      const result = await applyStoreChangeRequestAction({ slug: storeSlug, locale, changeRequestId });
      if (result.success) {
        // A superseded outcome means the store already matched the proposal, so nothing was applied.
        const toastKey =
          result.outcome === "applied"
            ? "moderation.changeRequests.toasts.applied"
            : "moderation.changeRequests.toasts.superseded";
        addToast(t(toastKey), { variant: "success" });
        return true;
      }
      addToast(translateChangeRequestError(result.error), { variant: "error" });
      return false;
    });
  };

  const handleRejectChangeRequest = (changeRequestId: string) => {
    void reviewChangeRequest(changeRequestId, async () => {
      const result = await rejectStoreChangeRequestAction({ slug: storeSlug, locale, changeRequestId });
      if (result.success) {
        addToast(t("moderation.changeRequests.toasts.rejected"), { variant: "success" });
        return true;
      }
      addToast(translateChangeRequestError(result.error), { variant: "error" });
      return false;
    });
  };

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

            {/* ─── Reportes abiertos (solo admin) ─────────────────────────── */}
            {visibleAdminReports.length > 0 && (
              <SectionGroup
                icon={<ShieldAlert size={14} aria-hidden="true" />}
                eyebrow={t("moderation.reports.sectionTitle")}
              >
                <div className="space-y-2.5">
                  {visibleAdminReports.map((report) => (
                    <div
                      key={report.id}
                      className="space-y-2.5 rounded-[10px] px-3.5 py-3 [background:color-mix(in_oklch,var(--warning)_7%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--warning)_20%,transparent)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 [font-size:11px] [font-weight:500] [color:var(--warning)] [background:color-mix(in_oklch,var(--warning)_14%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--warning)_25%,transparent)]">
                          {t(`governance.report.reasonOptions.${report.reason}`)}
                        </span>
                        <span className="shrink-0 [font-size:11px] [color:var(--text-muted)]">
                          {formatRelativeShort(locale, new Date(report.createdAt))}
                        </span>
                      </div>
                      <p className="m-0 [font-size:13px] [line-height:1.5] [color:var(--text-secondary)]">
                        {report.details ? (
                          <>&ldquo;{report.details}&rdquo;</>
                        ) : (
                          <span className="[color:var(--text-muted)] italic">{t("moderation.reports.noDetails")}</span>
                        )}
                      </p>
                      <p className="m-0 [font-size:12px] [color:var(--text-primary)]">
                        {t("moderation.reports.reportedBy", { username: report.reporter.username })}
                      </p>
                      <p className="m-0 inline-flex items-center gap-1.5 [font-size:11px] [color:var(--text-muted)]">
                        <Lock size={11} aria-hidden="true" />
                        {t("moderation.reports.adminOnlyCaption")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handleResolveReport(report.id)}
                          disabled={resolvingReportId != null}
                        >
                          {t("moderation.reports.resolveCta")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismissReport(report.id)}
                          disabled={resolvingReportId != null}
                        >
                          {t("moderation.reports.dismissCta")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionGroup>
            )}

            {/* ─── Solicitudes de cambio (solo admin) ─────────────────────── */}
            {visibleAdminChangeRequests.length > 0 && (
              <SectionGroup
                icon={<GitPullRequestArrow size={14} aria-hidden="true" />}
                eyebrow={t("moderation.changeRequests.sectionTitle")}
              >
                <div className="space-y-2.5">
                  {visibleAdminChangeRequests.map((changeRequest) => (
                    <AdminChangeRequestCard
                      key={changeRequest.id}
                      changeRequest={changeRequest}
                      locale={locale}
                      disabled={reviewingChangeRequestId != null}
                      onApply={() => handleApplyChangeRequest(changeRequest.id)}
                      onReject={() => handleRejectChangeRequest(changeRequest.id)}
                    />
                  ))}
                </div>
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

// ─── Admin change-request review ─────────────────────────────────────────────

/** Renders a scalar diff value as localized copy: tri-state boolean, or text with an empty fallback. */
function formatScalarValue(t: ReturnType<typeof useTranslations>, value: AdminChangeRequestScalarValue): string {
  if (value.kind === "bool") {
    if (value.value === null) return t("moderation.changeRequests.boolValues.unset");
    return t(value.value ? "moderation.changeRequests.boolValues.true" : "moderation.changeRequests.boolValues.false");
  }
  return value.value && value.value.trim().length > 0 ? value.value : t("moderation.changeRequests.emptyValue");
}

/** Chip styling for a per-item list delta: added (success), removed (error), kept (neutral). */
function listItemDeltaChipClass(delta: "added" | "removed" | "kept"): string {
  if (delta === "added") {
    return "[color:var(--success)] [background:color-mix(in_oklch,var(--success)_14%,transparent)]";
  }
  if (delta === "removed") {
    return "[color:var(--error)] [background:color-mix(in_oklch,var(--error)_14%,transparent)]";
  }
  return "[color:var(--text-muted)] [background:var(--surface-elevated)]";
}

/**
 * One pending change-request review card: requester + date, comment, the store-level drift banner,
 * the per-field "Ahora -> Propuesta" diff (with a "Ya aplicado" tag on already-applied rows), and the
 * approve / reject footer. When the rebased diff is empty, it shows a "nothing left to apply" state
 * instead of the apply CTA.
 */
function AdminChangeRequestCard({
  changeRequest,
  locale,
  disabled,
  onApply,
  onReject,
}: {
  changeRequest: AdminPendingStoreChangeRequest;
  locale: string;
  disabled: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("stores");

  return (
    <div className="space-y-2.5 rounded-[10px] px-3.5 py-3 [background:color-mix(in_oklch,var(--accent)_6%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_18%,transparent)]">
      <div className="flex items-start justify-between gap-2">
        <span className="[font-size:12px] [font-weight:500] [color:var(--text-primary)]">
          {t("moderation.changeRequests.requestedBy", { username: changeRequest.requester.username })}
        </span>
        <span className="shrink-0 [font-size:11px] [color:var(--text-muted)]">
          {formatRelativeShort(locale, new Date(changeRequest.createdAt))}
        </span>
      </div>

      {changeRequest.comment ? (
        <p className="m-0 [font-size:13px] [line-height:1.5] [color:var(--text-secondary)]">
          &ldquo;{changeRequest.comment}&rdquo;
        </p>
      ) : (
        <p className="m-0 [font-size:12px] [color:var(--text-muted)] italic">
          {t("moderation.changeRequests.noComment")}
        </p>
      )}

      {changeRequest.storeDriftedSinceSubmission && (
        <div
          role="alert"
          className="space-y-1 rounded-[8px] px-3 py-2 [background:color-mix(in_oklch,var(--warning)_9%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--warning)_22%,transparent)]"
        >
          <p className="m-0 [font-size:12px] [font-weight:500] [color:var(--warning)]">
            {t("moderation.changeRequests.driftBanner.title")}
          </p>
          <p className="m-0 [font-size:11.5px] [line-height:1.45] [color:var(--text-secondary)]">
            {t("moderation.changeRequests.driftBanner.helper")}
          </p>
        </div>
      )}

      <ul className="m-0 list-none space-y-2 p-0">
        {changeRequest.fieldRows.map((row) => (
          <li
            key={row.fieldKey}
            className="space-y-1 rounded-[8px] px-2.5 py-2 [background:var(--surface)] [border:1px_solid_var(--border)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="[font-size:11px] [font-weight:500] [color:var(--text-primary)]">
                {t(`governance.summary.fieldLabels.${row.fieldKey}`)}
              </span>
              {row.alreadyApplied && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 [font-size:10px] [font-weight:500] [color:var(--text-muted)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]">
                  {t("moderation.changeRequests.alreadyAppliedTag")}
                </span>
              )}
            </div>

            {row.type === "scalar" ? (
              <div className="flex flex-wrap items-center gap-2 [font-size:12px]">
                <span className="[color:var(--text-muted)] line-through">{formatScalarValue(t, row.current)}</span>
                <ArrowRight size={12} aria-hidden="true" className="[color:var(--text-muted)]" />
                <span className="[font-weight:500] [color:var(--text-primary)]">
                  {formatScalarValue(t, row.proposed)}
                </span>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {row.items.map((item) => (
                  <li key={item.token} className="inline-flex items-center gap-1 [font-size:12px]">
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-1.5 py-0.5 [font-size:10px] [font-weight:500]",
                        listItemDeltaChipClass(item.delta),
                      )}
                    >
                      {t(`moderation.changeRequests.itemDelta.${item.delta}`)}
                    </span>
                    <span
                      className={cn(
                        item.delta === "removed"
                          ? "[color:var(--text-muted)] line-through"
                          : "[color:var(--text-secondary)]",
                      )}
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <p className="m-0 inline-flex items-center gap-1.5 [font-size:11px] [color:var(--text-muted)]">
        <Lock size={11} aria-hidden="true" />
        {t("moderation.changeRequests.adminOnlyCaption")}
      </p>

      {changeRequest.effectiveDiffEmpty ? (
        <>
          <p className="m-0 [font-size:12px] [color:var(--text-secondary)]">
            {t("moderation.changeRequests.nothingToApply")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onReject} disabled={disabled}>
              {t("moderation.changeRequests.rejectCta")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 [font-size:11px] [color:var(--text-muted)]">{t("moderation.changeRequests.rebaseNote")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" onClick={onApply} disabled={disabled}>
              {t("moderation.changeRequests.applyCta")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onReject} disabled={disabled}>
              {t("moderation.changeRequests.rejectCta")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
