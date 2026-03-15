import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";
import CreateStoreForm from "./_components/CreateStoreForm";

type StoresNewPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: StoresNewPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "stores",
    pathSegment: "stores",
    titleKey: "create.title",
  });
}

export default async function StoresNewPage({ params }: StoresNewPageProps) {
  const { locale } = await params;
  await getTranslations({ locale, namespace: "stores" });

  const [countries, categories] = await Promise.all([
    prisma.country.findMany({ select: { code: true }, orderBy: { code: "asc" } }),
    prisma.storeCategory.findMany({
      where: { isActive: true },
      select: { key: true },
      orderBy: { key: "asc" },
    }),
  ]);

  return (
    <div className="bg-background text-foreground px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <CreateStoreForm countries={countries} categories={categories} />
      </div>
    </div>
  );
}
