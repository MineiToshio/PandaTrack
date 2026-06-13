"use client";

import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";

type DeliveryCancelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  humanReadableId: string;
  storeName: string;
  productCount: number;
  /** Optimistic-confirmation: the coordinator patches state + owns rollback/toast. */
  onConfirm: () => void;
};

export default function DeliveryCancelModal({
  isOpen,
  onClose,
  humanReadableId,
  storeName,
  productCount,
  onConfirm,
}: DeliveryCancelModalProps) {
  const t = useTranslations("deliveries");

  function handleConfirm() {
    // Cancel is reversible via reopen → optimistic confirmation: dispatch + close sync.
    onConfirm();
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("detail.cancelModal.title")}
      subtitle={`${humanReadableId} · ${storeName}`}
      role="alertdialog"
      tone="warning"
      icon={<Ban />}
      primaryAction={{
        // No explicit variant — sensitive confirms paint the CTA `primary` (playbook §3),
        // matching `OrderCancelModal`.
        label: t("detail.cancelModal.confirm"),
        onClick: handleConfirm,
      }}
      secondaryAction={{
        label: t("detail.cancelModal.back"),
        onClick: onClose,
      }}
    >
      <div className="space-y-3">
        <p className="text-text-secondary text-[13.5px] leading-relaxed">
          {t.rich("detail.cancelModal.description", {
            count: productCount,
            strong: (chunks) => <strong className="text-text-primary font-semibold">{chunks}</strong>,
          })}
        </p>
        <p className="text-text-muted text-[12.5px]">{t("detail.cancelModal.reversibleNote")}</p>
      </div>
    </Modal>
  );
}
