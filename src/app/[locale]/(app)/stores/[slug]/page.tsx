import { notFound } from "next/navigation";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import {
  getPublicStoreReviews,
  getStoreBySlug,
  getStoreViewerContext,
  getViewerStoreActivity,
  type ViewerStoreActivity,
} from "@/lib/data/stores/storeQueries";
import {
  getStoreDebtByCurrency,
  getStorePaymentsForStore,
  type StoreDebtRow,
  type StorePaymentsForStoreResult,
} from "@/lib/data/orders/storePaymentQueries";
import {
  listStoreAccountAdjustmentCurrencyCodes,
  listStoreAccountAdjustments,
} from "@/lib/data/orders/storeAccountAdjustmentQueries";
import type { StoreReconciliationAdjustmentRow } from "./_components/StoreReconciliationProvider";
import {
  getEditableStoreBySlug,
  getStoreGovernanceSummary,
  getStoreGovernanceViewerContext,
} from "@/lib/data/stores/storeGovernanceQueries";
import { getAdminOpenStoreReports } from "@/lib/data/admin/adminStoreReportQueries";
import { getAdminPendingStoreChangeRequests } from "@/lib/data/admin/adminStoreChangeRequestQueries";
import { listAuthoredStoreProductTypeNamesCached } from "@/lib/data/catalog/storeProductTypeQueries";
import { buildAuthoredStoreProductTypeNameMap } from "@/lib/catalog/resolveStoreProductTypeName";
import { buildStoreDetailMetadata } from "@/lib/seo";
import { safeRelativeReturnTo } from "@/lib/navigation/safeRelativeReturnTo";
import StoreDetailContent from "./_components/StoreDetailContent";

type StoreDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STORE_RETURN_LABEL_PARAM = "returnLabel";

export async function generateMetadata({ params }: StoreDetailPageProps) {
  const { locale, slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  return buildStoreDetailMetadata({
    locale,
    storeName: store.name,
    slug,
    // `PENDING` is the only `noindex` rule. Reports deliberately never affect indexing: deindexing
    // is slow to reverse, so a single report must not be able to cost a store its discoverability.
    noindex: store.status === "PENDING",
  });
}

export default async function StoreDetailPage({ params, searchParams }: StoreDetailPageProps) {
  const { locale, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const backHref = safeRelativeReturnTo(resolvedSearchParams.returnTo);
  const returnLabelRaw = resolvedSearchParams[STORE_RETURN_LABEL_PARAM];
  const backOrderLabel = typeof returnLabelRaw === "string" && returnLabelRaw.trim() ? returnLabelRaw.trim() : null;
  const store = await getStoreBySlug(slug);
  const editableStore = await getEditableStoreBySlug(slug);

  if (!store || !editableStore) {
    notFound();
  }

  const session = await getSession();
  const isAdmin = getIsAdmin(session);

  // Per ADR 0009: private person stores are accessible only to their creator (or admins).
  // Return 404 (not 403) so the existence is not exposed to other users.
  if (store.isPrivate && !isAdmin && store.createdByUserId !== session?.user?.id) {
    notFound();
  }
  const [
    reviews,
    viewerContext,
    governanceSummary,
    governanceViewerContext,
    viewerActivity,
    storeDebtByCurrency,
    storePaymentsResult,
    adminOpenReports,
    adminChangeRequests,
    authoredProductTypeNames,
  ] = await Promise.all([
    session?.user?.id ? getPublicStoreReviews(store.id, session.user.id, store.reviewCount) : [],
    session?.user?.id ? getStoreViewerContext(store.id, session.user.id) : { review: null, note: null },
    getStoreGovernanceSummary(store.id),
    session?.user?.id
      ? getStoreGovernanceViewerContext(store.id, session.user.id)
      : { openReport: null, openChangeRequest: null },
    session?.user?.id
      ? getViewerStoreActivity(session.user.id, store.id)
      : ({ ordersTotal: 0, ordersActive: 0, totalSpentByCurrency: [] } satisfies ViewerStoreActivity),
    session?.user?.id ? getStoreDebtByCurrency(session.user.id, store.id) : ([] satisfies StoreDebtRow[]),
    session?.user?.id
      ? getStorePaymentsForStore(session.user.id, store.id)
      : ({ payments: [], totalCount: 0 } satisfies StorePaymentsForStoreResult),
    // Admin-only read of raw report free-text and reporter identity. Gated by `isAdmin` so a
    // non-admin request never triggers it; the public read model is never widened (BR-04-25).
    isAdmin ? getAdminOpenStoreReports(store.id) : undefined,
    // Admin-only read of pending change requests with the rebased diff and requester identity, gated
    // the same way; never widens the public governance read model.
    isAdmin ? getAdminPendingStoreChangeRequests(store.id, locale) : undefined,
    listAuthoredStoreProductTypeNamesCached(),
  ]);

  // The adjustment history is per (store, currency) at read time (`listStoreAccountAdjustments`,
  // WO-11), so it is fetched once per currency the store could have an adjustment in. That is NOT
  // only "every currency with a debt row" (`MINOR-5`, WO-11 review): a debt row comes from the
  // store's ORDERS, so a store whose only order in a currency was CANCELLED carries no debt row
  // there at all, even though an adjustment against that order (written off before the cancel, or
  // simply the store's only adjustment in that currency) can still exist. Reading the adjustments'
  // own currencies straight from `listStoreAccountAdjustmentCurrencyCodes` and UNIONing it with the
  // debt currencies is what keeps that adjustment listable, and deletable, either way.
  const currencyCodesWithDebt = [...new Set(storeDebtByCurrency.map((debt) => debt.currencyCode))];
  const currencyCodesWithAdjustments = session?.user?.id
    ? await listStoreAccountAdjustmentCurrencyCodes(session.user.id, store.id)
    : [];
  const adjustmentCurrencyCodes = [...new Set([...currencyCodesWithDebt, ...currencyCodesWithAdjustments])];
  const adjustmentsByCurrency = session?.user?.id
    ? await Promise.all(
        adjustmentCurrencyCodes.map((currencyCode) =>
          listStoreAccountAdjustments(session.user.id!, store.id, currencyCode).then((rows) =>
            rows.map((row) => ({ ...row, currencyCode })),
          ),
        ),
      )
    : [];
  const storeAccountAdjustments: StoreReconciliationAdjustmentRow[] = adjustmentsByCurrency
    .flat()
    .sort((a, b) => b.adjustmentDate.getTime() - a.adjustmentDate.getTime());

  const canAccessEditRoute = session?.user?.id != null;
  const canDirectlyEdit = Boolean(
    session?.user?.id &&
    (isAdmin || (editableStore.status === "PENDING" && editableStore.createdByUserId === session.user.id)),
  );

  return (
    <StoreDetailContent
      locale={locale}
      store={store}
      editableStore={editableStore}
      reviews={reviews}
      viewerReview={viewerContext.review}
      viewerNote={viewerContext.note}
      governanceSummary={governanceSummary}
      governanceViewerContext={governanceViewerContext}
      viewerActivity={viewerActivity}
      storeDebtByCurrency={storeDebtByCurrency}
      storePayments={storePaymentsResult.payments}
      storePaymentsTotalCount={storePaymentsResult.totalCount}
      storeAccountAdjustments={storeAccountAdjustments}
      adminOpenReports={adminOpenReports}
      adminChangeRequests={adminChangeRequests}
      canAccessEditRoute={canAccessEditRoute}
      canDirectlyEdit={canDirectlyEdit}
      canModerate={isAdmin}
      viewerId={session?.user?.id ?? null}
      authoredProductTypeNames={buildAuthoredStoreProductTypeNameMap(authoredProductTypeNames)}
      backHref={backHref}
      backOrderLabel={backOrderLabel}
    />
  );
}
