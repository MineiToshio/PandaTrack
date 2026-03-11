"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Typography from "@/components/core/Typography";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import AuthFormLayout from "./AuthFormLayout";
import { authClient } from "@/lib/auth/auth-client";

type ForgotPasswordFormProps = {
  locale: string;
  signInHref: string;
};

export default function ForgotPasswordForm({ locale, signInHref }: ForgotPasswordFormProps) {
  const t = useTranslations("auth.forgotPassword");
  const tErrors = useTranslations("auth.errors");
  const tAuth = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setHasSubmitted(false);

    const emailTrimmed = email.trim();

    if (!emailTrimmed) {
      setError(tErrors("emailRequired"));
      return;
    }

    if (!emailTrimmed.includes("@")) {
      setError(tErrors("emailInvalid"));
      return;
    }

    setIsPending(true);
    posthog.capture(POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_SUBMITTED, { locale });

    try {
      const { error: requestError } = await authClient.requestPasswordReset({
        email: emailTrimmed,
        redirectTo: `/${locale}${ROUTES.resetPassword}`,
      });

      if (requestError) {
        posthog.capture(POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_FAILED, {
          locale,
          error_code: requestError.code ?? "unknown",
        });
        setError(t("retryLater"));
        return;
      }

      setHasSubmitted(true);
    } catch (requestError) {
      Sentry.captureException(requestError);
      posthog.capture(POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_FAILED, {
        locale,
        error_code: "network_error",
      });
      setError(t("retryLater"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AuthFormLayout
      title={t("title")}
      description={t("description")}
      footerLinkHref={signInHref}
      footerLinkLabel={t("linkToSignIn")}
      dividerLabel={tAuth("dividerOr")}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="forgot-password-email">{t("email")}</Label>
          <Input
            id="forgot-password-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isPending}
            required
            error={!!error}
          />
        </div>
        {hasSubmitted ? (
          <Typography size="xs" className="text-text-body" role="status" aria-live="polite">
            {t("success")}
          </Typography>
        ) : null}
        {error ? (
          <Typography size="xs" className="text-destructive" role="alert">
            {error}
          </Typography>
        ) : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "..." : t("submit")}
        </Button>
      </form>
    </AuthFormLayout>
  );
}
