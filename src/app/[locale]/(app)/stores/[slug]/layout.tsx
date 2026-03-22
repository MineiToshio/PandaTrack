import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreBySlug } from "@/queries/store";
import StoreSegmentContentHeader from "./_components/StoreSegmentContentHeader";

type StoreDetailLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export default async function StoreDetailLayout({ children, params }: StoreDetailLayoutProps) {
  const { slug, locale } = await params;
  const store = await getStoreBySlug(prisma, slug);

  if (!store) {
    notFound();
  }

  return (
    <>
      <StoreSegmentContentHeader locale={locale} storeSlug={slug} storeName={store.name} />
      {children}
    </>
  );
}
