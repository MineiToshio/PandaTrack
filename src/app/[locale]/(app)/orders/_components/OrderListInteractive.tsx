"use client";

import { useEffect } from "react";
import { useListExpansion } from "@/hooks/useListExpansion";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";
import OrderCard from "./OrderCard";
import OrdersTable from "./OrdersTable";

type OrderListInteractiveProps = {
  orders: OrdersListPageItem[];
  locale: string;
  today: Date;
  returnTo: string;
  baseCurrencyCode: string | null;
};

/**
 * List body for orders. Expansion is a shared multi-open set owned by the surrounding
 * `ListExpansionProvider`, so the "expand/collapse all" toggle can live up in the filter-chips row
 * (outside this Suspense boundary) while the mobile cards and desktop table stay controlled here.
 */
export default function OrderListInteractive({
  orders,
  locale,
  today,
  returnTo,
  baseCurrencyCode,
}: OrderListInteractiveProps) {
  const { expandedIds, toggleOne, syncIds } = useListExpansion();

  const idsKey = orders.map((order) => order.id).join(",");
  useEffect(() => {
    syncIds(orders.map((order) => order.id));
    // On unmount (e.g. filtering down to the empty state) clear the ids so the shared toggle,
    // which lives outside this Suspense boundary, hides instead of acting on a stale list.
    return () => syncIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the joined id string
  }, [idsKey, syncIds]);

  return (
    <div id="orders-list" className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3 lg:hidden" role="list">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard
              order={order}
              locale={locale}
              today={today}
              returnTo={returnTo}
              baseCurrencyCode={baseCurrencyCode}
              isExpanded={expandedIds.has(order.id)}
              onToggle={() => toggleOne(order.id)}
            />
          </li>
        ))}
      </ul>
      <OrdersTable
        orders={orders}
        locale={locale}
        today={today}
        returnTo={returnTo}
        baseCurrencyCode={baseCurrencyCode}
        expandedIds={expandedIds}
        onToggle={toggleOne}
      />
    </div>
  );
}
