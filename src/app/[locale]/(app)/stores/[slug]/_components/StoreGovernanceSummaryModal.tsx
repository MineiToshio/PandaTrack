"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clock3, FilePenLine, Flag, Scale, Sparkles } from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
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
  summary: StoreGovernanceSummary;
  showTopSeparator: boolean;
  viewerOpenReport: StoreGovernanceViewerContext["openReport"];
  viewerOpenChangeRequest: StoreGovernanceViewerContext["openChangeRequest"];
};

export default function StoreGovernanceSummaryModal({
  locale,
  storeSlug,
  summary,
  showTopSeparator,
  viewerOpenReport,
  viewerOpenChangeRequest,
}: StoreGovernanceSummaryModalProps) {
  const t = useTranslations("stores");
  const [isOpen, setIsOpen] = useState(false);
  const [reportModalOpenRequest, setReportModalOpenRequest] = useState(0);

  const recentChanges = useMemo(() => summary.recentChangeRequests.slice(0, 5), [summary.recentChangeRequests]);

  const viewerChangeFieldKeys = useMemo(() => {
    if (!viewerOpenChangeRequest) return [];
    return Object.keys(viewerOpenChangeRequest.changes ?? {});
  }, [viewerOpenChangeRequest]);

  const viewerChangeUpdatedLabel = useMemo(() => {
    if (!viewerOpenChangeRequest) return null;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(viewerOpenChangeRequest.updatedAt),
    );
  }, [locale, viewerOpenChangeRequest]);

  const viewerReportCreatedLabel = useMemo(() => {
    if (!viewerOpenReport) return null;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(viewerOpenReport.createdAt),
    );
  }, [locale, viewerOpenReport]);

  const storeEditHref = `/${locale}${ROUTES.stores}/${storeSlug}/edit`;
  const continueChangeRequestPhAttrs = getPosthogDataAttributes(
    POSTHOG_EVENTS.STORE.GOVERNANCE_SUMMARY_CONTINUE_CHANGE_REQUEST_CLICKED,
    { store_slug: storeSlug },
  );

  const reportReasonsWithActivity = useMemo(
    () => summary.reportCounts.filter((item) => item.count > 0),
    [summary.reportCounts],
  );

  const reportReasonsSortedByCount = useMemo(
    () => [...reportReasonsWithActivity].sort((a, b) => b.count - a.count),
    [reportReasonsWithActivity],
  );

  const changeRequestCountsWithActivity = useMemo(
    () => summary.changeRequestCounts.filter((item) => item.count > 0),
    [summary.changeRequestCounts],
  );

  const hasViewerSignals = viewerOpenReport != null || viewerOpenChangeRequest != null;

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

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("governance.summary.title")}
        description={t("governance.summary.description")}
        closeButtonLabel={t("governance.report.cancelCta")}
        className="max-w-3xl"
      >
        <div className="space-y-6">
          <section className="border-warning/20 bg-warning/6 overflow-hidden rounded-[28px] border">
            <div className="border-warning/18 bg-warning/10 border-b px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="bg-warning/14 text-warning border-warning/18 flex size-10 shrink-0 items-center justify-center rounded-2xl border">
                  <Flag className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1">
                  <Typography size="sm" className="text-warning font-semibold sm:text-base">
                    {t("governance.summary.reportSectionTitle")}
                  </Typography>
                  <Typography size="xs" className="text-text-body">
                    {t("governance.summary.reportSectionDescription")}
                  </Typography>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <div className="border-warning/18 bg-background/70 rounded-[24px] border p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Typography size="xs" className="text-text-title font-semibold">
                      {t("governance.summary.yourReportTitle")}
                    </Typography>
                    <Typography size="xs" className="text-text-muted mt-1">
                      {viewerOpenReport
                        ? t("governance.summary.yourReportSubmitted", { date: viewerReportCreatedLabel ?? "" })
                        : t("governance.summary.yourReportEmpty")}
                    </Typography>
                  </div>
                  {viewerOpenReport ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-warning hover:bg-warning/10 shrink-0 gap-1.5 px-3"
                      onClick={handleOpenReportEditor}
                    >
                      <FilePenLine className="size-4" aria-hidden />
                      <span>{t("governance.report.updateCta")}</span>
                    </Button>
                  ) : null}
                </div>

                {viewerOpenReport ? (
                  <div className="mt-4 space-y-3">
                    <div className="border-warning/12 bg-warning/7 rounded-2xl border px-3.5 py-3">
                      <Typography size="2xs" className="text-text-muted font-semibold tracking-[0.12em] uppercase">
                        {t("governance.summary.reasonLabel")}
                      </Typography>
                      <Typography size="xs" className="text-text-title mt-2 font-medium">
                        {t(`governance.report.reasonOptions.${viewerOpenReport.reason}`)}
                      </Typography>
                    </div>
                    <div className="border-border/60 bg-background/80 rounded-2xl border px-3.5 py-3">
                      <Typography size="2xs" className="text-text-muted font-semibold tracking-[0.12em] uppercase">
                        {t("governance.summary.descriptionLabel")}
                      </Typography>
                      <Typography size="xs" className="text-text-body mt-2 leading-6 wrap-break-word">
                        {viewerOpenReport.details || t("governance.summary.noAdditionalDescription")}
                      </Typography>
                    </div>
                  </div>
                ) : null}
              </div>

              {summary.totalReports > 0 ? (
                <div className="border-warning/18 bg-background/80 rounded-[24px] border p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="bg-warning/12 text-warning border-warning/18 flex size-10 shrink-0 items-center justify-center rounded-2xl border">
                      <Sparkles className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Typography size="xs" className="text-text-title font-semibold">
                        {t("governance.summary.communityReportTitle")}
                      </Typography>
                      <Typography size="sm" className="text-text-body mt-3 leading-relaxed">
                        <span className="text-text-title">{t("governance.summary.reportSummaryPrefix")}</span>{" "}
                        <span className="text-warning text-2xl font-bold tabular-nums">{summary.totalReports}</span>{" "}
                        <span className="text-text-title font-medium">
                          {t("governance.summary.reportSummaryTimes", { count: summary.totalReports })}
                        </span>
                      </Typography>
                    </div>
                  </div>
                  {reportReasonsWithActivity.length > 0 ? (
                    <div className="mt-4">
                      <Typography size="2xs" className="text-text-muted font-semibold tracking-[0.14em] uppercase">
                        {t("governance.summary.reportReasonsLabel")}
                      </Typography>
                      <ul className="mt-2.5 flex list-none flex-wrap gap-2 p-0">
                        {reportReasonsSortedByCount.map((item) => {
                          const reasonLabel = t(`governance.report.reasonOptions.${item.reason}`);
                          return (
                            <li key={item.reason}>
                              <span
                                className="border-warning/30 bg-warning/14 text-text-title inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-full border py-1 pr-1 pl-3 sm:pr-1.5 sm:pl-3.5"
                                aria-label={t("governance.summary.reportReasonChipAriaLabel", {
                                  label: reasonLabel,
                                  count: item.count,
                                })}
                              >
                                <span className="max-w-[min(100%,14rem)] min-w-0 truncate text-left text-xs font-semibold sm:max-w-[18rem] sm:text-sm">
                                  {reasonLabel}
                                </span>
                                <span
                                  className="bg-warning/28 text-warning flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums sm:size-9 sm:text-sm"
                                  aria-hidden
                                >
                                  {item.count}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="border-primary/20 bg-primary/5 overflow-hidden rounded-[28px] border">
            <div className="border-primary/18 bg-primary/10 border-b px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="bg-primary/14 text-primary border-primary/18 flex size-10 shrink-0 items-center justify-center rounded-2xl border">
                  <FilePenLine className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1">
                  <Typography size="sm" className="text-primary font-semibold sm:text-base">
                    {t("governance.summary.changeRequestSectionTitle")}
                  </Typography>
                  <Typography size="xs" className="text-text-body">
                    {t("governance.summary.changeRequestSectionDescription")}
                  </Typography>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <div className="border-primary/18 bg-background/70 rounded-[24px] border p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Typography size="xs" className="text-text-title font-semibold">
                      {t("governance.summary.yourPendingChangeRequestTitle")}
                    </Typography>
                    <Typography size="xs" className="text-text-muted mt-1">
                      {viewerOpenChangeRequest
                        ? t("governance.summary.yourPendingChangeRequestUpdated", {
                            date: viewerChangeUpdatedLabel ?? "",
                          })
                        : t("governance.summary.yourPendingChangeRequestEmpty")}
                    </Typography>
                  </div>
                  {viewerOpenChangeRequest ? (
                    <Typography
                      as="span"
                      size="2xs"
                      className="bg-primary/12 text-primary inline-flex rounded-full px-3 py-1 font-semibold"
                    >
                      {t("governance.summary.yourPendingChangeRequestStatus")}
                    </Typography>
                  ) : null}
                </div>

                {viewerOpenChangeRequest ? (
                  <div className="mt-4 space-y-4">
                    <div className="border-primary/12 bg-primary/7 rounded-2xl border px-3.5 py-3">
                      <Typography size="2xs" className="text-text-muted font-semibold tracking-[0.12em] uppercase">
                        {t("governance.summary.changedFieldsLabel")}
                      </Typography>
                      <Typography size="xs" className="text-text-body mt-2 leading-6">
                        {viewerChangeFieldKeys.length > 0
                          ? viewerChangeFieldKeys
                              .map((fieldKey) => t(`governance.summary.fieldLabels.${fieldKey}`))
                              .join(", ")
                          : t("governance.summary.noChangedFields")}
                      </Typography>
                    </div>

                    <div className="border-border/60 bg-background/80 rounded-2xl border px-3.5 py-3">
                      <Typography size="2xs" className="text-text-muted font-semibold tracking-[0.12em] uppercase">
                        {t("governance.summary.commentLabel")}
                      </Typography>
                      <Typography size="xs" className="text-text-body mt-2 leading-6">
                        {viewerOpenChangeRequest.comment || t("governance.summary.noComment")}
                      </Typography>
                    </div>

                    <Typography size="xs" className="text-text-muted">
                      <Link
                        href={storeEditHref}
                        className="text-link font-medium underline-offset-2 hover:underline"
                        {...continueChangeRequestPhAttrs}
                      >
                        {t("governance.summary.yourPendingChangeRequestEditCta")}
                      </Link>
                    </Typography>
                  </div>
                ) : null}
              </div>

              {summary.totalChangeRequests > 0 ? (
                <div className="border-primary/18 bg-background/80 rounded-[24px] border p-4 sm:p-5">
                  <Typography size="xs" className="text-text-title font-semibold">
                    {t("governance.summary.communityChangeRequestTitle")}
                  </Typography>

                  {changeRequestCountsWithActivity.length > 0 ? (
                    <div
                      className={cn(
                        "mt-4 grid gap-2.5",
                        changeRequestCountsWithActivity.length >= 3
                          ? "sm:grid-cols-3"
                          : changeRequestCountsWithActivity.length === 2
                            ? "sm:grid-cols-2"
                            : "sm:grid-cols-1",
                      )}
                    >
                      {changeRequestCountsWithActivity.map((item) => (
                        <div key={item.status} className="border-border/60 bg-primary/6 rounded-2xl border px-4 py-3">
                          <Typography size="2xs" className="text-text-muted font-medium">
                            {t(`governance.summary.changeRequestStatuses.${item.status}`)}
                          </Typography>
                          <Typography size="sm" className="text-text-title mt-1 text-2xl leading-none font-semibold">
                            {item.count}
                          </Typography>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {recentChanges.length > 0 ? (
                    <ul className="mt-4 space-y-2.5">
                      {recentChanges.map((request) => {
                        const updatedLabel = new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(request.updatedAt));

                        return (
                          <li
                            key={request.id}
                            className="border-border/55 bg-background/72 rounded-2xl border px-4 py-3.5"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Typography
                                as="span"
                                size="2xs"
                                className="bg-muted/70 text-text-title inline-flex rounded-full px-2.5 py-1 font-semibold"
                              >
                                {t(`governance.summary.changeRequestStatuses.${request.status}`)}
                              </Typography>
                              <span className="text-text-muted inline-flex items-center gap-1 text-xs">
                                <Clock3 className="size-3.5" aria-hidden />
                                {t("governance.summary.communityChangeRequestUpdated", { date: updatedLabel })}
                              </span>
                            </div>
                            <Typography size="xs" className="text-text-body mt-2.5 leading-6">
                              {request.changedFieldKeys.length > 0
                                ? request.changedFieldKeys
                                    .map((fieldKey) => t(`governance.summary.fieldLabels.${fieldKey}`))
                                    .join(", ")
                                : t("governance.summary.noChangedFields")}
                            </Typography>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {!hasViewerSignals && summary.totalReports === 0 && summary.totalChangeRequests === 0 ? (
            <Typography size="xs" className="text-text-muted">
              {t("governance.summary.empty")}
            </Typography>
          ) : null}
        </div>
      </Modal>

      {viewerOpenReport ? (
        <StoreReportModal
          locale={locale}
          storeSlug={storeSlug}
          existingReport={viewerOpenReport}
          hideTrigger
          openRequestNonce={reportModalOpenRequest}
        />
      ) : null}
    </>
  );
}
