"use client";

import { UserPen } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Modal from "@/components/modules/Modal/Modal";

const MAX_DISPLAY_NAME = 50;

export type DisplayNameModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  /**
   * Fires synchronously on submit, before the modal closes. The parent coordinator owns the
   * optimistic patch, the Server Action dispatch, and the rollback + toast on failure
   * (`optimistic-client-updates.mdc`) — this modal never awaits the server.
   */
  onSubmit: (trimmedName: string) => void;
};

export default function DisplayNameModal({ isOpen, onClose, initialName, onSubmit }: DisplayNameModalProps) {
  const t = useTranslations("settings");
  const fieldId = useId();
  const [value, setValue] = useState(initialName);

  useEffect(() => {
    if (!isOpen) return;
    // Intentional state reset on modal re-open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initialName);
  }, [initialName, isOpen]);

  const trimmed = value.trim();
  const dirty = trimmed !== initialName.trim();
  const lengthOk = trimmed.length >= 1 && trimmed.length <= MAX_DISPLAY_NAME;
  const canSave = dirty && lengthOk;

  const handleSubmit = () => {
    if (!canSave) return;
    // Optimistic Confirmation: close synchronously and let the parent apply the change locally
    // in parallel with the Server Action.
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("profile.displayName.modal.title")}
      subtitle={t("profile.displayName.modal.subtitle")}
      icon={<UserPen size={20} aria-hidden="true" />}
      tone="default"
      primaryAction={{
        label: t("profile.displayName.modal.save"),
        onClick: handleSubmit,
        disabled: !canSave,
      }}
      secondaryAction={{
        label: t("profile.displayName.modal.cancel"),
        onClick: onClose,
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={fieldId}>{t("profile.displayName.modal.label")}</Label>
        <Input
          id={fieldId}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={MAX_DISPLAY_NAME}
          autoComplete="name"
          autoFocus
          aria-describedby={`${fieldId}-counter`}
        />
        <p id={`${fieldId}-counter`} className="text-right text-[12px] [color:var(--text-muted)]">
          {t("profile.displayName.modal.counter", { count: trimmed.length, max: MAX_DISPLAY_NAME })}
        </p>
      </div>
    </Modal>
  );
}
