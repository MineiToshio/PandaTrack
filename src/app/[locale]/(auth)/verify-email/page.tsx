import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import VerificationResend from "@/components/modules/auth/VerificationResend";
import { buildAuthAlternativeHref, resolveAuthCallbackURL } from "@/lib/auth/authRedirect";
import { getSession } from "@/lib/auth/auth-server";
import { getVerificationSnapshot } from "@/lib/auth/authVerification";
import { ROUTES } from "@/lib/constants";

type VerifyEmailStatusPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; returnTo?: string }>;
};

function getStatusCopyKey(error: string | undefined) {
  if (error === "TOKEN_EXPIRED") {
    return {
      title: "expiredTitle",
      description: "expiredDescription",
    } as const;
  }

  return {
    title: "invalidTitle",
    description: "invalidDescription",
  } as const;
}

export default async function VerifyEmailStatusPage({ params, searchParams }: VerifyEmailStatusPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams.error;
  const returnTo = resolveAuthCallbackURL(locale, resolvedSearchParams.returnTo);
  const session = await getSession();

  if (!error) {
    if (!session) {
      redirect(`/${locale}${ROUTES.signIn}`);
    }

    const snapshot = await getVerificationSnapshot(session.user.id);

    if (!snapshot || snapshot.state === "verified" || snapshot.state === "not_applicable") {
      redirect(returnTo);
    }

    if (snapshot.state === "blocked") {
      redirect(buildAuthAlternativeHref(ROUTES.verifyEmailGate, locale, returnTo));
    }

    redirect(returnTo);
  }

  const t = await getTranslations({ locale, namespace: "auth.verifyEmailStatus" });
  const copyKey = getStatusCopyKey(error);

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center px-4 py-8">
      <section className="border-border bg-surface mx-auto w-full max-w-xl rounded-xl border p-6 sm:p-8">
        <Heading as="h1" size="sm" className="text-text-title">
          {t(copyKey.title)}
        </Heading>
        <Typography size="md" className="text-text-body mt-3">
          {t(copyKey.description)}
        </Typography>

        <div className="mt-6">
          {session ? (
            <VerificationResend
              locale={locale}
              returnTo={returnTo}
              buttonLabel={t("resend")}
              pendingLabel={t("resendPending")}
              successMessage={t("resendSuccess")}
              errorMessage={t("resendError")}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <Typography size="sm" className="text-text-title">
                  {t("signInTitle")}
                </Typography>
                <Typography size="xs" className="text-text-muted mt-2">
                  {t("signInDescription")}
                </Typography>
              </div>
              <Link
                href={buildAuthAlternativeHref(ROUTES.signIn, locale, returnTo)}
                className={`${buttonVariants({ variant: "primary" })} w-full sm:w-auto`}
              >
                {t("signInCta")}
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
