import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { getOrderById } from "@/lib/data/orders/orderQueries";
import { getOrderableStores } from "@/lib/data/stores/storeQueries";
import { listActiveStoreProductTypeKeys } from "@/queries/storeProductType";
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
        items: order.items,
      }}
    />
  );
}
