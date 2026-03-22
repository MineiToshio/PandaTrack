import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import VerificationResend from "@/components/modules/auth/VerificationResend";
import { getSession } from "@/lib/auth/auth-server";
import { getVerificationSnapshot } from "@/lib/auth/authVerification";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import AuthStatusCard from "../_components/AuthStatusCard";

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
      <AuthStatusCard title={t("title")} description={t("description")} helpText={t("helpText")}>
        <VerificationResend
          locale={locale}
          returnTo={returnTo}
          buttonLabel={t("resend")}
          pendingLabel={t("resendPending")}
          successMessage={t("resendSuccess")}
          errorMessage={t("resendError")}
          shownEvent={POSTHOG_EVENTS.AUTH.PRIVATE_ACCESS_BLOCKED_UNVERIFIED}
        />
      </AuthStatusCard>
    </main>
  );
}
