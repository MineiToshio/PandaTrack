import { getTranslations } from "next-intl/server";
import DeliveryListLoadingSkeleton from "./_components/DeliveryListLoadingSkeleton";

type DeliveriesLoadingProps = { params?: Promise<{ locale: string }> };

export default async function DeliveriesLoading({ params }: DeliveriesLoadingProps) {
  // `loading.tsx` doesn't receive params from Next 15+ — fall back to `es` if absent.
  const resolved = params ? await params : { locale: "es" };
  const t = await getTranslations({ locale: resolved.locale, namespace: "deliveries" });
  return (
    <DeliveryListLoadingSkeleton
      title={t("list.title")}
      headers={{
        delivery: t("list.table.headerDelivery"),
        products: t("list.table.headerProducts"),
        status: t("list.table.headerStatus"),
        cost: t("list.table.headerCost"),
        arrival: t("list.table.headerArrival"),
      }}
    />
  );
}
