"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, X } from "lucide-react";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
import { formatAmountSymbolOnly } from "@/lib/currency";

type PaymentRecord = { id: string; amount: number; paymentDate: Date };

type OrderPaymentRowProps = {
  payment: PaymentRecord;
  currencyCode: string;
  locale: string;
  /** Parent owns the payments list and removes the row when this resolves with `ok: true`. */
  onConfirmDelete: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * Single row of the payments list. Layout mirrors the demo's `.pay-row`:
 * date (left) · amount (right, mono) · delete × button (far right, muted).
 * The amount always carries two decimals so it lines up across rows.
 */
export default function OrderPaymentRow({ payment, currencyCode, locale, onConfirmDelete }: OrderPaymentRowProps) {
  const t = useTranslations("orders");
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(payment.paymentDate));
  const amountLabel = formatAmountSymbolOnly(payment.amount, currencyCode, locale);

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await onConfirmDelete(payment.id);
    setIsPending(false);
    if (result.ok) {
      setModalOpen(false);
    } else {
      setError(t("detail.payments.errorDelete"));
    }
  }

  return (
    <>
      {/* Demo `.pay-row`: gap 12px · py 6px · font 14px. No inter-row border — payments
          read as a single block; the only visible separator is the one between the last
          payment and the `Total pagado` row (rendered by the parent aside card). */}
      <li className="flex items-center gap-3 py-1.5 text-[14px]">
        <span className="text-text-muted flex-1 font-mono text-[12px] tabular-nums">{dateLabel}</span>
        <span className="text-text-title font-semibold tabular-nums">{amountLabel}</span>
        {/* Demo `.pay-row .pay-delete`: 28×28 · rounded 6px · transparent bg · muted icon */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label={t("detail.payments.deleteLabelDetailed", { amount: amountLabel, date: dateLabel })}
          className="text-text-muted hover:text-text-title focus-visible:ring-ring focus-visible:ring-offset-background grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <X className="size-[13px]" aria-hidden />
        </button>
      </li>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("detail.payments.deleteModalTitle")}
        subtitle={t("detail.payments.deleteModalDescription")}
        icon={<Trash2 size={20} aria-hidden="true" />}
        tone="destructive"
        role="alertdialog"
        dismissible={false}
        primaryAction={{
          label: isPending ? "…" : t("detail.payments.deleteConfirm"),
          onClick: handleConfirm,
          variant: "destructive",
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{
          label: t("detail.payments.deleteCancel"),
          onClick: () => setModalOpen(false),
          disabled: isPending,
        }}
      >
        {error && (
          <Typography size="sm" className="text-destructive" role="alert">
            {error}
          </Typography>
        )}
      </Modal>
    </>
  );
}
