import OrderListEmptyState from "./OrderListEmptyState";
import OrderListInteractive from "./OrderListInteractive";
import type { OrdersListPageItem } from "@/lib/data/orders/orderQueries";

type OrderListContentProps = {
  locale: string;
  orders: OrdersListPageItem[];
  totalCount: number;
  hasActiveFiltersBeyondDefault: boolean;
  today: Date;
  returnTo: string;
  resetHref: string;
  baseCurrencyCode: string | null;
};

export default function OrderListContent({
  locale,
  orders,
  totalCount,
  hasActiveFiltersBeyondDefault,
  today,
  returnTo,
  resetHref,
  baseCurrencyCode,
}: OrderListContentProps) {
  if (orders.length === 0) {
    const variant = totalCount === 0 && !hasActiveFiltersBeyondDefault ? "noOrders" : "noResults";
    return <OrderListEmptyState locale={locale} variant={variant} resetHref={resetHref} />;
  }

  return (
    <OrderListInteractive
      orders={orders}
      locale={locale}
      today={today}
      returnTo={returnTo}
      baseCurrencyCode={baseCurrencyCode}
    />
  );
}
