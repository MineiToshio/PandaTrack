"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
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
            {formatAmount(payment.amount, currencyCode)}
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
