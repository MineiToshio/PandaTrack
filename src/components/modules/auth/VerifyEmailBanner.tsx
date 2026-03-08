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
  return (
    <section
      className="border-border bg-surface/95 w-full border-b backdrop-blur"
      aria-labelledby="verify-email-banner-title"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
        <Typography id="verify-email-banner-title" size="xs" className="text-text-title font-semibold">
          {title}
        </Typography>
        <Typography size="xs" className="text-text-body min-w-0 flex-1">
          {description}
        </Typography>
        <VerificationResend
          locale={locale}
          returnTo={returnTo}
          compact
          buttonLabel={resendLabel}
          pendingLabel={resendPendingLabel}
          successMessage={resendSuccess}
          errorMessage={resendError}
          shownEvent={POSTHOG_EVENTS.AUTH.VERIFY_BANNER_SHOWN}
        />
      </div>
    </section>
  );
}
