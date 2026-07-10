"use client";

import { UserPen } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Modal from "@/components/modules/Modal/Modal";
import { saveDisplayNameAction } from "@/app/[locale]/(app)/settings/_actions/profileActions";

const MAX_DISPLAY_NAME = 50;

export type DisplayNameModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  onSaved: (name: string) => void;
};

export default function DisplayNameModal({ isOpen, onClose, initialName, onSaved }: DisplayNameModalProps) {
  const t = useTranslations("settings");
  const fieldId = useId();
  const [value, setValue] = useState(initialName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    // Intentional state reset on modal re-open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initialName);
    setErrorMessage(null);
  }, [initialName, isOpen]);

  const trimmed = value.trim();
  const dirty = trimmed !== initialName.trim();
  const lengthOk = trimmed.length >= 1 && trimmed.length <= MAX_DISPLAY_NAME;
  const canSave = dirty && lengthOk && !isPending;

  const handleSubmit = () => {
    if (!canSave) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await saveDisplayNameAction(trimmed);
      if (!result.ok) {
        setErrorMessage(t(`profile.errors.${result.error}` as never));
        return;
      }
      onSaved(result.name);
      onClose();
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("profile.displayName.modal.title")}
      subtitle={t("profile.displayName.modal.subtitle")}
      icon={<UserPen size={20} aria-hidden="true" />}
      tone="default"
      dismissible={!isPending}
      primaryAction={{
        label: isPending ? t("profile.displayName.modal.pending") : t("profile.displayName.modal.save"),
        onClick: handleSubmit,
        disabled: !canSave,
        loading: isPending,
      }}
      secondaryAction={{
        label: t("profile.displayName.modal.cancel"),
        onClick: onClose,
        disabled: isPending,
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
          error={errorMessage ?? undefined}
          aria-describedby={`${fieldId}-counter`}
        />
        <p id={`${fieldId}-counter`} className="text-right text-[12px] [color:var(--text-muted)]">
          {t("profile.displayName.modal.counter", { count: trimmed.length, max: MAX_DISPLAY_NAME })}
        </p>
      </div>
    </Modal>
  );
}
