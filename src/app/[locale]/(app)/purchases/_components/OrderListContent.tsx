import OrderCard from "./OrderCard";
import OrderListEmptyState from "./OrderListEmptyState";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

type OrderListContentProps = {
  locale: string;
  orders: OrdersListPageItem[];
  totalCount: number;
  hasActiveFiltersBeyondDefault: boolean;
  today: Date;
  returnTo: string;
};

export default function OrderListContent({
  locale,
  orders,
  totalCount,
  hasActiveFiltersBeyondDefault,
  today,
  returnTo,
}: OrderListContentProps) {
  if (orders.length === 0) {
    const variant = totalCount === 0 && !hasActiveFiltersBeyondDefault ? "noOrders" : "noResults";
    return <OrderListEmptyState locale={locale} variant={variant} />;
  }

  return (
    <ul className="space-y-4" role="list">
      {orders.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} locale={locale} today={today} returnTo={returnTo} />
        </li>
      ))}
    </ul>
  );
}
