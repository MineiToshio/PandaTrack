"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import Button from "@/components/core/Button/Button";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import PasswordInput from "@/components/core/PasswordInput";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import {
  submitChangePasswordAction,
  submitEmailChangeAction,
  submitSetPasswordAction,
} from "@/app/[locale]/(app)/settings/_actions/accountCredentialsActions";
import type { AccountCapabilities } from "@/lib/auth/accountCapabilities";
import { SETTINGS_SECTION_SURFACE_CLASSNAME } from "@/app/[locale]/(app)/settings/settingsSectionChrome";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { COLLECTOR_MUTED_INSET_CLASSNAME, cn } from "@/lib/styles";
import type { SettingsAccountErrorCode } from "@/app/[locale]/(app)/settings/_schemas/accountCredentials";
import type { Locale } from "@/types/locale";

type SettingsAccountSectionProps = {
  locale: Locale;
  initialEmail: string;
  emailVerified: boolean;
  capabilities: AccountCapabilities;
};

type ChangePasswordFieldErrors = {
  current?: boolean;
  new?: boolean;
};

type EmailModalFieldErrors = {
  email?: boolean;
  currentPassword?: boolean;
};

function formatRetryAfter(iso: string, locale: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale === "en" ? "en" : "es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderEmailModalEmphasis(chunks: ReactNode) {
  return <strong className="text-text-title font-semibold">{chunks}</strong>;
}

export default function SettingsAccountSection({
  locale,
  initialEmail,
  emailVerified,
  capabilities,
}: SettingsAccountSectionProps) {
  const router = useRouter();
  const t = useTranslations("settings.account");
  const tValidation = useTranslations("settings.account.validation");
  const changeEmailTriggerRef = useRef<HTMLButtonElement>(null);
  const modalNewEmailInputRef = useRef<HTMLInputElement>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [modalNewEmail, setModalNewEmail] = useState("");
  const [modalCurrentPassword, setModalCurrentPassword] = useState("");
  const [emailModalError, setEmailModalError] = useState<string | null>(null);
  const [emailModalFieldErrors, setEmailModalFieldErrors] = useState<EmailModalFieldErrors>({});
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  const [changeCurrentPassword, setChangeCurrentPassword] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [changeFieldErrors, setChangeFieldErrors] = useState<ChangePasswordFieldErrors>({});
  const [changeError, setChangeError] = useState<string | null>(null);
  const [isChangeSubmitting, setIsChangeSubmitting] = useState(false);

  const [setNewPassword, setSetNewPassword] = useState("");
  const [setFieldError, setSetFieldError] = useState(false);
  const [setError, setSetError] = useState<string | null>(null);
  const [isSetSubmitting, setIsSetSubmitting] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const displayEmail = initialEmail;

  const resolveErrorMessage = useCallback(
    (code: SettingsAccountErrorCode, retryAfterIso?: string) => {
      if (code === "rateLimited" && retryAfterIso) {
        return t("errors.rateLimited", { date: formatRetryAfter(retryAfterIso, locale) });
      }
      if (code === "unauthorized") {
        return t("errors.unauthorized");
      }
      if (code === "notAllowed") {
        return t("errors.notAllowed");
      }
      if (code === "sameEmail") {
        return t("errors.sameEmail");
      }
      if (code === "emailTaken") {
        return t("errors.emailTaken");
      }
      if (code === "invalidPassword") {
        return t("errors.invalidPassword");
      }
      if (code === "passwordTooShort") {
        return t("errors.passwordTooShort");
      }
      if (code === "passwordTooLong") {
        return t("errors.passwordTooLong");
      }
      if (code === "passwordAlreadySet") {
        return t("errors.passwordAlreadySet");
      }
      if (code === "validation") {
        return t("errors.validation");
      }
      return t("errors.generic");
    },
    [locale, t],
  );

  const handleOpenEmailModal = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.SETTINGS.ACCOUNT_EMAIL_CHANGE_MODAL_OPENED, { locale });
    setEmailModalError(null);
    setEmailModalFieldErrors({});
    setModalNewEmail("");
    setModalCurrentPassword("");
    setIsEmailModalOpen(true);
  }, [locale]);

  const handleCloseEmailModal = useCallback(() => {
    setIsEmailModalOpen(false);
  }, []);

  const handleSubmitEmailChange = useCallback(async () => {
    setEmailModalError(null);
    const emailEmpty = modalNewEmail.trim().length === 0;
    const passwordEmpty = modalCurrentPassword.length === 0;
    if (emailEmpty || passwordEmpty) {
      setEmailModalFieldErrors({ email: emailEmpty, currentPassword: passwordEmpty });
      return;
    }

    setEmailModalFieldErrors({});
    setIsEmailSubmitting(true);
    posthog.capture(POSTHOG_EVENTS.SETTINGS.ACCOUNT_EMAIL_CHANGE_SUBMITTED, { locale });

    const result = await submitEmailChangeAction({
      locale,
      newEmail: modalNewEmail,
      currentPassword: modalCurrentPassword,
    });

    setIsEmailSubmitting(false);

    if (!result.ok) {
      setEmailModalError(resolveErrorMessage(result.error, result.retryAfterIso));
      return;
    }

    setIsEmailModalOpen(false);
    setModalNewEmail("");
    setModalCurrentPassword("");
    router.refresh();
  }, [locale, modalCurrentPassword, modalNewEmail, resolveErrorMessage, router]);

  const handleSubmitChangePassword = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setChangeError(null);
      setPasswordSuccess(null);

      const currentEmpty = changeCurrentPassword.length === 0;
      const newEmpty = changeNewPassword.trim().length === 0;
      if (currentEmpty || newEmpty) {
        setChangeFieldErrors({ current: currentEmpty, new: newEmpty });
        return;
      }

      setChangeFieldErrors({});
      setIsChangeSubmitting(true);
      posthog.capture(POSTHOG_EVENTS.SETTINGS.ACCOUNT_PASSWORD_CHANGE_SUBMITTED, { locale });

      const result = await submitChangePasswordAction({
        locale,
        currentPassword: changeCurrentPassword,
        newPassword: changeNewPassword,
      });

      setIsChangeSubmitting(false);

      if (!result.ok) {
        setChangeError(resolveErrorMessage(result.error));
        return;
      }

      setChangeCurrentPassword("");
      setChangeNewPassword("");
      setPasswordSuccess(t("success.passwordUpdated"));
      router.refresh();
    },
    [changeCurrentPassword, changeNewPassword, locale, resolveErrorMessage, router, t],
  );

  const handleSubmitSetPassword = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSetError(null);
      setPasswordSuccess(null);

      if (setNewPassword.trim().length === 0) {
        setSetFieldError(true);
        return;
      }

      setSetFieldError(false);
      setIsSetSubmitting(true);
      posthog.capture(POSTHOG_EVENTS.SETTINGS.ACCOUNT_PASSWORD_SET_SUBMITTED, { locale });

      const result = await submitSetPasswordAction({
        locale,
        newPassword: setNewPassword,
      });

      setIsSetSubmitting(false);

      if (!result.ok) {
        setSetError(resolveErrorMessage(result.error));
        return;
      }

      setSetNewPassword("");
      setPasswordSuccess(t("success.passwordSet"));
      router.refresh();
    },
    [locale, resolveErrorMessage, router, setNewPassword, t],
  );

  const handleChangeCurrentPasswordInput = useCallback((value: string) => {
    setChangeCurrentPassword(value);
    setChangeFieldErrors((prev) => ({ ...prev, current: false }));
  }, []);

  const handleChangeNewPasswordInput = useCallback((value: string) => {
    setChangeNewPassword(value);
    setChangeFieldErrors((prev) => ({ ...prev, new: false }));
  }, []);

  const handleSetNewPasswordInput = useCallback((value: string) => {
    setSetNewPassword(value);
    setSetFieldError(false);
  }, []);

  const handleModalEmailChange = useCallback((value: string) => {
    setModalNewEmail(value);
    setEmailModalFieldErrors((prev) => ({ ...prev, email: false }));
  }, []);

  const handleModalPasswordChange = useCallback((value: string) => {
    setModalCurrentPassword(value);
    setEmailModalFieldErrors((prev) => ({ ...prev, currentPassword: false }));
  }, []);

  const showChangeClientHint = changeFieldErrors.current === true || changeFieldErrors.new === true;

  return (
    <section className={SETTINGS_SECTION_SURFACE_CLASSNAME} aria-labelledby="settings-account-heading">
      <SectionTitleWithAccent id="settings-account-heading" as="h2">
        {t("title")}
      </SectionTitleWithAccent>

      <div className="mt-6 space-y-8">
        <div className={COLLECTOR_MUTED_INSET_CLASSNAME}>
          <Typography size="xs" className="text-text-muted mb-2 font-medium">
            {t("email.label")}
          </Typography>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Typography size="sm" className="text-text-body min-w-0 break-all sm:font-medium">
              {displayEmail}
            </Typography>
            {capabilities.canChangeEmail ? (
              <Button
                ref={changeEmailTriggerRef}
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={handleOpenEmailModal}
              >
                {t("email.changeButton")}
              </Button>
            ) : null}
          </div>
          {!capabilities.canChangeEmail ? (
            <Typography size="sm" className="text-text-muted mt-2">
              {t("email.googleHelper")}
            </Typography>
          ) : null}
          {capabilities.canChangeEmail && !emailVerified ? (
            <div
              className="border-info/35 bg-info/12 mt-3 rounded-xl border px-3 py-2.5 sm:px-4"
              role="status"
              aria-live="polite"
            >
              <Typography size="sm" className="text-text-body">
                {t("email.pendingVerification", { email: displayEmail })}
              </Typography>
            </div>
          ) : null}
        </div>

        <div className={COLLECTOR_MUTED_INSET_CLASSNAME}>
          <Typography size="xs" className="text-text-muted mb-4 font-medium">
            {capabilities.canSetPassword ? t("password.setTitle") : t("password.changeTitle")}
          </Typography>
          {passwordSuccess ? (
            <Typography size="sm" className="text-success mb-4" role="status" aria-live="polite">
              {passwordSuccess}
            </Typography>
          ) : null}

          {capabilities.canChangePassword ? (
            <form className="w-full space-y-3 sm:max-w-md" onSubmit={handleSubmitChangePassword} noValidate>
              {changeError ? (
                <Typography size="sm" className="text-destructive" role="alert">
                  {changeError}
                </Typography>
              ) : null}
              {showChangeClientHint ? (
                <Typography size="sm" className="text-destructive" role="alert">
                  {tValidation("fillRequiredFields")}
                </Typography>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="account-current-password">{t("password.currentPassword")}</Label>
                <PasswordInput
                  id="account-current-password"
                  autoComplete="current-password"
                  value={changeCurrentPassword}
                  onChange={(e) => handleChangeCurrentPasswordInput(e.target.value)}
                  disabled={isChangeSubmitting}
                  error={changeFieldErrors.current === true}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-new-password">{t("password.newPassword")}</Label>
                <PasswordInput
                  id="account-new-password"
                  autoComplete="new-password"
                  value={changeNewPassword}
                  onChange={(e) => handleChangeNewPasswordInput(e.target.value)}
                  disabled={isChangeSubmitting}
                  error={changeFieldErrors.new === true}
                />
              </div>
              <Button type="submit" variant="primary" disabled={isChangeSubmitting}>
                {isChangeSubmitting ? t("password.pending") : t("password.save")}
              </Button>
            </form>
          ) : null}

          {capabilities.canSetPassword ? (
            <form className="w-full space-y-3 sm:max-w-md" onSubmit={handleSubmitSetPassword} noValidate>
              {setError ? (
                <Typography size="sm" className="text-destructive" role="alert">
                  {setError}
                </Typography>
              ) : null}
              {setFieldError ? (
                <Typography size="sm" className="text-destructive" role="alert">
                  {tValidation("fillRequiredFields")}
                </Typography>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="account-set-new-password">{t("password.newPassword")}</Label>
                <PasswordInput
                  id="account-set-new-password"
                  autoComplete="new-password"
                  value={setNewPassword}
                  onChange={(e) => handleSetNewPasswordInput(e.target.value)}
                  disabled={isSetSubmitting}
                  error={setFieldError}
                />
              </div>
              <Button type="submit" variant="primary" disabled={isSetSubmitting}>
                {isSetSubmitting ? t("password.pending") : t("password.save")}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={isEmailModalOpen}
        onClose={handleCloseEmailModal}
        title={t("emailModal.title")}
        description={
          <div className="flex flex-col gap-2">
            <p className="m-0">{t("emailModal.descriptionIntro")}</p>
            <p className="m-0">{t.rich("emailModal.descriptionIrreversible", { b: renderEmailModalEmphasis })}</p>
            <p className="m-0">{t.rich("emailModal.descriptionCooldown", { b: renderEmailModalEmphasis })}</p>
          </div>
        }
        initialFocusRef={modalNewEmailInputRef}
        returnFocusRef={changeEmailTriggerRef}
        role="alertdialog"
        closeOnBackdropClick={!isEmailSubmitting}
      >
        <div className="space-y-4">
          {emailModalError ? (
            <Typography size="sm" className="text-destructive" role="alert">
              {emailModalError}
            </Typography>
          ) : null}
          {(emailModalFieldErrors.email === true || emailModalFieldErrors.currentPassword === true) &&
          !emailModalError ? (
            <Typography size="sm" className="text-destructive" role="alert">
              {tValidation("fillRequiredFields")}
            </Typography>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="modal-new-email">{t("emailModal.newEmail")}</Label>
            <Input
              ref={modalNewEmailInputRef}
              id="modal-new-email"
              type="email"
              autoComplete="email"
              value={modalNewEmail}
              onChange={(e) => handleModalEmailChange(e.target.value)}
              disabled={isEmailSubmitting}
              error={emailModalFieldErrors.email === true}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modal-email-current-password">{t("emailModal.currentPassword")}</Label>
            <PasswordInput
              id="modal-email-current-password"
              autoComplete="current-password"
              value={modalCurrentPassword}
              onChange={(e) => handleModalPasswordChange(e.target.value)}
              disabled={isEmailSubmitting}
              error={emailModalFieldErrors.currentPassword === true}
            />
          </div>
          <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end")}>
            <Button type="button" variant="secondary" onClick={handleCloseEmailModal} disabled={isEmailSubmitting}>
              {t("emailModal.cancel")}
            </Button>
            <Button type="button" variant="primary" disabled={isEmailSubmitting} onClick={handleSubmitEmailChange}>
              {isEmailSubmitting ? t("emailModal.pending") : t("emailModal.confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
