import { ROUTES } from "@/lib/constants";

/**
 * Routes where the single-action "Nuevo pedido" floating button (and its matching raised
 * toast inset) are eligible to render: the Dashboard and the Orders list only. Every other
 * surface (Stores, Deliveries, order/delivery detail, any creation wizard) stays without it,
 * an exact match keeps `/orders/[id]` and `/orders/new*` excluded on purpose.
 */
export function isFabEligibleRoute(pathname: string, locale: string): boolean {
  const dashboardPath = `/${locale}${ROUTES.dashboard}`;
  const ordersPath = `/${locale}${ROUTES.orders}`;
  // Strip a trailing slash before comparing so `/es/orders/` still matches `/es/orders`.
  const normalized = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return normalized === dashboardPath || normalized === ordersPath;
}
