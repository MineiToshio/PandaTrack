"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Typography from "@/components/core/Typography";
import VerificationResend from "@/components/modules/auth/VerificationResend";
import { POSTHOG_EVENTS } from "@/lib/constants";

type VerifyEmailBannerProps = {
  locale: string;
  returnTo: string;
  title: string;
  description: string;
  resendLabel: string;
  resendPendingLabel: string;
  resendSuccess: string;
  resendError: string;
};

export default function VerifyEmailBanner({
  locale,
  returnTo,
  title,
  description,
  resendLabel,
  resendPendingLabel,
  resendSuccess,
  resendError,
}: VerifyEmailBannerProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const handleResendResult = useCallback(
    (result: "success" | "error") => {
      clearResetTimeout();

      if (result === "success") {
        setStatusMessage(resendSuccess);
        resetTimeoutRef.current = setTimeout(() => {
          setStatusMessage(null);
        }, 5000);
        return;
      }

      setStatusMessage(resendError);
    },
    [clearResetTimeout, resendError, resendSuccess],
  );

  useEffect(() => {
    return () => {
      clearResetTimeout();
    };
  }, [clearResetTimeout]);

  return (
    <section
      className="border-border bg-surface/95 w-full border-b backdrop-blur lg:h-14"
      aria-labelledby="verify-email-banner-title"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-2 lg:h-full lg:flex-nowrap">
        <Typography id="verify-email-banner-title" size="xs" className="text-text-title font-semibold">
          {title}
        </Typography>
        <Typography size="xs" className="text-text-body min-w-0 flex-1">
          {statusMessage ?? description}
        </Typography>
        <VerificationResend
          locale={locale}
          returnTo={returnTo}
          compact
          suppressFeedback
          buttonLabel={resendLabel}
          pendingLabel={resendPendingLabel}
          successMessage={resendSuccess}
          errorMessage={resendError}
          shownEvent={POSTHOG_EVENTS.AUTH.VERIFY_BANNER_SHOWN}
          onResult={handleResendResult}
        />
      </div>
    </section>
  );
}
