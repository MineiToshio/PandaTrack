import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { getPublicStoreReviews, getStoreBySlug, getStoreViewerContext } from "@/queries/store";
import {
  getEditableStoreBySlug,
  getStoreGovernanceSummary,
  getStoreGovernanceViewerContext,
} from "@/queries/storeGovernance";
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
  const store = await getStoreBySlug(prisma, slug);
  if (!store) return {};
  return buildStoreDetailMetadata({
    locale,
    storeName: store.name,
    slug,
    noindex: store.status === "PENDING",
  });
}

export default async function StoreDetailPage({ params, searchParams }: StoreDetailPageProps) {
  const { locale, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const backHref = safeRelativeReturnTo(resolvedSearchParams.returnTo);
  const returnLabelRaw = resolvedSearchParams[STORE_RETURN_LABEL_PARAM];
  const backOrderLabel = typeof returnLabelRaw === "string" && returnLabelRaw.trim() ? returnLabelRaw.trim() : null;
  const store = await getStoreBySlug(prisma, slug);
  const editableStore = await getEditableStoreBySlug(prisma, slug);

  if (!store || !editableStore) {
    notFound();
  }

  const session = await getSession();
  const isAdmin = getIsAdmin(session);

  // BR-04-21 (ADR 0009): private person stores are accessible only to their creator (or admins).
  // Return 404 (not 403) so the existence is not exposed to other users.
  if (store.isPrivate && !isAdmin && store.createdByUserId !== session?.user?.id) {
    notFound();
  }
  const [reviews, viewerContext, governanceSummary, governanceViewerContext] = await Promise.all([
    session?.user?.id ? getPublicStoreReviews(prisma, store.id, session.user.id, store.reviewCount) : [],
    session?.user?.id ? getStoreViewerContext(prisma, store.id, session.user.id) : { review: null, note: null },
    getStoreGovernanceSummary(prisma, store.id),
    session?.user?.id
      ? getStoreGovernanceViewerContext(prisma, store.id, session.user.id)
      : { openReport: null, openChangeRequest: null },
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
      canAccessEditRoute={canAccessEditRoute}
      canDirectlyEdit={canDirectlyEdit}
      backHref={backHref}
      backOrderLabel={backOrderLabel}
    />
  );
}
