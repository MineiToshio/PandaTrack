import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import {
  getDeliverySourceOrder,
  getEligibleProductsForStore,
  getStoresWithEligibleProducts,
  type EligibleProductsResult,
} from "@/lib/data/deliveries/deliveryQueries";
import { prisma } from "@/lib/prisma";
import DeliveryCreateForm from "./_components/DeliveryCreateForm";
import { createDeliveryAction } from "./_actions/createDeliveryAction";
import DeliveryCreateEmptyState from "./_components/DeliveryCreateEmptyState";

type DeliveriesNewPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: DeliveriesNewPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "deliveries",
    pathSegment: "deliveries",
    titleKey: "create.title",
  });
}

export default async function DeliveriesNewPage({ params, searchParams }: DeliveriesNewPageProps) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);
  const userId = session.user.id;

  await getTranslations({ locale, namespace: "deliveries" });

  const rawParams = await searchParams;
  const rawSourceOrderId = rawParams.sourceOrderId;
  const sourceOrderId = Array.isArray(rawSourceOrderId) ? rawSourceOrderId[0] : rawSourceOrderId;

  const [user, sourceOrder, stores] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } }),
    sourceOrderId ? getDeliverySourceOrder(sourceOrderId, userId) : Promise.resolve(null),
    getStoresWithEligibleProducts(userId),
  ]);

  if (sourceOrderId && !sourceOrder) notFound();

  if (stores.length === 0 && !sourceOrder) {
    return <DeliveryCreateEmptyState />;
  }

  const relevantStores = sourceOrder ? [{ storeId: sourceOrder.storeId, storeName: sourceOrder.storeName }] : stores;
  const productsEntries = await Promise.all(
    relevantStores.map(async (store) => [store.storeId, await getEligibleProductsForStore(store.storeId, userId)] as const),
  );
  const productsByStore: Record<string, EligibleProductsResult> = Object.fromEntries(productsEntries);

  return (
    <DeliveryCreateForm
      action={createDeliveryAction}
      stores={relevantStores}
      productsByStore={productsByStore}
      baseCurrencyCode={user?.baseCurrencyCode ?? null}
      sourceOrder={sourceOrder}
    />
  );
}
