import { redirect } from "next/navigation";

type StoreDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { locale, slug } = await params;
  redirect(`/${locale}/store/${slug}`);
}
