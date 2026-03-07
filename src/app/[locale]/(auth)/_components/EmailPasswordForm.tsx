"use client";

import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
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
  passwordAutoComplete: "current-password" | "new-password";
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
  passwordAutoComplete,
  onSubmit,
}: EmailPasswordFormProps) {
  const emailId = `${idPrefix}-email`;
  const passwordId = `${idPrefix}-password`;

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
      <div className="space-y-2">
        <Label htmlFor={passwordId}>{passwordLabel}</Label>
        <Input
          id={passwordId}
          type="password"
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
