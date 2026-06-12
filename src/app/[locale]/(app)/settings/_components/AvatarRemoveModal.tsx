"use client";

import { ImageOff } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/modules/Modal/Modal";
import { removeAvatarAction } from "@/app/[locale]/(app)/settings/_actions/profileActions";

export type AvatarRemoveModalProps = {
  isOpen: boolean;
  onClose: () => void;
  displayName: string;
  onRemoved: () => void;
};

function getInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase() : "?";
}

export default function AvatarRemoveModal({ isOpen, onClose, displayName, onRemoved }: AvatarRemoveModalProps) {
  const t = useTranslations("settings");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (!result.ok) {
        setErrorMessage(t(`profile.errors.${result.error}` as never));
        return;
      }
      onRemoved();
      onClose();
    });
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
      dismissible={!isPending}
      primaryAction={{
        label: isPending ? t("profile.avatar.removeModal.pending") : t("profile.avatar.removeModal.confirm"),
        onClick: handleConfirm,
        variant: "destructive",
        loading: isPending,
        disabled: isPending,
      }}
      secondaryAction={{
        label: t("profile.avatar.removeModal.cancel"),
        onClick: onClose,
        disabled: isPending,
      }}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed [color:var(--text-secondary)]">
          {t("profile.avatar.removeModal.body")}{" "}
          <span className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {getInitial(displayName)}
          </span>
        </p>
        {errorMessage ? (
          <p role="alert" className="text-[12px] [color:var(--destructive)]">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
