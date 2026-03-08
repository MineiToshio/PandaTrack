"use client";

import { useCallback, useEffect, useState } from "react";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import Typography from "@/components/core/Typography";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { resendVerificationEmail } from "@/app/[locale]/(app)/_actions/resendVerificationEmail";

type VerificationResendProps = {
  locale: string;
  returnTo?: string;
  compact?: boolean;
  buttonLabel: string;
  pendingLabel: string;
  successMessage: string;
  errorMessage: string;
  shownEvent?: string;
};

export default function VerificationResend({
  locale,
  returnTo,
  compact = false,
  buttonLabel,
  pendingLabel,
  successMessage,
  errorMessage,
  shownEvent,
}: VerificationResendProps) {
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

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
        setFeedback("error");
        posthog.capture(POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_FAILED, { locale, reason: response.reason });
        return;
      }

      setFeedback("success");
      posthog.capture(POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_SENT, { locale, source: "manual_resend" });
    } catch {
      setFeedback("error");
      posthog.capture(POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_FAILED, { locale, reason: "network_error" });
    } finally {
      setIsPending(false);
    }
  }, [locale, returnTo]);

  const feedbackNode =
    feedback === "success" ? (
      <Typography size="xs" className="text-text-body" role="status" aria-live="polite">
        {successMessage}
      </Typography>
    ) : feedback === "error" ? (
      <Typography size="xs" className="text-destructive" role="alert">
        {errorMessage}
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

      {feedbackNode}
    </div>
  );
}
