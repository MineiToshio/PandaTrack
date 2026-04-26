import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { redirect } from "next/navigation";
import { getUserStores } from "@/lib/data/stores/storeQueries";
import { listActiveStoreProductTypeKeys } from "@/queries/storeProductType";
import { prisma } from "@/lib/prisma";
import { createOrderAction } from "../_actions/orderActions";
import OrderEmptyState from "../_components/share/OrderEmptyState";
import OrderForm from "../_components/share/OrderForm";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "orders",
    pathSegment: "orders",
    titleKey: "create.title",
  });
}

export default async function OrdersNewPage({ params }: Props) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);
  const userId = session.user.id;

  await getTranslations({ locale, namespace: "orders" });

  const [stores, productTypeRows, user] = await Promise.all([
    getUserStores(userId),
    listActiveStoreProductTypeKeys(prisma),
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } }),
  ]);

  const productTypeKeys = productTypeRows.map((r) => r.key);

  if (stores.length === 0) {
    return <OrderEmptyState />;
  }

  return (
    <OrderForm
      mode="create"
      stores={stores}
      productTypeKeys={productTypeKeys}
      baseCurrencyCode={user?.baseCurrencyCode ?? null}
      action={createOrderAction}
    />
  );
}
