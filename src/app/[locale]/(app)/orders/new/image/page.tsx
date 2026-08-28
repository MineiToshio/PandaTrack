import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BackNavLink from "@/components/core/BackNavLink";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { APP_SHELL_FORM_RAIL_CLASSNAME, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import {
  SHARE_INTAKE_PATH,
  SHARE_SOURCE_IOS_SHORTCUT,
  SHARE_SOURCE_PARAM,
  SHARE_SOURCE_SHARE,
} from "@/lib/pwa/shareStash";
import { listActiveStoreProductTypeKeysCached } from "@/lib/data/catalog/storeProductTypeQueries";
import { getImageIntakeQuotaSnapshotCached } from "@/lib/data/imageIntake/imageIntakeQuotaQueries";
import { getOrderableStores } from "@/lib/data/stores/storeQueries";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { buildPageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import ImageIntakeCurrencyGate from "./_components/ImageIntakeCurrencyGate";
import ImageIntakeScreen from "./_components/ImageIntakeScreen";

/**
 * Server time budget for this route, and therefore for the extraction Server Action posted to it.
 *
 * Extraction is the one action in this product that is genuinely slow: the provider is asked to
 * read a whole conversation out of several photos, which measures at 20 to 40 seconds against the
 * live API, and a transport failure can burn 30 more before the retry that succeeds. The hosting
 * default is 10 seconds, which is not "usually enough" for that work, it is never enough: the
 * function is killed mid-call on every submission, the collector sees a generic failure, and the
 * reservation the ledger wrote before the call is orphaned as `PENDING` and keeps counting against
 * their monthly bag. Without this export the feature cannot succeed in production even once.
 *
 * 60 is the ceiling the current hosting plan allows, so the retry budget in `extractionEngine.ts`
 * (`EXTRACTION_TOTAL_BUDGET_MS`) is sized to land inside it rather than the other way around; the
 * two numbers are a pair and must move together.
 */
export const maxDuration = 60;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [SHARE_SOURCE_PARAM]?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "imageIntake",
    pathSegment: "orders",
    titleKey: "title",
  });
}

/**
 * Order creation from a photo. Server component: it resolves the session, the currency gate, and
 * the store list, then hands the interactive flow to a single client boundary.
 */
export default async function OrdersNewImagePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    // A share that arrives on an expired session must come back here after sign-in, not to the
    // dashboard: the shared photos are waiting in the local stash and this is the only screen that
    // knows how to pick them up. Only the entry-source marker is carried over, never arbitrary
    // query input.
    const resolvedSearchParams = await searchParams;
    const rawSource = resolvedSearchParams[SHARE_SOURCE_PARAM];
    const source = Array.isArray(rawSource) ? rawSource[0] : rawSource;
    const isShareArrival = source === SHARE_SOURCE_SHARE || source === SHARE_SOURCE_IOS_SHORTCUT;

    const returnTo = `/${locale}${SHARE_INTAKE_PATH}${isShareArrival ? `?${SHARE_SOURCE_PARAM}=${source}` : ""}`;
    const signInParams = new URLSearchParams({ [AUTH_RETURN_TO_PARAM]: returnTo });
    redirect(`/${locale}${ROUTES.signIn}?${signInParams.toString()}`);
  }

  const t = await getTranslations({ locale, namespace: "imageIntake" });

  const [preferences, stores, quota, productTypeRows] = await Promise.all([
    getCollectorPreferencesSnapshot(session.user.id),
    getOrderableStores(session.user.id),
    // Read here rather than in the client boundary: the balance decides whether the attach surface
    // renders at all, so it has to be known before the first paint.
    getImageIntakeQuotaSnapshotCached(session.user.id, getIsAdmin(session)),
    // The review screen lets the collector correct a suggested category, so it needs the same live
    // catalog the extraction offered the model, admin-authored types included.
    listActiveStoreProductTypeKeysCached(),
  ]);

  const ordersHref = `/${locale}${ROUTES.orders}`;

  return (
    <div className={cn(APP_SHELL_FORM_RAIL_CLASSNAME, "flex flex-col gap-[var(--space-4)]")}>
      <BackNavLink href={ordersHref}>{t("backToList")}</BackNavLink>

      <h1 className="hidden [font-size:var(--text-title)] leading-tight font-semibold [color:var(--text-primary)] md:block">
        {t("title")}
      </h1>

      {preferences?.baseCurrencyCode ? (
        <ImageIntakeScreen
          storeOptions={stores.map((store) => ({
            id: store.id,
            name: store.name,
            meta: store.countryCode,
            logoUrl: store.logoUrl,
          }))}
          quota={quota}
          baseCurrencyCode={preferences.baseCurrencyCode}
          productTypeKeys={productTypeRows.map((row) => row.key)}
        />
      ) : (
        <ImageIntakeCurrencyGate locale={locale} />
      )}
    </div>
  );
}
