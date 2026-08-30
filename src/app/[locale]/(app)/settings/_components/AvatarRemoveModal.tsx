"use client";

import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import Modal from "@/components/modules/Modal/Modal";

export type AvatarRemoveModalProps = {
  isOpen: boolean;
  onClose: () => void;
  displayName: string;
  /**
   * Fires synchronously on confirm, before the modal closes. The parent coordinator owns the
   * optimistic patch, the Server Action dispatch, and the rollback + toast on failure
   * (`optimistic-client-updates.mdc`) — this modal never awaits the server.
   */
  onConfirm: () => void;
};

function getInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase() : "?";
}

export default function AvatarRemoveModal({ isOpen, onClose, displayName, onConfirm }: AvatarRemoveModalProps) {
  const t = useTranslations("settings");

  const handleConfirm = () => {
    // Optimistic Confirmation: close synchronously and let the parent apply the removal locally
    // in parallel with the Server Action.
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("profile.avatar.removeModal.title")}
      subtitle={t("profile.avatar.removeModal.subtitle")}
      icon={<ImageOff size={20} aria-hidden="true" />}
      tone="destructive"
      role="alertdialog"
      primaryAction={{
        label: t("profile.avatar.removeModal.confirm"),
        onClick: handleConfirm,
        variant: "destructive",
      }}
      secondaryAction={{
        label: t("profile.avatar.removeModal.cancel"),
        onClick: onClose,
      }}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed [color:var(--text-secondary)]">
          {t("profile.avatar.removeModal.body")}{" "}
          <span className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {getInitial(displayName)}
          </span>
        </p>
      </div>
    </Modal>
  );
}
