import { ROUTES } from "@/lib/constants";
import { getActiveNavItem, type NavItemId } from "@/app/[locale]/(app)/_components/AppLayout/navigationConfig";

/** Path segments that identify the primary nav area (no locale). */
const PRIMARY_SEGMENTS: NavItemId[] = ["dashboard", "stores", "purchases", "shipments", "settings"];

/**
 * Known nested path segments under each primary area. Maps segment string to i18n label key.
 * Used to build breadcrumbs and page title for nested routes (e.g. Purchases > Pre-orders).
 */
const NESTED_SEGMENT_LABELS: Partial<Record<NavItemId, Record<string, string>>> = {
  purchases: {
    "pre-orders": "nav.preOrders",
  },
  stores: {
    new: "stores.newStore",
    edit: "stores.editStore",
  },
};

export interface BreadcrumbItem {
  labelKey: string;
  href: string;
}

/** Data needed to render the page header: title and optional breadcrumb trail. */
export interface PageHeader {
  isFirstLevel: boolean;
  titleKey: string;
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Returns path segments after the locale (e.g. ["dashboard"] or ["purchases", "pre-orders"]).
 * Assumes pathname starts with / and locale is the first segment.
 */
export function getPrivateAppPathSegments(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return [];
  return segments.slice(1);
}

/**
 * True when the pathname is a first-level private route: exactly locale + one primary segment.
 * First-level routes show title-only header; nested routes can show breadcrumbs.
 */
export function isFirstLevelPrivateRoute(pathname: string): boolean {
  const segments = getPrivateAppPathSegments(pathname);
  if (segments.length !== 1) return false;
  const segment = segments[0];
  return PRIMARY_SEGMENTS.includes(segment as NavItemId);
}

/**
 * Builds breadcrumb items for nested private routes. Returns only parent segments so the
 * current page is shown only as the title (avoids duplicating "Detail" in breadcrumb and title).
 * Locale is used to build hrefs.
 */
export function getBreadcrumbs(pathname: string, locale: string): BreadcrumbItem[] {
  const segments = getPrivateAppPathSegments(pathname);
  if (segments.length <= 1) return [];

  const primary = segments[0] as NavItemId;
  if (!PRIMARY_SEGMENTS.includes(primary)) return [];

  const basePath = `/${locale}${ROUTES[primary] ?? `/${primary}`}`;
  const navLabelKey = getNavLabelKeyForSegment(primary);
  const items: BreadcrumbItem[] = [{ labelKey: navLabelKey, href: basePath }];

  const lastIndex = segments.length - 1;

  for (let i = 1; i < lastIndex; i++) {
    const segment = segments[i];
    // .../stores/:slug/edit: skip the slug segment; the store name crumb comes from header context.
    if (primary === "stores" && i === 1 && segment !== "new" && segments[lastIndex] === "edit") {
      continue;
    }
    const nestedLabels = NESTED_SEGMENT_LABELS[primary];
    const labelKey = nestedLabels?.[segment] ?? "breadcrumb.detail";
    const pathSoFar = `/${locale}/${segments.slice(0, i + 1).join("/")}`;
    items.push({ labelKey, href: pathSoFar });
  }

  return items;
}

function getNavLabelKeyForSegment(segment: NavItemId): string {
  const map: Record<NavItemId, string> = {
    dashboard: "nav.dashboard",
    stores: "nav.stores",
    purchases: "nav.purchases",
    shipments: "nav.shipments",
    settings: "nav.settings",
  };
  return map[segment] ?? "nav.dashboard";
}

function getTitleKeyForLastSegment(pathname: string): string {
  const segments = getPrivateAppPathSegments(pathname);
  if (segments.length < 2) return "breadcrumb.detail";
  const primary = segments[0] as NavItemId;
  const lastSegment = segments[segments.length - 1];
  const nestedLabels = NESTED_SEGMENT_LABELS[primary];
  return nestedLabels?.[lastSegment] ?? "breadcrumb.detail";
}

/**
 * Returns the data to show in the page header (title and optional breadcrumbs) for the current pathname.
 * First-level routes: title only. Nested routes: parent breadcrumb trail plus current page title (no duplicate).
 */
export function getPageHeader(pathname: string, locale: string): PageHeader {
  const isFirstLevel = isFirstLevelPrivateRoute(pathname);
  const activeItem = getActiveNavItem(pathname);
  const breadcrumbs = getBreadcrumbs(pathname, locale);

  if (isFirstLevel || breadcrumbs.length === 0) {
    return {
      isFirstLevel: true,
      titleKey: activeItem.labelKey,
      breadcrumbs: [],
    };
  }

  const titleKey = getTitleKeyForLastSegment(pathname);
  return {
    isFirstLevel: false,
    titleKey,
    breadcrumbs,
  };
}
