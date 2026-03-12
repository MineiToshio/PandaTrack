"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Typography from "@/components/core/Typography";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import AuthFormLayout from "./AuthFormLayout";
import EmailPasswordForm from "./EmailPasswordForm";
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
      <AuthFormLayout
        title={t("invalidTitle")}
        description={t("invalidDescription")}
        footerLinkHref={signInHref}
        footerLinkLabel={t("linkToSignIn")}
        dividerLabel={t("dividerLabel")}
      >
        <div className="space-y-4">
          <Link href={forgotPasswordHref} className={cn(buttonVariants({ variant: "primary" }), "w-full")}>
            {t("requestAnotherLink")}
          </Link>
        </div>
      </AuthFormLayout>
    );
  }

  if (state === "success") {
    return (
      <AuthFormLayout
        title={t("successTitle")}
        description={t("successDescription")}
        footerLinkHref={signInHref}
        footerLinkLabel={t("linkToSignIn")}
        dividerLabel={t("dividerLabel")}
      >
        <Button className="w-full" onClick={() => router.push(signInHref)}>
          {t("goToSignIn")}
        </Button>
      </AuthFormLayout>
    );
  }

  return (
    <AuthFormLayout
      title={t("title")}
      description={t("description")}
      footerLinkHref={signInHref}
      footerLinkLabel={t("linkToSignIn")}
      dividerLabel={t("dividerLabel")}
    >
      <EmailPasswordForm
        idPrefix="reset-password"
        email=""
        password={password}
        onEmailChange={() => {}}
        onPasswordChange={setPassword}
        error={error}
        isPending={isPending}
        submitLabel={t("submit")}
        emailLabel=""
        passwordLabel={t("password")}
        passwordAutoComplete="new-password"
        hideEmailField
        onSubmit={handleSubmit}
      />
      {!error ? (
        <Typography size="xs" className="text-text-muted mt-3" role="status" aria-live="polite">
          {t("helper")}
        </Typography>
      ) : null}
    </AuthFormLayout>
  );
}
