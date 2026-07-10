"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";
import Input from "@/components/core/Input";
import { deleteDeliveryAction } from "../_actions/deliveryLifecycleActions";

type DeliveryDeleteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  deliveryId: string;
  humanReadableId: string;
  storeName: string;
  locale: string;
};

/**
 * Type-to-confirm destructive delete (parity with order delete). Awaited
 * submit — permitted exception to optimistic confirmation: irreversible destructive
 * flow; the server action redirects to the list on success.
 */
export default function DeliveryDeleteModal({
  isOpen,
  onClose,
  deliveryId,
  humanReadableId,
  storeName,
  locale,
}: DeliveryDeleteModalProps) {
  const t = useTranslations("deliveries");
  const confirmWord = t("detail.deleteModal.typeToConfirmWord");
  const [confirmInput, setConfirmInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmInput.trim().toLowerCase() === confirmWord.toLowerCase();

  async function handleConfirm() {
    if (!canConfirm) return;
    setIsPending(true);
    setError(null);
    const result = await deleteDeliveryAction(deliveryId, locale);
    setIsPending(false);
    if (!result.ok) {
      setError(
        result.error === "INVALID_STATUS"
          ? t("detail.deleteModal.errorInvalidStatus")
          : t("detail.deleteModal.errorGeneral"),
      );
    }
    // On success the server action redirected; nothing to do.
  }

  function handleClose() {
    if (isPending) return;
    setError(null);
    setConfirmInput("");
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("detail.deleteModal.title")}
      subtitle={`${humanReadableId} · ${storeName}`}
      role="alertdialog"
      tone="destructive"
      icon={<Trash2 />}
      dismissible={!isPending}
      primaryAction={{
        label: t("detail.deleteModal.confirm"),
        onClick: () => void handleConfirm(),
        variant: "destructive",
        loading: isPending,
        disabled: !canConfirm,
      }}
      secondaryAction={{
        label: t("detail.deleteModal.cancel"),
        onClick: handleClose,
        disabled: isPending,
      }}
    >
      <div>
        <p className="text-text-secondary mb-3.5 text-[13.5px] leading-relaxed">
          {t.rich("detail.deleteModal.description", {
            id: humanReadableId,
            strong: (chunks) => <strong className="text-text-primary font-semibold">{chunks}</strong>,
          })}
        </p>
        <div className="space-y-1.5">
          <label htmlFor="delivery-delete-confirm" className="text-text-secondary block text-[13px]">
            {t.rich("detail.deleteModal.typeToConfirmLabel", {
              word: confirmWord,
              strong: (chunks) => <strong className="text-text-title font-semibold">{chunks}</strong>,
            })}
          </label>
          <Input
            id="delivery-delete-confirm"
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            disabled={isPending}
            placeholder={confirmWord}
            autoComplete="off"
            autoCapitalize="off"
          />
        </div>
        {error && (
          <p className="text-destructive mt-2 text-[13px] leading-snug" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
