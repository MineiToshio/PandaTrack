import { ROUTES } from "@/lib/constants";

export type NavItemId = "dashboard" | "stores" | "purchases" | "shipments" | "settings";

export interface NavItem {
  id: NavItemId;
  pathSegment: string;
  href: (locale: string) => string;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    pathSegment: "dashboard",
    href: (locale) => `/${locale}${ROUTES.dashboard}`,
    labelKey: "nav.dashboard",
  },
  { id: "stores", pathSegment: "stores", href: (locale) => `/${locale}${ROUTES.stores}`, labelKey: "nav.stores" },
  {
    id: "purchases",
    pathSegment: "purchases",
    href: (locale) => `/${locale}${ROUTES.purchases}`,
    labelKey: "nav.purchases",
  },
  {
    id: "shipments",
    pathSegment: "shipments",
    href: (locale) => `/${locale}${ROUTES.shipments}`,
    labelKey: "nav.shipments",
  },
  {
    id: "settings",
    pathSegment: "settings",
    href: (locale) => `/${locale}${ROUTES.settings}`,
    labelKey: "nav.settings",
  },
];

export function getPrivateAppNavItems(): NavItem[] {
  return NAV_ITEMS;
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
  const known = NAV_ITEMS.map((item) => item.pathSegment);
  return known.includes(segment) ? segment : undefined;
}

/**
 * Returns the nav item whose path segment matches the given pathname, or the first item (dashboard) as fallback.
 */
export function getActiveNavItem(pathname: string): NavItem {
  const segment = getPrivateAppPathSegment(pathname);
  const found = NAV_ITEMS.find((item) => item.pathSegment === segment);
  return found ?? NAV_ITEMS[0];
}
