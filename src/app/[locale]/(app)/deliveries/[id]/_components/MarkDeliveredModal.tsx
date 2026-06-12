"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info, PackageCheck } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";
import Input from "@/components/core/Input";
import { toIsoDateString } from "@/lib/localDate";

type MarkDeliveredModalProps = {
  isOpen: boolean;
  onClose: () => void;
  humanReadableId: string;
  storeName: string;
  productCount: number;
  /** Optimistic-confirmation: the coordinator patches state + owns rollback/toast. */
  onSubmit: (receivedDate: Date) => void;
};

/** Parses the `yyyy-mm-dd` input value as a LOCAL date (not UTC midnight). */
function parseLocalDate(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function MarkDeliveredModal({
  isOpen,
  onClose,
  humanReadableId,
  storeName,
  productCount,
  onSubmit,
}: MarkDeliveredModalProps) {
  const t = useTranslations("deliveries");
  const todayIso = toIsoDateString(new Date());
  const [dateInput, setDateInput] = useState(todayIso);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const parsed = dateInput ? parseLocalDate(dateInput) : null;
    if (!parsed) {
      setError(t("detail.markDeliveredModal.dateRequired"));
      return;
    }
    if (dateInput > todayIso) {
      setError(t("detail.markDeliveredModal.dateInFuture"));
      return;
    }
    // Optimistic confirmation: dispatch + close synchronously; the coordinator owns
    // the optimistic patch, rollback, and failure toast (the modal is gone by then).
    onSubmit(parsed);
    handleClose();
  }

  function handleClose() {
    setError(null);
    setDateInput(todayIso);
    onClose();
  }

  function handleDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    setDateInput(event.target.value);
    setError(null);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("detail.markDeliveredModal.title")}
      subtitle={`${humanReadableId} · ${storeName}`}
      role="dialog"
      tone="success"
      icon={<PackageCheck />}
      primaryAction={{
        label: t("detail.markDeliveredModal.confirm"),
        onClick: handleConfirm,
        variant: "success",
      }}
      secondaryAction={{
        label: t("detail.markDeliveredModal.cancel"),
        onClick: handleClose,
      }}
    >
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <label htmlFor="received-date" className="text-text-secondary block text-[13px]">
            {t("detail.markDeliveredModal.dateLabel")}{" "}
            <span className="text-destructive" aria-hidden>
              *
            </span>
            <span className="sr-only">{t("detail.markDeliveredModal.requiredSr")}</span>
          </label>
          <Input
            id="received-date"
            type="date"
            value={dateInput}
            max={todayIso}
            onChange={handleDateChange}
            error={Boolean(error)}
          />
          <p className="text-text-muted text-[12px]">{t("detail.markDeliveredModal.dateHelper")}</p>
          {error && (
            <p className="text-destructive text-[12.5px]" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-relaxed [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--success)_9%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--success)_22%,transparent)]">
          <Info className="mt-0.5 size-3.5 shrink-0 [color:var(--success)]" aria-hidden />
          <span>
            {t.rich("detail.markDeliveredModal.infoBox", {
              count: productCount,
              strong: (chunks) => <strong className="text-text-primary font-semibold">{chunks}</strong>,
            })}
          </span>
        </div>
      </div>
    </Modal>
  );
}
