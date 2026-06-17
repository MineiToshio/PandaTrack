import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { getOrderById } from "@/lib/data/orders/orderQueries";
import { getOrderableStores } from "@/lib/data/stores/storeQueries";
import { listActiveStoreProductTypeKeys } from "@/queries/storeProductType";
import { ROUTES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { editOrderAction } from "../../_actions/orderActions";
import OrderForm from "../../_components/share/OrderForm";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "orders",
    pathSegment: "orders",
    titleKey: "edit.heroEyebrow",
  });
}

export default async function OrdersEditPage({ params }: Props) {
  const { locale, id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);
  const userId = session.user.id;

  await getTranslations({ locale, namespace: "orders" });

  const [order, stores, productTypeRows, user] = await Promise.all([
    getOrderById(id, userId),
    getOrderableStores(),
    listActiveStoreProductTypeKeys(prisma),
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } }),
  ]);

  if (!order) notFound();

  // A cancelled order is not editable (the edit mutation rejects with ORDER_NOT_EDITABLE).
  // Mirror the delivery-edit guard: redirect to detail so the collector reactivates first.
  if (order.status === "CANCELLED") {
    redirect(`/${locale}${ROUTES.orders}/${id}`);
  }

  const productTypeKeys = productTypeRows.map((r) => r.key);

  const boundEditAction = editOrderAction.bind(null, order.id);

  return (
    <OrderForm
      mode="edit"
      stores={stores}
      productTypeKeys={productTypeKeys}
      baseCurrencyCode={user?.baseCurrencyCode ?? null}
      action={boundEditAction}
      initialOrder={{
        id: order.id,
        humanReadableId: order.humanReadableId,
        storeId: order.storeId,
        orderDate: order.orderDate,
        expectedDeliveryFrom: order.expectedDeliveryFrom,
        expectedDeliveryTo: order.expectedDeliveryTo,
        currencyCode: order.currencyCode,
        exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
        totalCost: order.totalCost,
        // Sum of payments already recorded — the edit form blocks the user from lowering
        // `totalCost` below this value (server enforces the same gate).
        paidAmount: order.payments.reduce((sum, p) => sum + p.amount, 0),
        items: order.items,
      }}
    />
  );
}
