"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import Button from "@/components/core/Button/Button";
import { formatAmount } from "@/lib/currency";

type PaymentRecord = { id: string; amount: number; paymentDate: Date };

type OrderPaymentRowProps = {
  payment: PaymentRecord;
  currencyCode: string;
  locale: string;
  onDeleted: (id: string) => void;
  onConfirmDelete: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
};

export default function OrderPaymentRow({
  payment,
  currencyCode,
  locale,
  onDeleted,
  onConfirmDelete,
}: OrderPaymentRowProps) {
  const t = useTranslations("orders");
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(payment.paymentDate));

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await onConfirmDelete(payment.id);
    setIsPending(false);
    if (result.ok) {
      setModalOpen(false);
      onDeleted(payment.id);
    } else {
      setError(t("detail.payments.errorDelete"));
    }
  }

  return (
    <>
      <li className="flex items-center justify-between gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <Typography size="sm" className="text-text-body font-medium tabular-nums">
            {formatAmount(payment.amount, currencyCode, locale)}
          </Typography>
          <Typography size="xs" className="text-text-muted">
            {dateLabel}
          </Typography>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label={t("detail.payments.deleteLabel")}
          className="text-text-muted hover:text-destructive focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 cursor-pointer rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </li>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("detail.payments.deleteModalTitle")}
        description={t("detail.payments.deleteModalDescription")}
        role="alertdialog"
        closeOnBackdropClick={false}
      >
        {error && (
          <Typography size="sm" className="text-destructive mb-4" role="alert">
            {error}
          </Typography>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="md" onClick={() => setModalOpen(false)} disabled={isPending}>
            {t("detail.payments.deleteCancel")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={handleConfirm}
            disabled={isPending}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            {isPending ? "…" : t("detail.payments.deleteConfirm")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
