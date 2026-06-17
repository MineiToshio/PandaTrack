import OrderCard from "./OrderCard";
import OrderListEmptyState from "./OrderListEmptyState";
import OrdersTable from "./OrdersTable";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

type OrderListContentProps = {
  locale: string;
  orders: OrdersListPageItem[];
  totalCount: number;
  hasActiveFiltersBeyondDefault: boolean;
  today: Date;
  returnTo: string;
  resetHref: string;
};

export default function OrderListContent({
  locale,
  orders,
  totalCount,
  hasActiveFiltersBeyondDefault,
  today,
  returnTo,
  resetHref,
}: OrderListContentProps) {
  if (orders.length === 0) {
    const variant = totalCount === 0 && !hasActiveFiltersBeyondDefault ? "noOrders" : "noResults";
    return <OrderListEmptyState locale={locale} variant={variant} resetHref={resetHref} />;
  }

  return (
    <div id="orders-list" className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3 lg:hidden" role="list">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} locale={locale} today={today} returnTo={returnTo} />
          </li>
        ))}
      </ul>
      <OrdersTable orders={orders} locale={locale} today={today} returnTo={returnTo} />
    </div>
  );
}
