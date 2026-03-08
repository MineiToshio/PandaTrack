import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import VerificationResend from "@/components/modules/auth/VerificationResend";
import { getSession } from "@/lib/auth-server";
import { getVerificationSnapshot } from "@/lib/authVerification";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";

type VerifyEmailRequiredPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function VerifyEmailRequiredPage({ params, searchParams }: VerifyEmailRequiredPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo = resolvedSearchParams.returnTo;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}${ROUTES.signIn}`);
  }

  const snapshot = await getVerificationSnapshot(session.user.id);

  if (!snapshot || snapshot.state !== "blocked") {
    redirect(`/${locale}${ROUTES.dashboard}`);
  }

  const t = await getTranslations({ locale, namespace: "auth.verifyGate" });

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center px-4 py-8">
      <section className="border-border bg-surface mx-auto w-full max-w-xl rounded-xl border p-6 sm:p-8">
        <Heading as="h1" size="sm" className="text-text-title">
          {t("title")}
        </Heading>
        <Typography size="md" className="text-text-body mt-3">
          {t("description")}
        </Typography>
        <Typography size="xs" className="text-text-muted mt-2">
          {t("helpText")}
        </Typography>
        <div className="mt-6">
          <VerificationResend
            locale={locale}
            returnTo={returnTo}
            buttonLabel={t("resend")}
            pendingLabel={t("resendPending")}
            successMessage={t("resendSuccess")}
            errorMessage={t("resendError")}
            shownEvent={POSTHOG_EVENTS.AUTH.PRIVATE_ACCESS_BLOCKED_UNVERIFIED}
          />
        </div>
      </section>
    </main>
  );
}
