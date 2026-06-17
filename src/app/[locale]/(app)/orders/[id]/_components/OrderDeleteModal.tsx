"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";
import Input from "@/components/core/Input";
import { deleteOrderAction } from "../_actions/orderLifecycleActions";

type OrderDeleteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  humanReadableId: string;
  storeName: string;
  locale: string;
};

const ERROR_MAP: Record<string, string> = {
  HAS_LIVE_DELIVERY_LINKS: "errorLinkedDelivery",
  server_error: "errorGeneral",
  unauthorized: "errorGeneral",
};

export default function OrderDeleteModal({
  isOpen,
  onClose,
  orderId,
  humanReadableId,
  storeName,
  locale,
}: OrderDeleteModalProps) {
  const t = useTranslations("orders");
  const confirmWord = t("detail.deleteModal.typeToConfirmWord");
  const [confirmInput, setConfirmInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmInput.trim().toLowerCase() === confirmWord.toLowerCase();

  async function handleConfirm() {
    if (!canConfirm) return;
    setIsPending(true);
    setError(null);
    const result = await deleteOrderAction(orderId, locale);
    setIsPending(false);
    if (result.ok) {
      // server redirected; nothing to do
    } else {
      const errKey = ERROR_MAP[result.error] ?? "errorGeneral";
      setError(t(`detail.deleteModal.${errKey}` as Parameters<typeof t>[0]));
    }
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
      subtitle={t("detail.deleteModal.subtitle")}
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
      {/* Demo `.m01b-body` body content (CSS lines 2590, plus inline styles in the
          delete-modal markup):
            - description: 13px / text-secondary / line-height 1.45 / margin 0 0 14px
            - field: margin-bottom 0
            - field-label: highlights the confirm word with text-primary + weight 600 */}
      <div>
        <p className="text-text-secondary mb-3.5 text-[13px] leading-[1.45]">
          {t("detail.deleteModal.descriptionBase", { id: humanReadableId, store: storeName })}
        </p>
        <div className="space-y-1.5">
          <label htmlFor="delete-confirm" className="text-text-secondary block text-[13px]">
            {t.rich("detail.deleteModal.typeToConfirmLabel", {
              word: confirmWord,
              strong: (chunks) => <strong className="text-text-title font-semibold">{chunks}</strong>,
            })}
          </label>
          <Input
            id="delete-confirm"
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
          <p className="text-destructive mt-2 text-[13px] leading-[1.45]" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
