import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { getDeliveryDetail } from "@/lib/data/deliveries/deliveryQueries";
import { safeRelativeReturnTo } from "@/lib/navigation/safeRelativeReturnTo";
import { prisma } from "@/lib/prisma";
import DeliveryDetailContent from "./_components/DeliveryDetailContent";

type DeliveryDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: DeliveryDetailPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "deliveries",
    pathSegment: "deliveries",
    titleKey: "detail.metaTitle",
  });
}

export default async function DeliveryDetailPage({ params, searchParams }: DeliveryDetailPageProps) {
  const { locale, id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);
  const userId = session.user.id;

  const rawParams = await searchParams;
  const backHref = safeRelativeReturnTo(rawParams.returnTo);

  const [delivery, user] = await Promise.all([
    getDeliveryDetail(id, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } }),
  ]);

  if (!delivery) notFound();

  return (
    <DeliveryDetailContent
      delivery={delivery}
      locale={locale}
      baseCurrencyCode={user?.baseCurrencyCode ?? null}
      backHref={backHref}
    />
  );
}
