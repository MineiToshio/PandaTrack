import { ROUTES } from "@/lib/constants";

export type NavItemId = "dashboard" | "stores" | "orders" | "deliveries" | "progress" | "settings";

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
    // Entry-point carries the canonical "En camino" default (BP-01); the page also
    // canonicalizes bare URLs to this filter. Explicit empty `status=` means "all".
    href: (locale) => `/${locale}${ROUTES.deliveries}?status=IN_TRANSIT`,
    labelKey: "nav.deliveries",
  },
  {
    id: "progress",
    pathSegment: "progress",
    href: (locale) => `/${locale}${ROUTES.progress}`,
    labelKey: "nav.progress",
  },
  {
    id: "settings",
    pathSegment: "settings",
    href: (locale) => `/${locale}${ROUTES.settings}`,
    labelKey: "nav.settings",
  },
];

const PRIMARY_NAV_ITEM_IDS: NavItemId[] = ["dashboard", "stores", "orders", "deliveries", "progress"];

export type AdminNavItemId = "moderation" | "audit" | "imageIntake";

/** Nested segment of the photo-quota console, composed onto `ROUTES.admin`. */
const ADMIN_IMAGE_INTAKE_SEGMENT = "/image-intake";

export interface AdminNavItem {
  id: AdminNavItemId;
  href: (locale: string) => string;
  /** Label key resolved against the `admin` namespace (all admin copy lives there, BR-02-01). */
  labelKey: string;
}

/**
 * The grouped "Administración" section rendered in the collector shell for administrators only.
 * It is presentation gated by `isAdmin`; `requireAdmin()` remains the real boundary (BR-02-05).
 */
const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: "moderation", href: (locale) => `/${locale}${ROUTES.admin}`, labelKey: "nav.moderation" },
  {
    id: "imageIntake",
    href: (locale) => `/${locale}${ROUTES.admin}${ADMIN_IMAGE_INTAKE_SEGMENT}`,
    labelKey: "nav.imageIntake",
  },
  { id: "audit", href: (locale) => `/${locale}${ROUTES.adminAudit}`, labelKey: "nav.audit" },
];

export function getAdminNavItems(): AdminNavItem[] {
  return ADMIN_NAV_ITEMS;
}

/**
 * Returns the active admin nav item id for a pathname inside the admin space, or `undefined` when
 * the pathname is not an admin route. The audit route is nested, so it is matched before the
 * landing; any other `/admin/*` path highlights the moderation landing entry.
 */
export function getActiveAdminNavItemId(pathname: string): AdminNavItemId | undefined {
  const segments = pathname.split("/").filter(Boolean);
  const adminSegmentIndex = 1;
  if (segments[adminSegmentIndex] !== "admin") return undefined;
  if (segments[adminSegmentIndex + 1] === "audit") return "audit";
  if (segments[adminSegmentIndex + 1] === "image-intake") return "imageIntake";
  return "moderation";
}

/**
 * Visibility the collector controls. `Progreso` disappears from every nav surface at once while
 * "Ocultar mi progresión" is on, which is why the flag is read here rather than in each renderer:
 * a surface that forgot to ask would be the one that leaks the layer back in (`FR-12-38`).
 */
export type NavVisibilityOptions = {
  showProgression?: boolean;
};

function applyVisibility(items: NavItem[], options?: NavVisibilityOptions): NavItem[] {
  if (options?.showProgression === false) {
    return items.filter((item) => item.id !== "progress");
  }
  return items;
}

export function getPrivateAppNavItems(options?: NavVisibilityOptions): NavItem[] {
  return applyVisibility(
    NAV_ROUTE_ITEMS.filter((item) => PRIMARY_NAV_ITEM_IDS.includes(item.id)),
    options,
  );
}

export function getAllNavItems(options?: NavVisibilityOptions): NavItem[] {
  return applyVisibility([...NAV_ROUTE_ITEMS], options);
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
