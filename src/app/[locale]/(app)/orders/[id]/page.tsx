import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { getOrderDetail } from "@/lib/data/orders/orderQueries";
import { getOpenBalanceMinorByOrderIds, getStoreDebtByCurrency } from "@/lib/data/orders/storePaymentQueries";
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

  // The store's debt figures the hero surfaces when this order has nothing allocated to it yet
  // (§ store-level payments). Needs the order's own store + currency, so it can only run once
  // the order is known. `storeDebtMinor` (lifetime) still decides the "in credit" branch and the
  // `STORE_DEBT_EXCEEDED` validation ceiling (`FR-05-63`); `openOrderDebtMinor` (`ADR 0033`) is the
  // figure the positive-debt link itself prints. Runs alongside `getOpenBalanceMinorByOrderIds`
  // below: neither depends on the other, only on `order` (already resolved above).
  const [storeDebtRows, openBalanceByOrderId] = await Promise.all([
    getStoreDebtByCurrency(userId, order.storeId),
    // This order's own canonical net balance (`BR-05-32`, `ADR 0034`): `totalCost` minus every
    // `PaymentAllocation` AND every `StoreAccountAdjustmentLine` written against it. Two queries,
    // both bounded to this single order id regardless of the order's own size (one `Order.findMany`
    // inside the wrapper, one `groupBy` inside `openBalanceMinorByOrderId`) — never N+1. Feeds only
    // the payment form's WRITABLE ceiling (`OrderInlinePaymentForm`'s `openBalanceMinor` prop); the
    // order's own GROSS balance keeps rendering everywhere else on this page (`FR-05-35`).
    getOpenBalanceMinorByOrderIds(userId, [order.id]),
  ]);
  const storeDebtRow = storeDebtRows.find((row) => row.currencyCode === order.currencyCode);
  const storeDebtMinor = storeDebtRow?.debtMinor ?? 0;
  const openOrderDebtMinor = storeDebtRow?.openOrderDebtMinor ?? 0;
  const openBalanceMinor = openBalanceByOrderId.get(order.id);
  if (openBalanceMinor === undefined) {
    // `getOpenBalanceMinorByOrderIds` guarantees an entry for every id it is asked about and owns;
    // `order` was already resolved against this same `userId` above, so a miss here can only be a
    // programming error, never a figure to silently degrade to the gross balance (`BR-05-32`).
    throw new Error(`getOpenBalanceMinorByOrderIds missing entry for order ${order.id}`);
  }

  return (
    <OrderDetailContent
      order={order}
      locale={locale}
      baseCurrencyCode={user?.baseCurrencyCode ?? null}
      backHref={backHref}
      detailHref={detailHref}
      storeDebtMinor={storeDebtMinor}
      openOrderDebtMinor={openOrderDebtMinor}
      openBalanceMinor={openBalanceMinor}
      timeZone={user?.timezone ?? null}
    />
  );
}
