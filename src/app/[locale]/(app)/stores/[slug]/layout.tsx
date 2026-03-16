import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreBySlug } from "@/queries/store";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";

type StoreDetailLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export default async function StoreDetailLayout({ children, params }: StoreDetailLayoutProps) {
  const { slug } = await params;
  const store = await getStoreBySlug(prisma, slug);

  if (!store) {
    notFound();
  }

  return (
    <>
      <SetHeaderTitle title={store.name} />
      {children}
    </>
  );
}
