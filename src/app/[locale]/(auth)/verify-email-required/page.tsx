import { ShieldAlert } from "lucide-react";
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
    <AuthStatusCard
      icon={<ShieldAlert aria-hidden="true" />}
      tone="warning"
      title={t("title")}
      description={t("description")}
      note={t("helpText")}
    >
      <VerificationResend
        locale={locale}
        returnTo={returnTo}
        buttonLabel={t("resend")}
        pendingLabel={t("resendPending")}
        successMessage={t("resendSuccess")}
        errorMessage={t("resendError")}
        cooldownMessage={t.raw("resendCooldown")}
        shownEvent={POSTHOG_EVENTS.AUTH.PRIVATE_ACCESS_BLOCKED_UNVERIFIED}
      />
    </AuthStatusCard>
  );
}
