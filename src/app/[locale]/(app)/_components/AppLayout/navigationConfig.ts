import { ROUTES } from "@/lib/constants";

export type NavItemId = "dashboard" | "stores" | "orders" | "deliveries" | "settings";

export interface NavItem {
  id: NavItemId;
  pathSegment: string;
  href: (locale: string) => string;
  labelKey: string;
}

const NAV_ROUTE_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    pathSegment: "dashboard",
    href: (locale) => `/${locale}${ROUTES.dashboard}`,
    labelKey: "nav.dashboard",
  },
  { id: "stores", pathSegment: "stores", href: (locale) => `/${locale}${ROUTES.stores}`, labelKey: "nav.stores" },
  {
    id: "orders",
    pathSegment: "orders",
    // Sidebar / burger menu entry-point preselects the "Solo activas" filter (FRD BP-02).
    // Other entry-points (chip clears, browser address, back-nav) land on a bare URL and
    // do NOT auto-apply the default — see `parseOrderListingParams`.
    href: (locale) =>
      `/${locale}${ROUTES.orders}?status=OPEN&status=PARTIALLY_IN_TRANSIT&status=IN_TRANSIT&status=PARTIALLY_DELIVERED`,
    labelKey: "nav.purchases",
  },
  {
    id: "deliveries",
    pathSegment: "deliveries",
    href: (locale) => `/${locale}${ROUTES.deliveries}`,
    labelKey: "nav.deliveries",
  },
  {
    id: "settings",
    pathSegment: "settings",
    href: (locale) => `/${locale}${ROUTES.settings}`,
    labelKey: "nav.settings",
  },
];

const PRIMARY_NAV_ITEM_IDS: NavItemId[] = ["dashboard", "stores", "orders", "deliveries"];

export function getPrivateAppNavItems(): NavItem[] {
  return NAV_ROUTE_ITEMS.filter((item) => PRIMARY_NAV_ITEM_IDS.includes(item.id));
}

export function getAllNavItems(): NavItem[] {
  return NAV_ROUTE_ITEMS;
}

/**
 * Returns the path segment (single segment) for a private app pathname like "/es/dashboard" or "/en/stores".
 * Used to highlight active nav and to derive page title. Returns undefined if pathname does not match a known segment.
 */
export function getPrivateAppPathSegment(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  const segmentIndex = 1;
  if (segments.length <= segmentIndex) return undefined;
  const segment = segments[segmentIndex];
  const known = NAV_ROUTE_ITEMS.map((item) => item.pathSegment);
  return known.includes(segment) ? segment : undefined;
}

/**
 * Returns the nav item whose path segment matches the given pathname, or the first item (dashboard) as fallback.
 */
export function getActiveNavItem(pathname: string): NavItem {
  const segment = getPrivateAppPathSegment(pathname);
  const found = NAV_ROUTE_ITEMS.find((item) => item.pathSegment === segment);
  return found ?? NAV_ROUTE_ITEMS[0];
}
