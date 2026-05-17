"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { cancelOrderAction } from "../_actions/orderLifecycleActions";

type OrderCancelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  humanReadableId: string;
  storeName: string;
  onSuccess?: () => void;
};

const ERROR_MAP: Record<string, string> = {
  HAS_LIVE_DELIVERY_LINKS: "errorLinkedDelivery",
  server_error: "errorGeneral",
  unauthorized: "errorGeneral",
};

export default function OrderCancelModal({
  isOpen,
  onClose,
  orderId,
  humanReadableId,
  storeName,
  onSuccess,
}: OrderCancelModalProps) {
  const t = useTranslations("orders");
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await cancelOrderAction(orderId, reason.trim() || null);
    setIsPending(false);
    if (result.ok) {
      setReason("");
      onSuccess?.();
      onClose();
    } else {
      const errKey = ERROR_MAP[result.error] ?? "errorGeneral";
      setError(t(`detail.cancelModal.${errKey}` as Parameters<typeof t>[0]));
    }
  }

  function handleClose() {
    if (isPending) return;
    setError(null);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("detail.cancelModal.title")}
      subtitle={t("detail.cancelModal.subtitle")}
      role="alertdialog"
      tone="warning"
      icon={<Ban />}
      dismissible={!isPending}
      primaryAction={{
        label: t("detail.cancelModal.confirm"),
        onClick: () => void handleConfirm(),
        loading: isPending,
      }}
      secondaryAction={{
        label: t("detail.cancelModal.cancel"),
        onClick: handleClose,
        disabled: isPending,
      }}
    >
      <div className="space-y-3">
        {/* Body para — matches demo `#s7-order-detail-cancel-modal` paragraph above the reason field. */}
        <p className="text-text-secondary text-[13px] leading-snug">
          {t("detail.cancelModal.descriptionBase", { id: humanReadableId, store: storeName })}
        </p>
        <label htmlFor="cancel-reason" className="text-text-secondary block text-[13px]">
          {t("detail.cancelModal.reasonLabel")}
        </label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          disabled={isPending}
          placeholder={t("detail.cancelModal.reasonPlaceholder")}
          className="resize-none"
        />
        {error && (
          <Typography size="sm" className="text-destructive" role="alert">
            {error}
          </Typography>
        )}
      </div>
    </Modal>
  );
}
