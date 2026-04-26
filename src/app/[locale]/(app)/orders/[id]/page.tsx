import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { getOrderDetail } from "@/lib/data/orders/orderQueries";
import { prisma } from "@/lib/prisma";
import OrderDetailContent from "./_components/OrderDetailContent";

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function safeRelativeReturnTo(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//")) return null;
  return decoded;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "orders",
    pathSegment: "orders",
    titleKey: "detail.heroEyebrow",
  });
}

export default async function OrdersDetailPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);
  const userId = session.user.id;

  await getTranslations({ locale, namespace: "orders" });

  const rawParams = await searchParams;
  const backHref = safeRelativeReturnTo(rawParams.returnTo);

  const [order, user] = await Promise.all([
    getOrderDetail(id, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } }),
  ]);

  if (!order) notFound();

  return (
    <OrderDetailContent
      order={order}
      locale={locale}
      baseCurrencyCode={user?.baseCurrencyCode ?? null}
      backHref={backHref}
    />
  );
}
