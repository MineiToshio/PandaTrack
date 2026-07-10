import { notFound } from "next/navigation";
import { getStoreBySlug } from "@/lib/data/stores/storeQueries";
import StoreSegmentContentHeader from "./_components/StoreSegmentContentHeader";

type StoreDetailLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export default async function StoreDetailLayout({ children, params }: StoreDetailLayoutProps) {
  const { slug, locale } = await params;
  const store = await getStoreBySlug(slug);

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
