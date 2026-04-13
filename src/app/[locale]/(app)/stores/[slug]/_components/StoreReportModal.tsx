"use client";

import type { ReactNode } from "react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import FieldCharacterCount from "@/components/core/FieldCharacterCount";
import Label from "@/components/core/Label";
import Select from "@/components/core/Select";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import { saveStoreReport, type SaveStoreReportResult } from "../_actions/saveStoreReport";

type StoreReportModalProps = {
  locale: string;
  storeSlug: string;
  existingReport: StoreGovernanceViewerContext["openReport"];
  hideTrigger?: boolean;
  openRequestNonce?: number;
  /** Merged into the default trigger button (e.g. higher contrast on tinted hero backgrounds). */
  triggerClassName?: string;
  renderTrigger?: (args: { openModal: () => void; label: string }) => ReactNode;
};

const REPORT_REASONS = ["SPAM", "DUPLICATE", "INCORRECT_INFO", "DOES_NOT_EXIST", "INAPPROPRIATE"] as const;

type ReportReason = (typeof REPORT_REASONS)[number];

function translateError(t: ReturnType<typeof useTranslations>, errorKey: string) {
  return t.has(`governance.report.errors.${errorKey}`)
    ? t(`governance.report.errors.${errorKey}`)
    : t("error.validation_failed");
}

export default function StoreReportModal({
  locale,
  storeSlug,
  existingReport,
  hideTrigger = false,
  openRequestNonce = 0,
  triggerClassName,
  renderTrigger,
}: StoreReportModalProps) {
  const t = useTranslations("stores");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<SaveStoreReportResult | null>(null);
  const [reason, setReason] = useState<ReportReason | "">(existingReport?.reason ?? "");
  const [details, setDetails] = useState(existingReport?.details ?? "");
  const lastOpenRequestNonceRef = useRef(openRequestNonce);

  const fieldErrors = state?.success === false ? state.fieldErrors : undefined;
  const reasonFieldInvalid = Boolean(fieldErrors?.reason?.[0]);

  const openModal = useCallback(() => {
    setState(null);
    setIsOpen(true);
    posthog.capture(POSTHOG_EVENTS.STORE.REPORT_OPENED, {
      store_slug: storeSlug,
      has_existing_open_report: existingReport != null,
    });
  }, [existingReport, storeSlug]);

  const closeModal = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const reportTriggerLabel = existingReport ? t("governance.report.updateCta") : t("governance.report.openCta");

  useEffect(() => {
    if (openRequestNonce === 0 || openRequestNonce === lastOpenRequestNonceRef.current) {
      return;
    }

    lastOpenRequestNonceRef.current = openRequestNonce;
    startTransition(() => {
      openModal();
    });
  }, [openRequestNonce, openModal]);

  const handleReasonChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value as ReportReason | "";
    setReason(nextValue);
    setState((prev) => {
      if (!prev || prev.success !== false || !prev.fieldErrors?.reason) return prev;
      const nextFieldErrors = { ...prev.fieldErrors };
      delete nextFieldErrors.reason;
      if (Object.keys(nextFieldErrors).length === 0) {
        return null;
      }
      return { ...prev, fieldErrors: nextFieldErrors };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reason === "") {
      setState({
        success: false,
        error: "validation_failed",
        fieldErrors: { reason: ["reasonRequired"] },
      });
      return;
    }
    setIsPending(true);
    const result = await saveStoreReport(null, new FormData(event.currentTarget));
    setState(result);
    setIsPending(false);
  };

  return (
    <>
      {hideTrigger ? null : renderTrigger ? (
        renderTrigger({ openModal, label: reportTriggerLabel })
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn("gap-1.5 max-lg:h-11 max-lg:min-w-11 max-lg:justify-center max-lg:px-0", triggerClassName)}
          onClick={openModal}
        >
          <Flag className="size-4 shrink-0" aria-hidden />
          <span className="max-lg:sr-only">{reportTriggerLabel}</span>
        </Button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={t("governance.report.title")}
        description={t("governance.report.description")}
        closeButtonLabel={t("governance.report.cancelCta")}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <input type="hidden" name="slug" value={storeSlug} />
          <input type="hidden" name="locale" value={locale} />

          <div className="space-y-2">
            <Label htmlFor="store-report-reason" className="text-text-title">
              {t("governance.report.reasonLabel")}
            </Label>
            <Select
              id="store-report-reason"
              name="reason"
              value={reason}
              onChange={handleReasonChange}
              aria-invalid={reasonFieldInvalid}
              aria-required
              error={reasonFieldInvalid}
              showChevron
              className="bg-background/90 h-11 rounded-xl"
            >
              <option value="" disabled>
                {t("governance.report.reasonPlaceholder")}
              </option>
              {REPORT_REASONS.map((option) => (
                <option key={option} value={option}>
                  {t(`governance.report.reasonOptions.${option}`)}
                </option>
              ))}
            </Select>
            {fieldErrors?.reason?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, fieldErrors.reason[0])}
              </Typography>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-report-details" className="text-text-title">
              {t("governance.report.detailsLabel")}
            </Label>
            <Textarea
              id="store-report-details"
              name="details"
              rows={5}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={500}
              error={Boolean(fieldErrors?.details?.[0])}
              aria-invalid={Boolean(fieldErrors?.details?.[0])}
              className="bg-background/90 min-h-36 resize-y rounded-xl px-4 py-3"
            />
            <div className="flex items-center justify-between gap-3">
              <Typography size="xs" className="text-text-muted">
                {t("governance.report.detailsHelper")}
              </Typography>
              <Typography size="xs" className="text-text-muted">
                <FieldCharacterCount currentLength={details.length} maxLength={500} />
              </Typography>
            </div>
            {fieldErrors?.details?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, fieldErrors.details[0])}
              </Typography>
            )}
          </div>

          {state?.success && (
            <Typography
              size="xs"
              className="bg-primary/8 text-text-body border-primary/12 rounded-2xl border px-4 py-3"
              role="status"
            >
              {t("governance.report.success")}
            </Typography>
          )}

          {state?.success === false && state.error && (
            <Typography
              size="xs"
              className="bg-destructive/8 text-destructive border-destructive/20 rounded-2xl border px-4 py-3"
              role="alert"
            >
              {translateError(t, state.error)}
            </Typography>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={closeModal}
              className="min-h-11 px-5"
            >
              {t("governance.report.cancelCta")}
            </Button>
            <Button type="submit" variant="primary" disabled={isPending} className="min-h-11 px-5">
              {isPending ? t("governance.report.submitting") : t("governance.report.submitCta")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
