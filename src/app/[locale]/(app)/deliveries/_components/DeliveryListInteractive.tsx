"use client";

import { useEffect } from "react";
import { useListExpansion } from "@/hooks/useListExpansion";
import type { DeliveriesListPageItem } from "@/lib/data/deliveries/deliveryQueries";
import DeliveryCard from "./DeliveryCard";
import DeliveriesTable from "./DeliveriesTable";

type DeliveryListInteractiveProps = {
  deliveries: DeliveriesListPageItem[];
  locale: string;
  today: Date;
  returnTo: string;
};

/**
 * List body for deliveries. Expansion is a shared multi-open set owned by the surrounding
 * `ListExpansionProvider`, so the "expand/collapse all" toggle can live up in the filter-chips row
 * (outside this Suspense boundary) while the mobile cards and desktop table stay controlled here.
 */
export default function DeliveryListInteractive({ deliveries, locale, today, returnTo }: DeliveryListInteractiveProps) {
  const { expandedIds, toggleOne, syncIds } = useListExpansion();

  const idsKey = deliveries.map((delivery) => delivery.id).join(",");
  useEffect(() => {
    syncIds(deliveries.map((delivery) => delivery.id));
    // On unmount (e.g. filtering down to the empty state) clear the ids so the shared toggle,
    // which lives outside this Suspense boundary, hides instead of acting on a stale list.
    return () => syncIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the joined id string
  }, [idsKey, syncIds]);

  return (
    <div id="deliveries-list" className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3 lg:hidden" role="list">
        {deliveries.map((delivery) => (
          <li key={delivery.id}>
            <DeliveryCard
              delivery={delivery}
              locale={locale}
              today={today}
              returnTo={returnTo}
              isExpanded={expandedIds.has(delivery.id)}
              onToggle={() => toggleOne(delivery.id)}
            />
          </li>
        ))}
      </ul>
      <DeliveriesTable
        deliveries={deliveries}
        locale={locale}
        today={today}
        returnTo={returnTo}
        expandedIds={expandedIds}
        onToggle={toggleOne}
      />
    </div>
  );
}
