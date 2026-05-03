import { Package, ShoppingBag, Store } from "lucide-react";
import type { FabAction } from "@/components/core/FAB";
import { ROUTES } from "@/lib/constants";

export function getFabAction(pathname: string, locale: string): FabAction | null {
  if (pathname.includes("/settings")) return null;

  if (pathname.includes("/orders/") && pathname.split("/").length > 3) {
    return {
      href: `/${locale}${ROUTES.deliveriesNew}`,
      label: "Nueva entrega",
      icon: Package,
    };
  }

  if (pathname.includes("/deliveries")) {
    return {
      href: `/${locale}${ROUTES.deliveriesNew}`,
      label: "Nueva entrega",
      icon: Package,
    };
  }

  if (pathname.includes("/stores")) {
    return {
      href: `/${locale}${ROUTES.storesNew}`,
      label: "Sumar tienda",
      icon: Store,
    };
  }

  return {
    href: `/${locale}${ROUTES.ordersNew}`,
    label: "Nuevo pedido",
    icon: ShoppingBag,
  };
}
