"use client";

import { useCallback, useEffect, useState } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import Button from "@/components/core/Button/Button";
import Typography from "@/components/core/Typography";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { resendVerificationEmail } from "@/app/[locale]/(app)/_actions/resendVerificationEmail";

type VerificationResendProps = {
  locale: string;
  returnTo?: string;
  compact?: boolean;
  suppressFeedback?: boolean;
  buttonLabel: string;
  pendingLabel: string;
  successMessage: string;
  errorMessage: string;
  /**
   * Anti-spam cooldown refusal copy. A template containing a literal `{seconds}` placeholder,
   * replaced with the seconds the server reported remaining. Passed as a plain string (not a
   * function) because this component's callers are Server Components, and only serializable
   * values can cross that boundary as props.
   */
  cooldownMessage: string;
  shownEvent?: string;
  /** `message` is the exact feedback text this component would have shown itself. */
  onResult?: (result: "success" | "error", message: string) => void;
};

type VerificationResendFeedback = { tone: "success" | "error"; message: string };

export default function VerificationResend({
  locale,
  returnTo,
  compact = false,
  suppressFeedback = false,
  buttonLabel,
  pendingLabel,
  successMessage,
  errorMessage,
  cooldownMessage,
  shownEvent,
  onResult,
}: VerificationResendProps) {
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<VerificationResendFeedback | null>(null);

  useEffect(() => {
    if (!shownEvent) {
      return;
    }

    posthog.capture(shownEvent, { locale });
  }, [shownEvent, locale]);

  const handleResend = useCallback(async () => {
    setIsPending(true);
    setFeedback(null);

    try {
      const response = await resendVerificationEmail({ locale, returnTo });

      if (!response.success) {
        const message =
          response.reason === "cooldown"
            ? cooldownMessage.replace("{seconds}", String(response.retryAfterSeconds))
            : errorMessage;
        setFeedback({ tone: "error", message });
        onResult?.("error", message);
        posthog.capture(POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_FAILED, { locale, reason: response.reason });
        return;
      }

      setFeedback({ tone: "success", message: successMessage });
      onResult?.("success", successMessage);
      posthog.capture(POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_SENT, { locale, source: "manual_resend" });
    } catch (error) {
      setFeedback({ tone: "error", message: errorMessage });
      onResult?.("error", errorMessage);
      Sentry.captureException(error);
      posthog.capture(POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_FAILED, { locale, reason: "network_error" });
    } finally {
      setIsPending(false);
    }
  }, [cooldownMessage, errorMessage, locale, onResult, returnTo, successMessage]);

  const feedbackNode =
    feedback?.tone === "success" ? (
      <Typography size="xs" className="text-text-body" role="status" aria-live="polite">
        {feedback.message}
      </Typography>
    ) : feedback?.tone === "error" ? (
      <Typography size="xs" className="text-destructive" role="alert">
        {feedback.message}
      </Typography>
    ) : null;

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "space-y-3"}>
      <Button
        type="button"
        variant="secondary"
        className={compact ? "h-8 px-3 text-xs" : "w-full sm:w-auto"}
        onClick={handleResend}
        disabled={isPending}
        posthogEvent={POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_RESEND_CLICKED}
        posthogProps={{ locale }}
      >
        {isPending ? pendingLabel : buttonLabel}
      </Button>

      {!suppressFeedback && feedbackNode}
    </div>
  );
}
