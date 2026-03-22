"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Scale } from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import type { StoreGovernanceSummary } from "@/queries/storeGovernance";

type StoreGovernanceSummaryModalProps = {
  storeSlug: string;
  summary: StoreGovernanceSummary;
  locale: string;
};

export default function StoreGovernanceSummaryModal({ storeSlug, summary }: StoreGovernanceSummaryModalProps) {
  const t = useTranslations("stores");
  const [isOpen, setIsOpen] = useState(false);

  const recentChanges = useMemo(() => summary.recentChangeRequests.slice(0, 5), [summary.recentChangeRequests]);

  const openModal = () => {
    setIsOpen(true);
    posthog.capture(POSTHOG_EVENTS.STORE.GOVERNANCE_SUMMARY_OPENED, {
      store_slug: storeSlug,
      total_reports: summary.totalReports,
      total_change_requests: summary.totalChangeRequests,
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5 max-lg:h-11 max-lg:min-w-11 max-lg:justify-center max-lg:px-0"
        onClick={openModal}
      >
        <Scale className="size-4 shrink-0" aria-hidden />
        <span className="max-lg:sr-only">{t("governance.summary.openCta")}</span>
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("governance.summary.title")}
        description={t("governance.summary.description")}
      >
        <div className="space-y-5">
          <section className="space-y-2">
            <Typography size="sm" className="text-text-title font-semibold">
              {t("governance.summary.reportSectionTitle")}
            </Typography>
            <div className="grid gap-2 sm:grid-cols-2">
              {summary.reportCounts.map((item) => (
                <div key={item.reason} className="bg-muted/45 rounded-2xl px-3 py-2.5">
                  <Typography size="2xs" className="text-text-muted">
                    {t(`governance.report.reasonOptions.${item.reason}`)}
                  </Typography>
                  <Typography size="sm" className="text-text-body mt-0.5 font-semibold">
                    {item.count}
                  </Typography>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <Typography size="sm" className="text-text-title font-semibold">
              {t("governance.summary.changeRequestSectionTitle")}
            </Typography>
            <div className="grid gap-2 sm:grid-cols-3">
              {summary.changeRequestCounts.map((item) => (
                <div key={item.status} className="bg-muted/45 rounded-2xl px-3 py-2.5">
                  <Typography size="2xs" className="text-text-muted">
                    {t(`governance.summary.changeRequestStatuses.${item.status}`)}
                  </Typography>
                  <Typography size="sm" className="text-text-body mt-0.5 font-semibold">
                    {item.count}
                  </Typography>
                </div>
              ))}
            </div>
            {recentChanges.length > 0 ? (
              <ul className="space-y-2">
                {recentChanges.map((request) => (
                  <li key={request.id} className="bg-background/70 rounded-2xl px-3 py-3">
                    <Typography size="xs" className="text-text-muted">
                      {t(`governance.summary.changeRequestStatuses.${request.status}`)}
                    </Typography>
                    <Typography size="sm" className="text-text-body mt-1">
                      {request.changedFieldKeys.length > 0
                        ? request.changedFieldKeys
                            .map((fieldKey) => t(`governance.summary.fieldLabels.${fieldKey}`))
                            .join(", ")
                        : t("governance.summary.noChangedFields")}
                    </Typography>
                  </li>
                ))}
              </ul>
            ) : (
              <Typography size="sm" className="text-text-muted">
                {t("governance.summary.noChangeRequests")}
              </Typography>
            )}
          </section>
        </div>
      </Modal>
    </>
  );
}
