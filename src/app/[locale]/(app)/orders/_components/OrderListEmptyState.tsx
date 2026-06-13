import { PackageOpen, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";
import { ROUTES } from "@/lib/constants";

type OrderListEmptyStateProps = {
  locale: string;
  variant: "noOrders" | "noResults";
  resetHref?: string;
};

export default async function OrderListEmptyState({ locale, variant, resetHref }: OrderListEmptyStateProps) {
  const t = await getTranslations({ locale, namespace: "orderListing" });
  const isNoOrders = variant === "noOrders";
  const Icon = isNoOrders ? PackageOpen : SearchX;
  const titleKey = isNoOrders ? "empty.noOrders.title" : "empty.noResults.title";
  const descKey = isNoOrders ? "empty.noOrders.description" : "empty.noResults.description";
  const ctaKey = isNoOrders ? "empty.noOrders.cta" : "empty.noResults.cta";
  const ctaHref = isNoOrders ? `/${locale}${ROUTES.ordersNew}` : (resetHref ?? `/${locale}${ROUTES.orders}`);

  return (
    <EmptyState
      appearance="card"
      headingAs="h2"
      icon={<Icon width={28} height={28} />}
      iconTone={isNoOrders ? "accent" : "neutral"}
      title={t(titleKey)}
      subtitle={t(descKey)}
      actions={
        <Button as="a" href={ctaHref} variant={isNoOrders ? "primary" : "ghost"} size="md">
          {t(ctaKey)}
        </Button>
      }
    />
  );
}
