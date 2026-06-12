import DeliveryCard from "./DeliveryCard";
import DeliveryListEmptyState from "./DeliveryListEmptyState";
import DeliveriesTable from "./DeliveriesTable";
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

  return (
    <div id="deliveries-list" className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3 lg:hidden" role="list">
        {deliveries.map((delivery) => (
          <li key={delivery.id}>
            <DeliveryCard delivery={delivery} locale={locale} today={today} returnTo={returnTo} />
          </li>
        ))}
      </ul>
      <DeliveriesTable deliveries={deliveries} locale={locale} today={today} returnTo={returnTo} />
    </div>
  );
}
