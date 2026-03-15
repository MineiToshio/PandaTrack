import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreBySlug } from "@/queries/store";
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

  return <StoreDetailContent locale={locale} store={store} />;
}
