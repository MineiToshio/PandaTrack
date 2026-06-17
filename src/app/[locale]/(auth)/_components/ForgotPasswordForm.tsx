"use client";

import { AlertCircle, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
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
      backLink={{ href: signInHref, label: t("linkToSignIn") }}
    >
      <form onSubmit={handleSubmit} noValidate>
        {feedback?.tone === "alert" ? (
          <div className="auth-form-error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{feedback.message}</span>
          </div>
        ) : null}

        <div className="auth-field">
          <label className="auth-label" htmlFor="forgot-password-email">
            {t("email")}
          </label>
          <Input
            id="forgot-password-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isPending}
            required
            error={feedback?.tone === "alert"}
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

        {feedback?.tone === "status" ? (
          <div className="auth-note" role="status" aria-live="polite">
            <Info aria-hidden="true" />
            <span>{feedback.message}</span>
          </div>
        ) : (
          <div className="auth-note">
            <Info aria-hidden="true" />
            <span>{t("neutralNote")}</span>
          </div>
        )}
      </form>
    </AuthFormLayout>
  );
}
