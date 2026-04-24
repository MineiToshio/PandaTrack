"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import Button from "@/components/core/Button/Button";

export type DangerousAction = "cancel" | "delete";

type OrderDangerousActionModalProps = {
  action: DangerousAction;
  isOpen: boolean;
  onClose: () => void;
  humanReadableId: string;
  storeName: string;
  hasPayments: boolean;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  onSuccess?: () => void;
};

const ERROR_MAP: Record<string, string> = {
  HAS_LIVE_DELIVERY_LINKS: "errorLinkedDelivery",
  server_error: "errorGeneral",
  unauthorized: "errorGeneral",
};

export default function OrderDangerousActionModal({
  action,
  isOpen,
  onClose,
  humanReadableId,
  storeName,
  hasPayments,
  onConfirm,
  onSuccess,
}: OrderDangerousActionModalProps) {
  const t = useTranslations("orders");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ns = action === "cancel" ? "detail.cancelModal" : "detail.deleteModal";

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await onConfirm();
    setIsPending(false);
    if (result.ok) {
      onClose();
      onSuccess?.();
    } else {
      const errKey = ERROR_MAP[result.error ?? ""] ?? "errorGeneral";
      setError(t(`${ns}.${errKey}` as Parameters<typeof t>[0]));
    }
  }

  function handleClose() {
    if (isPending) return;
    setError(null);
    onClose();
  }

  const description = (
    <span>
      {t(`${ns}.descriptionBase` as Parameters<typeof t>[0], { id: humanReadableId, store: storeName })}
      {hasPayments && t(`${ns}.descriptionPayments` as Parameters<typeof t>[0])}
    </span>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t(`${ns}.title` as Parameters<typeof t>[0])}
      description={description}
      role="alertdialog"
      closeOnBackdropClick={false}
    >
      {error && (
        <Typography size="sm" className="text-destructive mb-4" role="alert">
          {error}
        </Typography>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="outline" size="md" onClick={handleClose} disabled={isPending}>
          {t(`${ns}.cancel` as Parameters<typeof t>[0])}
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={handleConfirm}
          disabled={isPending}
          className="border-destructive text-destructive hover:bg-destructive/10"
        >
          {isPending ? "…" : t(`${ns}.confirm` as Parameters<typeof t>[0])}
        </Button>
      </div>
    </Modal>
  );
}
