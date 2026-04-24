"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import Button from "@/components/core/Button/Button";
import { deleteOrderHistoryEntryAction } from "../_actions/orderHistoryActions";

type HistoryEntry = {
  id: string;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
};

type OrderHistoryRowProps = {
  entry: HistoryEntry;
  orderId: string;
  locale: string;
  onDeleted: (id: string) => void;
};

function formatEventLabel(t: ReturnType<typeof useTranslations>, entry: HistoryEntry): string {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const key = `detail.history.events.${entry.eventType}` as const;

  if ((entry.eventType === "PAYMENT_ADDED" || entry.eventType === "PAYMENT_DELETED") && meta.amount != null) {
    const currency = typeof meta.currencyCode === "string" ? meta.currencyCode : "";
    const amount = `${currency} ${((meta.amount as number) / 100).toFixed(2)}`.trim();
    return t(key as Parameters<typeof t>[0], { amount });
  }
  return t(key as Parameters<typeof t>[0]);
}

export default function OrderHistoryRow({ entry, orderId, locale, onDeleted }: OrderHistoryRowProps) {
  const t = useTranslations("orders");
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(entry.createdAt));

  async function handleDeleteConfirm() {
    setIsPending(true);
    setError(null);
    const result = await deleteOrderHistoryEntryAction(entry.id, orderId);
    setIsPending(false);
    if (result.ok) {
      setModalOpen(false);
      onDeleted(entry.id);
    } else {
      setError(t("error.server_error"));
    }
  }

  return (
    <>
      <li className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0 flex-1">
          <Typography size="sm" className="text-text-body">
            {formatEventLabel(t, entry)}
          </Typography>
          <Typography size="xs" className="text-text-muted">
            {dateLabel}
          </Typography>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label={t("detail.history.deleteLabel")}
          className="text-text-muted hover:text-destructive focus-visible:ring-ring focus-visible:ring-offset-background mt-0.5 shrink-0 cursor-pointer rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </li>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("detail.history.deleteModalTitle")}
        description={t("detail.history.deleteModalDescription")}
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
            {t("detail.history.deleteCancel")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={handleDeleteConfirm}
            disabled={isPending}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            {isPending ? "…" : t("detail.history.deleteConfirm")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
