import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import AppLayout from "@/app/[locale]/(app)/_components/AppLayout/AppLayout";
import { buildStoresNavHref } from "@/app/[locale]/(app)/_utils/storesNavHref";
import VerifyEmailBanner from "@/components/modules/auth/VerifyEmailBanner";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { getSession } from "@/lib/auth/auth-server";
import { getVerificationSnapshot, maybeSendDaySixVerificationReminder } from "@/lib/auth/authVerification";
import { ROUTES, VERIFICATION_BANNER_HEIGHT_PX } from "@/lib/constants";
import { listCountryCodesCached } from "@/lib/data/catalog/countryQueries";
import { listActiveStoreProductTypeKeysCached } from "@/lib/data/catalog/storeProductTypeQueries";
import { getAppShellUserIdentity, getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";

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

  const [tAuth, shellIdentity, collectorPrefs, catalogCountryCodes, catalogProductTypeKeys] = await Promise.all([
    getTranslations({ locale, namespace: "auth" }),
    getAppShellUserIdentity(session.user.id),
    getCollectorPreferencesSnapshot(session.user.id),
    listCountryCodesCached(),
    listActiveStoreProductTypeKeysCached(),
  ]);

  const currentUser = shellIdentity ?? {
    username: session.user.name?.trim() || "user",
    name: session.user.name,
    image: session.user.image,
  };

  const storesHref = buildStoresNavHref(
    locale,
    {
      preferredCountryCode: collectorPrefs?.preferredCountryCode ?? null,
      preferredProductTypeKeys: collectorPrefs?.preferredProductTypeKeys ?? [],
    },
    {
      activeCountryCodes: new Set(catalogCountryCodes.map((r) => r.code)),
      activeProductTypeKeys: new Set(catalogProductTypeKeys.map((r) => r.key)),
    },
  );

  // The shell already knows the stored timezone, so the client capture stays silent unless the
  // browser reports a zone that differs from it.
  const storedTimezone = collectorPrefs?.timezone ?? null;

  if (snapshot?.state !== "grace") {
    return (
      <div
        className="from-background via-primary/3 to-accent/3 min-h-screen bg-linear-to-b"
        style={{ ["--app-banner-offset" as string]: "0px" } as React.CSSProperties}
      >
        <AppLayout
          locale={locale}
          signOutLabel={tAuth("signOut")}
          currentUser={currentUser}
          storesHref={storesHref}
          storedTimezone={storedTimezone}
        >
          {children}
        </AppLayout>
      </div>
    );
  }

  const tVerification = await getTranslations({ locale, namespace: "auth.verificationBanner" });

  return (
    <div
      className="from-background via-primary/3 to-accent/3 min-h-screen bg-linear-to-b"
      style={{ ["--app-banner-offset" as string]: `${VERIFICATION_BANNER_HEIGHT_PX}px` } as React.CSSProperties}
    >
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
      <AppLayout
        locale={locale}
        signOutLabel={tAuth("signOut")}
        currentUser={currentUser}
        storesHref={storesHref}
        storedTimezone={storedTimezone}
      >
        {children}
      </AppLayout>
    </div>
  );
}
