"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import FieldCharacterCount from "@/components/core/FieldCharacterCount";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import type { StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import { saveStoreReport, type SaveStoreReportResult } from "../_actions/saveStoreReport";

type StoreReportModalProps = {
  locale: string;
  storeSlug: string;
  existingReport: StoreGovernanceViewerContext["openReport"];
};

const REPORT_REASONS = ["SPAM", "DUPLICATE", "INCORRECT_INFO", "DOES_NOT_EXIST", "INAPPROPRIATE"] as const;

function translateError(t: ReturnType<typeof useTranslations>, errorKey: string) {
  return t.has(`governance.report.errors.${errorKey}`)
    ? t(`governance.report.errors.${errorKey}`)
    : t("error.validation_failed");
}

export default function StoreReportModal({ locale, storeSlug, existingReport }: StoreReportModalProps) {
  const t = useTranslations("stores");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<SaveStoreReportResult | null>(null);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>(existingReport?.reason ?? "INCORRECT_INFO");
  const [details, setDetails] = useState(existingReport?.details ?? "");

  const fieldErrors = state?.success === false ? state.fieldErrors : undefined;

  const openModal = () => {
    setIsOpen(true);
    posthog.capture(POSTHOG_EVENTS.STORE.REPORT_OPENED, {
      store_slug: storeSlug,
      has_existing_open_report: existingReport != null,
    });
  };

  const closeModal = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const reportTriggerLabel = existingReport ? t("governance.report.updateCta") : t("governance.report.openCta");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    const result = await saveStoreReport(null, new FormData(event.currentTarget));
    setState(result);
    setIsPending(false);
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
        <Flag className="size-4 shrink-0" aria-hidden />
        <span className="max-lg:sr-only">{reportTriggerLabel}</span>
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={t("governance.report.title")}
        description={t("governance.report.description")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="slug" value={storeSlug} />
          <input type="hidden" name="locale" value={locale} />

          <div>
            <Label htmlFor="store-report-reason">{t("governance.report.reasonLabel")}</Label>
            <select
              id="store-report-reason"
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as (typeof REPORT_REASONS)[number])}
              className="border-input bg-background text-foreground focus-visible:ring-ring mt-1 flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {REPORT_REASONS.map((option) => (
                <option key={option} value={option}>
                  {t(`governance.report.reasonOptions.${option}`)}
                </option>
              ))}
            </select>
            {fieldErrors?.reason?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {translateError(t, fieldErrors.reason[0])}
              </Typography>
            )}
          </div>

          <div>
            <Label htmlFor="store-report-details">{t("governance.report.detailsLabel")}</Label>
            <Textarea
              id="store-report-details"
              name="details"
              rows={5}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={500}
              error={Boolean(fieldErrors?.details?.[0])}
              aria-invalid={Boolean(fieldErrors?.details?.[0])}
              className="mt-1 resize-y"
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              <Typography size="xs" className="text-text-muted">
                {t("governance.report.detailsHelper")}
              </Typography>
              <Typography size="xs" className="text-text-muted">
                <FieldCharacterCount currentLength={details.length} maxLength={500} />
              </Typography>
            </div>
            {fieldErrors?.details?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {translateError(t, fieldErrors.details[0])}
              </Typography>
            )}
          </div>

          {state?.success && (
            <Typography size="xs" className="text-text-body" role="status">
              {t("governance.report.success")}
            </Typography>
          )}

          {state?.success === false && state.error && (
            <Typography size="xs" className="text-destructive" role="alert">
              {translateError(t, state.error)}
            </Typography>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? t("governance.report.submitting") : t("governance.report.submitCta")}
            </Button>
            <Button type="button" variant="secondary" disabled={isPending} onClick={closeModal}>
              {t("governance.report.cancelCta")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
