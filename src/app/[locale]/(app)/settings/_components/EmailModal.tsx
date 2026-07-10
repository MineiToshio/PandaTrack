"use client";

import { Mail } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Modal from "@/components/modules/Modal/Modal";
import { submitEmailChangeAction } from "@/app/[locale]/(app)/settings/_actions/accountCredentialsActions";
import type { Locale } from "@/types/locale";

export type EmailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  onChanged: (newEmail: string) => void;
};

export default function EmailModal({ isOpen, onClose, locale, onChanged }: EmailModalProps) {
  const t = useTranslations("settings");
  const emailId = useId();
  const passwordId = useId();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    // Intentional state reset on modal re-open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewEmail("");
    setCurrentPassword("");
    setErrorMessage(null);
  }, [isOpen]);

  const canSubmit = !isPending && newEmail.trim().length > 0 && currentPassword.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await submitEmailChangeAction({
        locale,
        newEmail: newEmail.trim(),
        currentPassword,
      });
      if (!result.ok) {
        if (result.error === "rateLimited" && result.retryAfterIso) {
          const date = new Date(result.retryAfterIso).toLocaleDateString();
          setErrorMessage(t("account.errors.rateLimited", { date }));
        } else {
          setErrorMessage(t(`account.errors.${result.error}` as never));
        }
        return;
      }
      onChanged(newEmail.trim());
      onClose();
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("account.email.modal.title")}
      subtitle={t("account.email.modal.subtitle")}
      icon={<Mail size={20} aria-hidden="true" />}
      tone="warning"
      dismissible={!isPending}
      primaryAction={{
        label: isPending ? t("account.email.modal.pending") : t("account.email.modal.confirm"),
        onClick: handleSubmit,
        disabled: !canSubmit,
        loading: isPending,
      }}
      secondaryAction={{
        label: t("account.email.modal.cancel"),
        onClick: onClose,
        disabled: isPending,
      }}
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed [color:var(--text-secondary)]">
          {t("account.email.modal.introBlock")}
        </p>
        <p className="text-[13px] leading-relaxed [color:var(--text-secondary)]">
          {t("account.email.modal.cooldownBlock")}
        </p>
        <div className="space-y-2">
          <Label htmlFor={emailId}>{t("account.email.modal.newEmailLabel")}</Label>
          <Input
            id={emailId}
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            autoComplete="email"
            placeholder={t("account.email.modal.newEmailPlaceholder")}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={passwordId}>{t("account.email.modal.currentPasswordLabel")}</Label>
          <Input
            id={passwordId}
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>
        {errorMessage ? (
          <p role="alert" className="text-[12px] [color:var(--destructive)]">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
