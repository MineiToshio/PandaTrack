import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { getDeliveryDetail, getEligibleProductsForStore } from "@/lib/data/deliveries/deliveryQueries";
import { ROUTES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import DeliveryForm from "../../_components/share/DeliveryForm";
import { editDeliveryAction } from "./_actions/editDeliveryAction";

type DeliveryEditPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: DeliveryEditPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "deliveries",
    pathSegment: "deliveries",
    titleKey: "edit.metaTitle",
  });
}

export default async function DeliveryEditPage({ params }: DeliveryEditPageProps) {
  const { locale, id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);
  const userId = session.user.id;

  const [delivery, user] = await Promise.all([
    getDeliveryDetail(id, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } }),
  ]);

  if (!delivery) notFound();

  // BR-08-04: only IN_TRANSIT deliveries are editable — DELIVERED/CANCELLED must be
  // reopened first. The detail screen explains this with its helper copy.
  if (delivery.status !== "IN_TRANSIT") {
    redirect(`/${locale}${ROUTES.deliveries}/${id}`);
  }

  // Eligible products for the store, re-including this delivery's own items.
  const products = await getEligibleProductsForStore(delivery.store.id, userId, delivery.id);
  const currentProductIds = delivery.sourceOrders.flatMap((group) => group.items.map((item) => item.id));

  return (
    <>
      <SetHeaderTitle title={delivery.humanReadableId} />
      <DeliveryForm
        mode="edit"
        action={editDeliveryAction}
        initialDelivery={{
          id: delivery.id,
          humanReadableId: delivery.humanReadableId,
          storeName: delivery.store.name,
          deliveryDate: delivery.deliveryDate,
          expectedArrivalFrom: delivery.expectedArrivalFrom,
          expectedArrivalTo: delivery.expectedArrivalTo,
          cost: delivery.cost,
          currencyCode: delivery.currencyCode,
          exchangeRate: delivery.exchangeRate,
          currentProductIds,
        }}
        products={products}
        baseCurrencyCode={user?.baseCurrencyCode ?? null}
      />
    </>
  );
}
