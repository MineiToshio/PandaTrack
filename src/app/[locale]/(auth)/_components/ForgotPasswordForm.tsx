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
import {
  getPasswordRecoveryActiveThrottleState,
  getPasswordRecoveryNextThrottleState,
  getPasswordRecoveryRemainingMinutes,
  parsePasswordRecoveryThrottleState,
  PASSWORD_RECOVERY_CLIENT_STORAGE_KEY,
} from "@/lib/auth/passwordRecoveryThrottle";
import AuthFormLayout from "./AuthFormLayout";
import { authClient } from "@/lib/auth/auth-client";

type ForgotPasswordFormProps = {
  locale: string;
  signInHref: string;
};

type ForgotPasswordFeedback = { tone: "status"; message: string } | { tone: "alert"; message: string } | null;

function normalizeRecoveryEmail(email: string) {
  return email.trim().toLowerCase();
}

function readPasswordRecoveryThrottleMap() {
  try {
    const rawValue = window.localStorage.getItem(PASSWORD_RECOVERY_CLIENT_STORAGE_KEY);

    if (!rawValue) {
      return {} as Record<string, string>;
    }

    const parsed = JSON.parse(rawValue);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {} as Record<string, string>;
  }
}

function writePasswordRecoveryThrottleState(email: string, serializedState: string) {
  const throttleMap = readPasswordRecoveryThrottleMap();

  throttleMap[normalizeRecoveryEmail(email)] = serializedState;
  window.localStorage.setItem(PASSWORD_RECOVERY_CLIENT_STORAGE_KEY, JSON.stringify(throttleMap));
}

function getStoredPasswordRecoveryThrottleState(email: string) {
  const throttleMap = readPasswordRecoveryThrottleMap();
  return parsePasswordRecoveryThrottleState(throttleMap[normalizeRecoveryEmail(email)]);
}

export default function ForgotPasswordForm({ locale, signInHref }: ForgotPasswordFormProps) {
  const t = useTranslations("auth.forgotPassword");
  const tErrors = useTranslations("auth.errors");
  const tAuth = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<ForgotPasswordFeedback>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const emailTrimmed = email.trim();

    if (!emailTrimmed) {
      setFeedback({ tone: "alert", message: tErrors("emailRequired") });
      return;
    }

    if (!emailTrimmed.includes("@")) {
      setFeedback({ tone: "alert", message: tErrors("emailInvalid") });
      return;
    }

    const now = new Date();
    const activeThrottleState = getPasswordRecoveryActiveThrottleState(
      getStoredPasswordRecoveryThrottleState(emailTrimmed),
      now,
    );

    if (activeThrottleState) {
      setFeedback({
        tone: "status",
        message: t("cooldownNotice", {
          minutes: getPasswordRecoveryRemainingMinutes(activeThrottleState, now),
        }),
      });
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
        setFeedback({ tone: "alert", message: t("retryLater") });
        return;
      }

      const nextThrottleState = getPasswordRecoveryNextThrottleState(null, new Date());

      writePasswordRecoveryThrottleState(emailTrimmed, JSON.stringify(nextThrottleState));
      setFeedback({
        tone: "status",
        message: t("success"),
      });
    } catch (requestError) {
      Sentry.captureException(requestError);
      posthog.capture(POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_FAILED, {
        locale,
        error_code: "network_error",
      });
      setFeedback({ tone: "alert", message: t("retryLater") });
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
            error={feedback?.tone === "alert"}
          />
        </div>
        {feedback?.tone === "status" ? (
          <Typography size="xs" className="text-text-body" role="status" aria-live="polite">
            {feedback.message}
          </Typography>
        ) : null}
        {feedback?.tone === "alert" ? (
          <Typography size="xs" className="text-destructive" role="alert">
            {feedback.message}
          </Typography>
        ) : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "..." : t("submit")}
        </Button>
      </form>
    </AuthFormLayout>
  );
}
