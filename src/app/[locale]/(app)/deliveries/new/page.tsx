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
import { getUserCurrencyContext } from "@/lib/data/user-settings/userSettingsQueries";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import DeliveryForm from "../_components/share/DeliveryForm";
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

  const t = await getTranslations({ locale, namespace: "deliveries" });

  const rawParams = await searchParams;
  const rawSourceOrderId = rawParams.sourceOrderId;
  const sourceOrderId = Array.isArray(rawSourceOrderId) ? rawSourceOrderId[0] : rawSourceOrderId;

  const [user, sourceOrder, stores] = await Promise.all([
    getUserCurrencyContext(userId),
    sourceOrderId ? getDeliverySourceOrder(sourceOrderId, userId) : Promise.resolve(null),
    getStoresWithEligibleProducts(userId),
  ]);

  if (sourceOrderId && !sourceOrder) notFound();

  // FRD empty state: no store has a single eligible product anywhere.
  if (stores.length === 0 && !sourceOrder) {
    return (
      <>
        <SetHeaderTitle title={t("create.title")} />
        <DeliveryCreateEmptyState locale={locale} />
      </>
    );
  }

  // Every eligible store is loaded so the from-order "Cambiar" escape works. The
  // source store is kept in the list even when it has no eligibles left.
  const relevantStores =
    sourceOrder && !stores.some((store) => store.storeId === sourceOrder.storeId)
      ? [{ storeId: sourceOrder.storeId, storeName: sourceOrder.storeName }, ...stores]
      : stores;

  const productsEntries = await Promise.all(
    relevantStores.map(
      async (store) => [store.storeId, await getEligibleProductsForStore(store.storeId, userId)] as const,
    ),
  );
  const productsByStore: Record<string, EligibleProductsResult> = Object.fromEntries(productsEntries);

  const storeOptions = relevantStores.map((store) => ({
    storeId: store.storeId,
    storeName: store.storeName,
    eligibleCount: (productsByStore[store.storeId]?.byOrder ?? []).reduce(
      (sum, group) => sum + group.products.length,
      0,
    ),
  }));

  return (
    <>
      <SetHeaderTitle title={t("create.title")} />
      <DeliveryForm
        mode="create"
        action={createDeliveryAction}
        stores={storeOptions}
        productsByStore={productsByStore}
        baseCurrencyCode={user?.baseCurrencyCode ?? null}
        sourceOrder={sourceOrder}
      />
    </>
  );
}
