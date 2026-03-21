import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/auth-server";
import { getPublicStoreReviews, getStoreBySlug, getStoreViewerContext } from "@/queries/store";
import { buildStoreDetailMetadata } from "@/lib/seo";
import StoreDetailContent from "./_components/StoreDetailContent";

type StoreDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

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

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { locale, slug } = await params;
  const store = await getStoreBySlug(prisma, slug);

  if (!store) {
    notFound();
  }

  const session = await getSession();
  const [reviews, viewerContext] = session?.user?.id
    ? await Promise.all([
        getPublicStoreReviews(prisma, store.id, session.user.id, store.reviewCount),
        getStoreViewerContext(prisma, store.id, session.user.id),
      ])
    : [[], { review: null, note: null }];

  return (
    <StoreDetailContent
      locale={locale}
      store={store}
      reviews={reviews}
      viewerReview={viewerContext.review}
      viewerNote={viewerContext.note}
    />
  );
}
