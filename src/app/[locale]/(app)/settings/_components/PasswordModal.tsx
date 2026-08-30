"use client";

import { LockKeyhole } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Modal from "@/components/modules/Modal/Modal";
import {
  submitChangePasswordAction,
  submitSetPasswordAction,
} from "@/app/[locale]/(app)/settings/_actions/accountCredentialsActions";
import type { Locale } from "@/types/locale";
import PasswordRules, { MIN_PASSWORD_LENGTH, evaluatePasswordRules } from "./PasswordRules";
import PasswordStrengthMeter, { scorePasswordStrength, type PasswordStrengthLevel } from "./PasswordStrengthMeter";

export type PasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  /** When true, the user has a credential account and is changing an existing password.
   *  When false, they are setting one for the first time (Google-linked account). */
  isChange: boolean;
  onSaved: () => void;
};

function getStrengthLabel(level: PasswordStrengthLevel, labels: Record<string, string>): string {
  switch (level) {
    case 0:
      return "";
    case 1:
      return labels.weak;
    case 2:
      return labels.fair;
    case 3:
      return labels.good;
    case 4:
      return labels.excellent;
  }
}

/**
 * Password change/set, awaited-then-close. A documented exception to the repository's default
 * Optimistic Confirmation pattern (`optimistic-client-updates.mdc`), for the same two reasons
 * `VoidPointsControl` records for the point void:
 *
 * - Credential-gated mutation with server-side rules the client cannot fully pre-verify: the
 *   server re-checks the current password (on change) and its own strength/format rules, so a
 *   "saved" state painted before that check would be an honest guess, not a fact.
 * - Rare and high-stakes enough that a brief wait is the better UX: a wrong optimistic confirmation
 *   here would read as "your password changed" when it did not, on the one credential that gates
 *   every other account action.
 *
 * The modal therefore stays open with a pending primary action until the server answers.
 */
export default function PasswordModal({ isOpen, onClose, locale, isChange, onSaved }: PasswordModalProps) {
  const t = useTranslations("settings");
  const currentId = useId();
  const newId = useId();
  const confirmId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    // Intentional state reset on modal re-open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrorMessage(null);
  }, [isOpen]);

  const lengthOk = newPassword.length >= MIN_PASSWORD_LENGTH;
  const confirmOk = confirmPassword === newPassword;
  const canSubmit = !isPending && lengthOk && confirmOk && (!isChange || currentPassword.length > 0);

  const rules = evaluatePasswordRules(newPassword, { minLength: t("account.password.rules.minLength") });
  const strengthLevel = scorePasswordStrength(newPassword);
  const strengthLabels = {
    weak: t("account.password.strength.weak"),
    fair: t("account.password.strength.fair"),
    good: t("account.password.strength.good"),
    excellent: t("account.password.strength.excellent"),
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (!confirmOk) {
      setErrorMessage(t("account.password.validation.confirmMismatch"));
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      const result = isChange
        ? await submitChangePasswordAction({ locale, currentPassword, newPassword })
        : await submitSetPasswordAction({ locale, newPassword });
      if (!result.ok) {
        setErrorMessage(t(`account.errors.${result.error}` as never));
        return;
      }
      onSaved();
      onClose();
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isChange ? t("account.password.modal.changeTitle") : t("account.password.modal.setTitle")}
      subtitle={t("account.password.modal.subtitle")}
      icon={<LockKeyhole size={20} aria-hidden="true" />}
      tone="default"
      dismissible={!isPending}
      primaryAction={{
        label: isPending ? t("account.password.modal.pending") : t("account.password.modal.save"),
        onClick: handleSubmit,
        disabled: !canSubmit,
        loading: isPending,
      }}
      secondaryAction={{
        label: t("account.password.modal.cancel"),
        onClick: onClose,
        disabled: isPending,
      }}
    >
      <div className="space-y-4">
        {isChange ? (
          <div className="space-y-2">
            <Label htmlFor={currentId}>{t("account.password.modal.currentPasswordLabel")}</Label>
            <Input
              id={currentId}
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              autoFocus
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={newId}>{t("account.password.modal.newPasswordLabel")}</Label>
          <Input
            id={newId}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            autoFocus={!isChange}
          />
          <PasswordRules rules={rules} pristine={newPassword.length === 0} />
          {newPassword.length > 0 ? (
            <PasswordStrengthMeter
              level={strengthLevel}
              label={getStrengthLabel(strengthLevel, strengthLabels)}
              meterLabel={t("account.password.strength.label")}
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={confirmId}>{t("account.password.modal.confirmPasswordLabel")}</Label>
          <Input
            id={confirmId}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            error={
              confirmPassword.length > 0 && !confirmOk ? t("account.password.validation.confirmMismatch") : undefined
            }
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
