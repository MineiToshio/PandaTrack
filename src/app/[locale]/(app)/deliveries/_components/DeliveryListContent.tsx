import DeliveryListEmptyState from "./DeliveryListEmptyState";
import DeliveryListInteractive from "./DeliveryListInteractive";
import type { DeliveriesListPageItem } from "@/lib/data/deliveries/deliveryQueries";

type DeliveryListContentProps = {
  locale: string;
  deliveries: DeliveriesListPageItem[];
  totalCount: number;
  hasAnyFilter: boolean;
  searchTerm?: string;
  today: Date;
  returnTo: string;
  resetHref: string;
};

export default function DeliveryListContent({
  locale,
  deliveries,
  totalCount,
  hasAnyFilter,
  searchTerm,
  today,
  returnTo,
  resetHref,
}: DeliveryListContentProps) {
  if (deliveries.length === 0) {
    const variant = totalCount === 0 && !hasAnyFilter ? "noDeliveries" : "noResults";
    return <DeliveryListEmptyState locale={locale} variant={variant} searchTerm={searchTerm} resetHref={resetHref} />;
  }

  return <DeliveryListInteractive deliveries={deliveries} locale={locale} today={today} returnTo={returnTo} />;
}
