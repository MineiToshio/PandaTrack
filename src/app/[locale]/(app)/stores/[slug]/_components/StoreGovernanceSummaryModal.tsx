"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clock3, FilePenLine, Flag, Scale, Users } from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import Tabs from "@/components/modules/Tabs/Tabs";
import { getPosthogDataAttributes } from "@/lib/analytics/posthogDataAttributes";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { StoreGovernanceSummary, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import StoreReportModal from "./StoreReportModal";

type GovernanceTab = "reports" | "suggestions";

const FLAT_DETAIL_ROW_CLASSNAME = "grid gap-2 border-t border-border/55 pt-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4";

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
  const [activeTab, setActiveTab] = useState<GovernanceTab>("reports");

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

  const defaultTab: GovernanceTab =
    viewerOpenReport != null || summary.totalReports > 0 ? "reports" : "suggestions";

  const handleOpenReportEditor = () => {
    setIsOpen(false);
    setReportModalOpenRequest((current) => current + 1);
  };

  const handleOpenModal = () => {
    setActiveTab(defaultTab);
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
        bodyClassName="overflow-hidden px-0 pt-4 pb-0 sm:px-0 sm:pt-4 sm:pb-0"
      >
        <div className="flex max-h-[min(62vh,34rem)] min-h-0 flex-col">
          <div className="px-5 pb-4 sm:px-6">
            <Tabs
              ariaLabel={t("governance.summary.title")}
              value={activeTab}
              onChange={(value) => setActiveTab(value as GovernanceTab)}
              items={[
                { value: "reports", label: t("governance.summary.reportSectionTitle") },
                { value: "suggestions", label: t("governance.summary.changeRequestSectionTitle") },
              ]}
            />
          </div>

          <div className="min-h-0 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
            {activeTab === "reports" ? (
              <section id="tabpanel-reports" role="tabpanel" aria-labelledby="tab-reports" className="space-y-4">
                {viewerOpenReport ? (
                  <SubsectionPanel className="border-warning/18 bg-warning/6">
                    <SubsectionHeading
                      icon={<Flag className="size-4" aria-hidden />}
                      iconClassName="text-warning border-warning/18 bg-warning/10"
                      title={t("governance.summary.yourReportTitle")}
                      description={t("governance.summary.yourReportSubmitted", { date: viewerReportCreatedLabel ?? "" })}
                      trailing={
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
                      }
                    />

                    <div className="space-y-3">
                      <DetailRow label={t("governance.summary.reasonLabel")} accentClassName="text-warning">
                        {t(`governance.report.reasonOptions.${viewerOpenReport.reason}`)}
                      </DetailRow>
                      <DetailRow label={t("governance.summary.descriptionLabel")}>
                        {viewerOpenReport.details || t("governance.summary.noAdditionalDescription")}
                      </DetailRow>
                    </div>
                  </SubsectionPanel>
                ) : null}

                {summary.totalReports > 0 ? (
                  <SubsectionPanel className="border-border/60 bg-background/78">
                    <SubsectionHeading
                      icon={<Users className="size-4" aria-hidden />}
                      iconClassName="text-text-title border-border/60 bg-muted/45"
                      title={t("governance.summary.communityReportTitle")}
                    />
                    <Typography size="sm" className="text-text-body leading-relaxed">
                      <span className="text-text-title">{t("governance.summary.reportSummaryPrefix")}</span>{" "}
                      <span className="text-warning text-2xl font-bold tabular-nums">{summary.totalReports}</span>{" "}
                      <span className="text-text-title font-medium">
                        {t("governance.summary.reportSummaryTimes", { count: summary.totalReports })}
                      </span>
                    </Typography>

                    {reportReasonsWithActivity.length > 0 ? (
                      <div className="space-y-3">
                        <Typography size="2xs" className="text-text-muted font-semibold tracking-[0.14em] uppercase">
                          {t("governance.summary.reportReasonsLabel")}
                        </Typography>
                        <ul className="flex list-none flex-wrap gap-2 p-0">
                          {reportReasonsSortedByCount.map((item) => {
                            const reasonLabel = t(`governance.report.reasonOptions.${item.reason}`);
                            return (
                              <li key={item.reason}>
                                <span
                                  className="border-warning/25 bg-warning/10 text-text-title inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2"
                                  aria-label={t("governance.summary.reportReasonChipAriaLabel", {
                                    label: reasonLabel,
                                    count: item.count,
                                  })}
                                >
                                  <span className="max-w-[min(100%,15rem)] min-w-0 truncate text-left text-xs font-semibold sm:max-w-[18rem] sm:text-sm">
                                    {reasonLabel}
                                  </span>
                                  <span className="bg-warning/18 text-warning inline-flex min-w-8 items-center justify-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums sm:min-w-9 sm:px-2.5 sm:text-sm">
                                    {item.count}
                                  </span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </SubsectionPanel>
                ) : null}

                {!viewerOpenReport && summary.totalReports === 0 ? (
                  <Typography size="xs" className="text-text-muted">
                    {t("governance.summary.empty")}
                  </Typography>
                ) : null}
              </section>
            ) : (
              <section id="tabpanel-suggestions" role="tabpanel" aria-labelledby="tab-suggestions" className="space-y-4">
                {viewerOpenChangeRequest ? (
                  <SubsectionPanel className="border-primary/18 bg-primary/6">
                    <SubsectionHeading
                      icon={<FilePenLine className="size-4" aria-hidden />}
                      iconClassName="text-primary border-primary/18 bg-primary/10"
                      title={t("governance.summary.yourPendingChangeRequestTitle")}
                      description={t("governance.summary.yourPendingChangeRequestUpdated", {
                        date: viewerChangeUpdatedLabel ?? "",
                      })}
                      trailing={
                        <Link
                          href={storeEditHref}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "text-primary hover:bg-primary/10 shrink-0 gap-1.5 px-3",
                          )}
                          {...continueChangeRequestPhAttrs}
                        >
                          <FilePenLine className="size-4" aria-hidden />
                          <span>{t("governance.summary.yourPendingChangeRequestEditCta")}</span>
                        </Link>
                      }
                    />

                    <div className="space-y-3">
                      <DetailRow label={t("governance.summary.changedFieldsLabel")} accentClassName="text-primary">
                        {viewerChangeFieldKeys.length > 0
                          ? viewerChangeFieldKeys
                              .map((fieldKey) => t(`governance.summary.fieldLabels.${fieldKey}`))
                              .join(", ")
                          : t("governance.summary.noChangedFields")}
                      </DetailRow>
                      <DetailRow label={t("governance.summary.commentLabel")}>
                        {viewerOpenChangeRequest.comment || t("governance.summary.noComment")}
                      </DetailRow>
                    </div>
                  </SubsectionPanel>
                ) : null}

                {summary.totalChangeRequests > 0 ? (
                  <SubsectionPanel className="border-border/60 bg-background/78">
                    <SubsectionHeading
                      icon={<Users className="size-4" aria-hidden />}
                      iconClassName="text-text-title border-border/60 bg-muted/45"
                      title={t("governance.summary.communityChangeRequestTitle")}
                    />

                    {changeRequestCountsWithActivity.length > 0 ? (
                      <div
                        className={cn(
                          "grid gap-2.5",
                          changeRequestCountsWithActivity.length >= 3
                            ? "sm:grid-cols-3"
                            : changeRequestCountsWithActivity.length === 2
                              ? "sm:grid-cols-2"
                              : "sm:grid-cols-1",
                        )}
                      >
                        {changeRequestCountsWithActivity.map((item) => (
                          <div key={item.status} className="bg-muted/35 rounded-xl px-4 py-3">
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
                      <ul className="space-y-3">
                        {recentChanges.map((request) => {
                          const updatedLabel = new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(request.updatedAt));

                          return (
                            <li key={request.id} className="border-border/55 space-y-2 rounded-xl border px-4 py-3.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <Typography
                                  as="span"
                                  size="2xs"
                                  className="bg-muted/55 text-text-title inline-flex rounded-lg px-2.5 py-1 font-semibold"
                                >
                                  {t(`governance.summary.changeRequestStatuses.${request.status}`)}
                                </Typography>
                                <span className="text-text-muted inline-flex items-center gap-1 text-xs">
                                  <Clock3 className="size-3.5" aria-hidden />
                                  {t("governance.summary.communityChangeRequestUpdated", { date: updatedLabel })}
                                </span>
                              </div>
                              <Typography size="xs" className="text-text-body leading-6">
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
                  </SubsectionPanel>
                ) : null}

                {!viewerOpenChangeRequest && summary.totalChangeRequests === 0 ? (
                  <Typography size="xs" className="text-text-muted">
                    {t("governance.summary.empty")}
                  </Typography>
                ) : null}
              </section>
            )}
          </div>
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

function SubsectionPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("border-border/55 bg-background/72 space-y-4 rounded-2xl border px-4 py-4 shadow-sm", className)}
    >
      {children}
    </section>
  );
}

function SubsectionHeading({
  icon,
  iconClassName,
  title,
  description,
  trailing,
}: {
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/60",
            iconClassName,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <Typography size="sm" className="text-text-title text-base font-semibold sm:text-lg">
            {title}
          </Typography>
          {description ? (
            <Typography size="xs" className="text-text-muted mt-1">
              {description}
            </Typography>
          ) : null}
        </div>
      </div>
      {trailing}
    </div>
  );
}

function DetailRow({
  label,
  children,
  accentClassName,
}: {
  label: string;
  children: React.ReactNode;
  accentClassName?: string;
}) {
  return (
    <div className={FLAT_DETAIL_ROW_CLASSNAME}>
      <Typography
        size="2xs"
        className={cn("text-text-muted font-semibold tracking-[0.12em] uppercase", accentClassName)}
      >
        {label}
      </Typography>
      <Typography size="xs" className="text-text-body leading-6 wrap-break-word">
        {children}
      </Typography>
    </div>
  );
}
