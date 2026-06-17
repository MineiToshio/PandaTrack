import { getTranslations } from "next-intl/server";
import OrderDetailLoadingSkeleton from "./_components/OrderDetailLoadingSkeleton";

type OrderDetailLoadingProps = { params?: Promise<{ locale: string }> };

/**
 * Detail-route loading boundary. Renders a structure-matching skeleton (S10 / ADR 0013)
 * while Next resolves the server work for a single order. Replaces the prior `null`
 * placeholder now that the detail screen has shipped.
 */
export default async function OrderDetailLoading({ params }: OrderDetailLoadingProps) {
  // `loading.tsx` doesn't receive params reliably in Next 15+ — fall back to `es` if absent.
  const resolved = params ? await params : { locale: "es" };
  const t = await getTranslations({ locale: resolved.locale, namespace: "components" });
  return <OrderDetailLoadingSkeleton label={t("skeleton.loading")} />;
}
