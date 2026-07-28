"use client";

import type { ReactNode } from "react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import posthog from "posthog-js";
import { type VariantProps } from "class-variance-authority";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { useToast } from "@/contexts/ToastContext";
import type { StoreGovernanceViewerContext } from "@/lib/data/stores/storeGovernanceQueries";
import ReportReasonPicker from "@/components/modules/ReportReasonPicker";
import { saveStoreReport, type SaveStoreReportResult } from "../_actions/saveStoreReport";

type StoreReportModalProps = {
  locale: string;
  storeSlug: string;
  /** Rendered as the modal subtitle so the user sees which store they are reporting. */
  storeName: string;
  existingReport: StoreGovernanceViewerContext["openReport"];
  hideTrigger?: boolean;
  openRequestNonce?: number;
  /** Variant of the trigger button. Defaults to `secondary`. */
  triggerVariant?: NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
  /** Merged into the default trigger button (e.g. higher contrast on tinted hero backgrounds). */
  triggerClassName?: string;
  triggerLabelClassName?: string;
  showTriggerLabel?: boolean;
  triggerIcon?: ReactNode;
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
  storeName,
  existingReport,
  hideTrigger = false,
  openRequestNonce = 0,
  triggerVariant = "secondary",
  triggerClassName,
  triggerLabelClassName,
  showTriggerLabel = false,
  triggerIcon,
}: StoreReportModalProps) {
  const t = useTranslations("stores");
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<SaveStoreReportResult | null>(null);
  const [reason, setReason] = useState<ReportReason | "">(existingReport?.reason ?? "");
  const [details, setDetails] = useState(existingReport?.details ?? "");
  const lastOpenRequestNonceRef = useRef(openRequestNonce);
  const formRef = useRef<HTMLFormElement>(null);

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

  const clearReasonError = () => {
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

  const handleReasonChange = (nextValue: string) => {
    setReason(nextValue as ReportReason);
    clearReasonError();
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
    const formData = new FormData(event.currentTarget);
    // Optimistic Confirmation: close the modal synchronously on submit so the report notice and
    // "Con reportes" chip (already revalidated server-side) are visible behind it. Success and
    // failure surface as a toast once the modal is gone.
    setIsOpen(false);
    setIsPending(true);
    const result = await saveStoreReport(null, formData);
    setIsPending(false);
    if (result.success) {
      addToast(t("governance.report.success"), { variant: "success" });
    } else {
      addToast(translateError(t, result.error), { variant: "error" });
    }
  };

  const reasonOptions = REPORT_REASONS.map((value) => ({
    value,
    label: t(`governance.report.reasonOptions.${value}`),
  }));

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant={triggerVariant}
          size="md"
          className={cn(
            "gap-1.5",
            // Icon-only collapse on small screens — only when caller doesn't want the label visible.
            !showTriggerLabel && "max-lg:h-11 max-lg:min-w-11 max-lg:justify-center max-lg:px-0",
            triggerClassName,
          )}
          onClick={openModal}
        >
          {triggerIcon ?? <Flag className="size-4 shrink-0" aria-hidden />}
          <span className={cn(showTriggerLabel ? undefined : "max-lg:sr-only", triggerLabelClassName)}>
            {reportTriggerLabel}
          </span>
        </Button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={t("governance.report.title")}
        subtitle={storeName}
        icon={<Flag size={20} aria-hidden="true" />}
        tone="warning"
        closeButtonLabel={t("governance.report.cancelCta")}
        bodyClassName="pb-4"
        primaryAction={{
          label: t("governance.report.submitCta"),
          onClick: () => formRef.current?.requestSubmit(),
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{
          label: t("governance.report.cancelCta"),
          onClick: closeModal,
          disabled: isPending,
        }}
      >
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          <input type="hidden" name="slug" value={storeSlug} />
          <input type="hidden" name="locale" value={locale} />

          <Typography size="xs" className="text-text-secondary">
            {t("governance.report.description")}
          </Typography>

          <div className="space-y-2">
            <Label className="text-text-title">{t("governance.report.reasonLabel")}</Label>
            <ReportReasonPicker
              value={reason || null}
              onChange={handleReasonChange}
              options={reasonOptions}
              ariaLabel={t("governance.report.reasonLabel")}
              name="reason"
            />
            {fieldErrors?.reason?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, fieldErrors.reason[0])}
              </Typography>
            )}
            {reasonFieldInvalid && !fieldErrors?.reason?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, "reasonRequired")}
              </Typography>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-report-details" className="text-text-title">
              {t("governance.report.detailsLabel")}
            </Label>
            <Typography size="xs" className="text-text-muted">
              {t("governance.report.detailsHelper")}
            </Typography>
            <Textarea
              id="store-report-details"
              name="details"
              rows={5}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={500}
              error={Boolean(fieldErrors?.details?.[0])}
              aria-invalid={Boolean(fieldErrors?.details?.[0])}
            />
            {fieldErrors?.details?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, fieldErrors.details[0])}
              </Typography>
            )}
          </div>

          {state?.success === false && state.error && (
            <Typography
              size="xs"
              className="bg-destructive/8 text-destructive border-destructive/20 rounded-2xl border px-4 py-3"
              role="alert"
            >
              {translateError(t, state.error)}
            </Typography>
          )}
        </form>
      </Modal>
    </>
  );
}
