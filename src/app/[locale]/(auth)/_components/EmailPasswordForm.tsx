"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import PasswordInput from "@/components/core/PasswordInput";

type EmailPasswordFormProps = {
  idPrefix: string;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  error: string | null;
  isPending: boolean;
  submitLabel: string;
  emailLabel: string;
  emailPlaceholder?: string;
  passwordLabel: string;
  passwordHelp?: string;
  passwordAuxiliaryHref?: string;
  passwordAuxiliaryLabel?: string;
  passwordAutoComplete: "current-password" | "new-password";
  hideEmailField?: boolean;
  /** Optional content rendered between the fields and the submit button (e.g. terms). */
  beforeSubmit?: ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

/**
 * Shared email + password form body for sign-in and sign-up. Top error banner
 * (`.auth-form-error`), `.auth-field` rows, full-width submit. Reuses core
 * `<Input>` / `<PasswordInput>` (eye toggle + error border live there).
 */
export default function EmailPasswordForm({
  idPrefix,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  error,
  isPending,
  submitLabel,
  emailLabel,
  emailPlaceholder,
  passwordLabel,
  passwordHelp,
  passwordAuxiliaryHref,
  passwordAuxiliaryLabel,
  passwordAutoComplete,
  hideEmailField = false,
  beforeSubmit,
  onSubmit,
}: EmailPasswordFormProps) {
  const emailId = `${idPrefix}-email`;
  const passwordId = `${idPrefix}-password`;

  return (
    <form onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="auth-form-error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {hideEmailField ? null : (
        <div className="auth-field">
          <label className="auth-label" htmlFor={emailId}>
            {emailLabel}
          </label>
          <Input
            id={emailId}
            type="email"
            name="email"
            autoComplete="email"
            placeholder={emailPlaceholder}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={isPending}
            required
            error={!!error}
          />
        </div>
      )}

      <div className="auth-field">
        <div className="auth-label">
          <label htmlFor={passwordId}>{passwordLabel}</label>
          {passwordAuxiliaryHref && passwordAuxiliaryLabel ? (
            <Link href={passwordAuxiliaryHref} className="auth-link">
              {passwordAuxiliaryLabel}
            </Link>
          ) : null}
        </div>
        <PasswordInput
          id={passwordId}
          name="password"
          autoComplete={passwordAutoComplete}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          disabled={isPending}
          required
          error={!!error}
        />
        {passwordHelp ? <p className="auth-help">{passwordHelp}</p> : null}
      </div>

      {beforeSubmit}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        className="auth-submit"
        loading={isPending}
        disabled={isPending}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
