import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import VerifyEmailBanner from "@/components/modules/auth/VerifyEmailBanner";
import { AUTH_RETURN_TO_PARAM } from "@/lib/authRedirect";
import { getSession } from "@/lib/auth-server";
import { getVerificationSnapshot, maybeSendDaySixVerificationReminder } from "@/lib/authVerification";
import { ROUTES } from "@/lib/constants";

type PrivateAppLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PrivateAppLayout({ children, params }: PrivateAppLayoutProps) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}${ROUTES.signIn}`);
  }

  const snapshot = await getVerificationSnapshot(session.user.id);

  if (snapshot?.state === "blocked") {
    const gateUrl = new URL(`/${locale}${ROUTES.verifyEmailGate}`, "https://pandatrack.local");
    gateUrl.searchParams.set(AUTH_RETURN_TO_PARAM, `/${locale}${ROUTES.dashboard}`);
    redirect(`${gateUrl.pathname}${gateUrl.search}`);
  }

  if (snapshot?.state === "grace") {
    const requestHeaders = await headers();
    await maybeSendDaySixVerificationReminder(snapshot, `/${locale}${ROUTES.dashboard}`, requestHeaders);
  }

  if (snapshot?.state !== "grace") {
    return <>{children}</>;
  }

  const tVerification = await getTranslations({ locale, namespace: "auth.verificationBanner" });

  return (
    <>
      <div className="sticky top-0 z-50 w-full">
        <VerifyEmailBanner
          locale={locale}
          returnTo={`/${locale}${ROUTES.dashboard}`}
          title={tVerification("title")}
          description={tVerification("description")}
          resendLabel={tVerification("resend")}
          resendPendingLabel={tVerification("resendPending")}
          resendSuccess={tVerification("resendSuccess")}
          resendError={tVerification("resendError")}
        />
      </div>
      {children}
    </>
  );
}
