import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import AppLayout from "@/app/[locale]/(app)/_components/AppLayout/AppLayout";
import { StoreProductTypeNamesProvider } from "@/app/[locale]/(app)/_components/StoreProductTypeNamesProvider";
import { buildStoresNavHref } from "@/app/[locale]/(app)/_utils/storesNavHref";
import VerifyEmailBanner from "@/components/modules/auth/VerifyEmailBanner";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { getVerificationSnapshot, maybeSendDaySixVerificationReminder } from "@/lib/auth/authVerification";
import { ROUTES, VERIFICATION_BANNER_HEIGHT_PX } from "@/lib/constants";
import { listCountryCodesCached } from "@/lib/data/catalog/countryQueries";
import { getImageIntakeQuotaSnapshotCached } from "@/lib/data/imageIntake/imageIntakeQuotaQueries";
import {
  listActiveStoreProductTypeKeysCached,
  listAuthoredStoreProductTypeNamesCached,
} from "@/lib/data/catalog/storeProductTypeQueries";
import { buildAuthoredStoreProductTypeNameMap } from "@/lib/catalog/resolveStoreProductTypeName";
import { getProgressionShellState } from "@/lib/data/progression/progressionQueries";
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

  // Only a boolean crosses the client boundary; the role string is never exposed to the client.
  const isAdmin = getIsAdmin(session);

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

  const [
    tAuth,
    shellIdentity,
    collectorPrefs,
    catalogCountryCodes,
    catalogProductTypeKeys,
    authoredProductTypeNames,
    // The shell owns this read because the create-method selector opens from the shell's own
    // floating button; `cache()` keeps a page that also renders the selector from reading twice.
    photoCounter,
    progressionShell,
  ] = await Promise.all([
    getTranslations({ locale, namespace: "auth" }),
    getAppShellUserIdentity(session.user.id),
    getCollectorPreferencesSnapshot(session.user.id),
    listCountryCodesCached(),
    listActiveStoreProductTypeKeysCached(),
    listAuthoredStoreProductTypeNamesCached(),
    getImageIntakeQuotaSnapshotCached(session.user.id, isAdmin),
    // Read server-side so a hidden layer never flashes into the nav before the client catches up.
    getProgressionShellState(session.user.id),
  ]);

  // Admin-authored types resolve through the DB name; seeded keys stay on the i18n namespace.
  const authoredProductTypeNameMap = buildAuthoredStoreProductTypeNameMap(authoredProductTypeNames);

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
          isAdmin={isAdmin}
          photoCounter={photoCounter}
          showProgression={!progressionShell.hideProgression}
          welcomeCelebrationPending={progressionShell.welcomeCelebrationPending}
        >
          <StoreProductTypeNamesProvider authoredNames={authoredProductTypeNameMap}>
            {children}
          </StoreProductTypeNamesProvider>
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
          resendCooldown={tVerification.raw("resendCooldown")}
        />
      </div>
      <AppLayout
        locale={locale}
        signOutLabel={tAuth("signOut")}
        currentUser={currentUser}
        storesHref={storesHref}
        storedTimezone={storedTimezone}
        isAdmin={isAdmin}
        photoCounter={photoCounter}
        showProgression={!progressionShell.hideProgression}
      >
        <StoreProductTypeNamesProvider authoredNames={authoredProductTypeNameMap}>
          {children}
        </StoreProductTypeNamesProvider>
      </AppLayout>
    </div>
  );
}
