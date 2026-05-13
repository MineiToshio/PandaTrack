import { getTranslations } from "next-intl/server";
import OrderListLoadingSkeleton from "./_components/OrderListLoadingSkeleton";

type OrdersLoadingProps = { params?: Promise<{ locale: string }> };

export default async function OrdersLoading({ params }: OrdersLoadingProps) {
  // `loading.tsx` doesn't receive params from Next 15+ — fall back to `es` if absent.
  const resolved = params ? await params : { locale: "es" };
  const t = await getTranslations({ locale: resolved.locale, namespace: "orderListing" });
  return <OrderListLoadingSkeleton title={t("hero.title")} />;
}
