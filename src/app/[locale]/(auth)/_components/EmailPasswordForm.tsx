"use client";

import Link from "next/link";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import PasswordInput from "@/components/core/PasswordInput";
import Typography from "@/components/core/Typography";

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
  passwordLabel: string;
  passwordAuxiliaryHref?: string;
  passwordAuxiliaryLabel?: string;
  passwordAutoComplete: "current-password" | "new-password";
  hideEmailField?: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

/**
 * Shared email + password form content for sign-in and sign-up.
 * Renders form element, two fields, error message, and submit button.
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
  passwordLabel,
  passwordAuxiliaryHref,
  passwordAuxiliaryLabel,
  passwordAutoComplete,
  hideEmailField = false,
  onSubmit,
}: EmailPasswordFormProps) {
  const emailId = `${idPrefix}-email`;
  const passwordId = `${idPrefix}-password`;

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {hideEmailField ? null : (
        <div className="space-y-2">
          <Label htmlFor={emailId}>{emailLabel}</Label>
          <Input
            id={emailId}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={isPending}
            required
            error={!!error}
          />
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={passwordId}>{passwordLabel}</Label>
          {passwordAuxiliaryHref && passwordAuxiliaryLabel ? (
            <Link
              href={passwordAuxiliaryHref}
              className="text-link focus-visible:ring-ring rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
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
      </div>
      {error && (
        <Typography size="xs" className="text-destructive" role="alert">
          {error}
        </Typography>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "..." : submitLabel}
      </Button>
    </form>
  );
}
