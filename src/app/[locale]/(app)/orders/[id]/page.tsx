import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { getOrderDetail } from "@/lib/data/orders/orderQueries";
import { getStoreDebtByCurrency } from "@/lib/data/orders/storePaymentQueries";
import { ROUTES } from "@/lib/constants";
import { safeRelativeReturnTo } from "@/lib/navigation/safeRelativeReturnTo";
import { prisma } from "@/lib/prisma";
import OrderDetailContent from "./_components/OrderDetailContent";

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const detailHref = backHref
    ? `/${locale}${ROUTES.orders}/${id}?${new URLSearchParams({ [AUTH_RETURN_TO_PARAM]: backHref }).toString()}`
    : `/${locale}${ROUTES.orders}/${id}`;

  const [order, user] = await Promise.all([
    getOrderDetail(id, userId),
    // `timezone` rides along with the currency the page already reads: the overdue banner compares
    // against midnight-UTC domain dates, so it needs the collector's civil day, not a wall clock.
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true, timezone: true } }),
  ]);

  if (!order) notFound();

  // The store's debt figure the hero surfaces when this order has nothing allocated to it yet
  // (§ store-level payments). Needs the order's own store + currency, so it can only run once
  // the order is known.
  const storeDebtRows = await getStoreDebtByCurrency(userId, order.storeId);
  const storeDebtMinor = storeDebtRows.find((row) => row.currencyCode === order.currencyCode)?.debtMinor ?? 0;

  return (
    <OrderDetailContent
      order={order}
      locale={locale}
      baseCurrencyCode={user?.baseCurrencyCode ?? null}
      backHref={backHref}
      detailHref={detailHref}
      storeDebtMinor={storeDebtMinor}
      timeZone={user?.timezone ?? null}
    />
  );
}
