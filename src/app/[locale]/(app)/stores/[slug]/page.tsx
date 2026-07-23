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
  getEditableStoreBySlug,
  getStoreGovernanceSummary,
  getStoreGovernanceViewerContext,
} from "@/lib/data/stores/storeGovernanceQueries";
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
    // FLAGGED stores stay publicly visible but must not be indexed, like PENDING ones.
    noindex: store.status === "PENDING" || store.status === "FLAGGED",
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
  const [reviews, viewerContext, governanceSummary, governanceViewerContext, viewerActivity] = await Promise.all([
    session?.user?.id ? getPublicStoreReviews(store.id, session.user.id, store.reviewCount) : [],
    session?.user?.id ? getStoreViewerContext(store.id, session.user.id) : { review: null, note: null },
    getStoreGovernanceSummary(store.id),
    session?.user?.id
      ? getStoreGovernanceViewerContext(store.id, session.user.id)
      : { openReport: null, openChangeRequest: null },
    session?.user?.id
      ? getViewerStoreActivity(session.user.id, store.id)
      : ({ ordersTotal: 0, ordersActive: 0, totalSpentByCurrency: [] } satisfies ViewerStoreActivity),
  ]);

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
      canAccessEditRoute={canAccessEditRoute}
      canDirectlyEdit={canDirectlyEdit}
      canModerate={isAdmin}
      backHref={backHref}
      backOrderLabel={backOrderLabel}
    />
  );
}
