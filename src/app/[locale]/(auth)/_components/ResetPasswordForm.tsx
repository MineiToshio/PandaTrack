"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import PasswordInput from "@/components/core/PasswordInput";
import { POSTHOG_EVENTS } from "@/lib/constants";
import AuthFormLayout from "./AuthFormLayout";
import { authClient } from "@/lib/auth/auth-client";

type ResetPasswordFormState = "ready" | "invalid" | "success";

type ResetPasswordFormProps = {
  token?: string;
  signInHref: string;
  forgotPasswordHref: string;
  initialState: ResetPasswordFormState;
  invalidDescription: string;
};

function getResetErrorMessage(errorCode: string | undefined, fallbackMessage: string, invalidMessage: string) {
  if (errorCode === "INVALID_TOKEN") {
    return invalidMessage;
  }

  return fallbackMessage;
}

export default function ResetPasswordForm({
  token,
  signInHref,
  forgotPasswordHref,
  initialState,
  invalidDescription,
}: ResetPasswordFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("auth.resetPassword");
  const tErrors = useTranslations("auth.errors");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<ResetPasswordFormState>(initialState);

  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.AUTH.RESET_PASSWORD_VIEWED, {
      locale,
      state: initialState,
    });
  }, [initialState, locale]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const passwordTrimmed = password.trim();

    if (!passwordTrimmed) {
      setError(tErrors("generic"));
      return;
    }

    if (passwordTrimmed !== passwordRepeat.trim()) {
      setError(t("passwordMismatch"));
      return;
    }

    if (!token) {
      setState("invalid");
      setError(invalidDescription);
      return;
    }

    setIsPending(true);
    posthog.capture(POSTHOG_EVENTS.AUTH.RESET_PASSWORD_SUBMITTED, { locale });

    try {
      const { error: resetError } = await authClient.resetPassword({
        token,
        newPassword: passwordTrimmed,
      });

      if (resetError) {
        const nextMessage = getResetErrorMessage(resetError.code, t("error"), invalidDescription);

        posthog.capture(POSTHOG_EVENTS.AUTH.RESET_PASSWORD_FAILED, {
          locale,
          error_code: resetError.code ?? "unknown",
        });

        if (resetError.code === "INVALID_TOKEN") {
          setState("invalid");
        }

        setError(nextMessage);
        return;
      }

      posthog.capture(POSTHOG_EVENTS.AUTH.RESET_PASSWORD_SUCCESS, { locale });
      setState("success");
      setPassword("");
      setPasswordRepeat("");
    } catch (resetError) {
      Sentry.captureException(resetError);
      posthog.capture(POSTHOG_EVENTS.AUTH.RESET_PASSWORD_FAILED, {
        locale,
        error_code: "network_error",
      });
      setError(t("error"));
    } finally {
      setIsPending(false);
    }
  };

  if (state === "invalid") {
    return (
      <AuthFormLayout title={t("invalidTitle")} description={t("invalidDescription")}>
        <Button as="a" href={forgotPasswordHref} variant="primary" fullWidth className="auth-submit">
          {t("requestAnotherLink")}
        </Button>
        <p className="auth-foot">
          <Link href={signInHref}>{t("linkToSignIn")}</Link>
        </p>
      </AuthFormLayout>
    );
  }

  if (state === "success") {
    return (
      <AuthFormLayout title={t("successTitle")} description={t("successDescription")}>
        <Button variant="primary" fullWidth className="auth-submit" onClick={() => router.push(signInHref)}>
          {t("goToSignIn")}
        </Button>
      </AuthFormLayout>
    );
  }

  return (
    <AuthFormLayout title={t("title")} description={t("description")}>
      <form onSubmit={handleSubmit} noValidate>
        {error ? (
          <div className="auth-form-error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="auth-field">
          <label className="auth-label" htmlFor="reset-password">
            {t("password")}
          </label>
          <PasswordInput
            id="reset-password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending}
            required
            error={!!error}
          />
          <p className="auth-help">{t("passwordHelp")}</p>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="reset-password-repeat">
            {t("passwordRepeat")}
          </label>
          <PasswordInput
            id="reset-password-repeat"
            name="passwordRepeat"
            autoComplete="new-password"
            value={passwordRepeat}
            onChange={(event) => setPasswordRepeat(event.target.value)}
            disabled={isPending}
            required
            error={!!error}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          className="auth-submit"
          loading={isPending}
          disabled={isPending}
        >
          {t("submit")}
        </Button>
      </form>
    </AuthFormLayout>
  );
}
