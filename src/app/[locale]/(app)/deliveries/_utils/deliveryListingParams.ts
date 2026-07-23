import type { DeliveryStatus } from "../../../../../../generated/prisma/client";
import {
  DEFAULT_DELIVERY_LIST_SORT,
  DELIVERY_LIST_SORT_VALUES,
  type DeliveryListSort,
} from "@/lib/deliveries/deliveryListSort";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/constants";

const ALL_DELIVERY_STATUSES: DeliveryStatus[] = ["IN_TRANSIT", "DELIVERED", "CANCELLED"];

/** Canonical default applied when the URL carries no `status` key at all (BP-01). */
export const DEFAULT_DELIVERY_STATUS: DeliveryStatus = "IN_TRANSIT";

export type ParsedDeliveryListingParams = {
  nameQuery: string | undefined;
  statuses: DeliveryStatus[];
  /**
   * True when the raw URL contained a `status` key (even empty). The page canonicalizes
   * bare URLs (no key) to `?status=IN_TRANSIT`; an explicit empty `status=` means
   * "all statuses" and must NOT be re-defaulted.
   */
  hasStatusParam: boolean;
  overdueOnly: boolean;
  arrivalFrom: Date | undefined;
  arrivalTo: Date | undefined;
  storeId: string | undefined;
  productQuery: string | undefined;
  shippedFrom: Date | undefined;
  shippedTo: Date | undefined;
  sort: DeliveryListSort;
  page: number;
  /** Desktop page-size selector value — one of `PAGE_SIZE_OPTIONS`. */
  perPage: number;
};

export type DeliveryListActiveFilters = {
  nameQuery: string | undefined;
  statuses: DeliveryStatus[];
  overdueOnly: boolean;
  arrivalFromIso: string | undefined;
  arrivalToIso: string | undefined;
  storeId: string | undefined;
  productQuery: string | undefined;
  shippedFromIso: string | undefined;
  shippedToIso: string | undefined;
  sort: DeliveryListSort;
  perPage: number;
};

export function parseDeliveryListingParams(
  raw: Record<string, string | string[] | undefined>,
): ParsedDeliveryListingParams {
  const nameQuery = typeof raw.q === "string" ? raw.q.trim() || undefined : undefined;

  // Parse never auto-applies defaults — the canonical default lives in the nav href and
  // in the page-level redirect for bare URLs (parity with the orders post-S8 decision).
  const hasStatusParam = raw.status !== undefined;
  const statuses = arrayFromParam(raw.status).filter((value): value is DeliveryStatus =>
    (ALL_DELIVERY_STATUSES as string[]).includes(value),
  );

  const overdueOnly = parseBoolean(raw.overdue);
  const arrivalFrom = parseDateParam(raw.arrivalFrom);
  const arrivalTo = parseDateParam(raw.arrivalTo);
  const storeId = typeof raw.store === "string" && raw.store.trim() ? raw.store.trim() : undefined;
  const productQuery = typeof raw.product === "string" ? raw.product.trim() || undefined : undefined;
  const shippedFrom = parseDateParam(raw.shippedFrom);
  const shippedTo = parseDateParam(raw.shippedTo);

  const sortParam = typeof raw.sort === "string" ? raw.sort : undefined;
  const sort: DeliveryListSort = (DELIVERY_LIST_SORT_VALUES as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as DeliveryListSort)
    : DEFAULT_DELIVERY_LIST_SORT;

  const page = parsePositiveInteger(raw.page);
  const perPage = parsePageSize(raw.perPage);

  return {
    nameQuery,
    statuses,
    hasStatusParam,
    overdueOnly,
    arrivalFrom,
    arrivalTo,
    storeId,
    productQuery,
    shippedFrom,
    shippedTo,
    sort,
    page,
    perPage,
  };
}

export function buildDeliveryListFilterUrl(
  basePath: string,
  filters: DeliveryListActiveFilters,
  overrides: Partial<DeliveryListActiveFilters & { page: number }> = {},
): string {
  // `in` checks let callers pass explicit `undefined`/`false` to clear a filter.
  const next = {
    nameQuery: "nameQuery" in overrides ? overrides.nameQuery : filters.nameQuery,
    statuses: "statuses" in overrides ? overrides.statuses! : filters.statuses,
    overdueOnly: "overdueOnly" in overrides ? Boolean(overrides.overdueOnly) : filters.overdueOnly,
    arrivalFromIso: "arrivalFromIso" in overrides ? overrides.arrivalFromIso : filters.arrivalFromIso,
    arrivalToIso: "arrivalToIso" in overrides ? overrides.arrivalToIso : filters.arrivalToIso,
    storeId: "storeId" in overrides ? overrides.storeId : filters.storeId,
    productQuery: "productQuery" in overrides ? overrides.productQuery : filters.productQuery,
    shippedFromIso: "shippedFromIso" in overrides ? overrides.shippedFromIso : filters.shippedFromIso,
    shippedToIso: "shippedToIso" in overrides ? overrides.shippedToIso : filters.shippedToIso,
    sort: "sort" in overrides ? overrides.sort! : filters.sort,
    perPage: "perPage" in overrides ? overrides.perPage! : filters.perPage,
  };

  const params = new URLSearchParams();
  if (next.nameQuery && next.nameQuery.trim()) params.set("q", next.nameQuery.trim());
  next.statuses.forEach((value) => params.append("status", value));
  // Always keep the `status` key present: a bare URL canonicalizes back to the default
  // chip, so "no status filter" must be encoded as an explicit empty `status=`.
  if (next.statuses.length === 0) params.set("status", "");
  if (next.overdueOnly) params.set("overdue", "true");
  if (next.arrivalFromIso) params.set("arrivalFrom", next.arrivalFromIso);
  if (next.arrivalToIso) params.set("arrivalTo", next.arrivalToIso);
  if (next.storeId) params.set("store", next.storeId);
  if (next.productQuery && next.productQuery.trim()) params.set("product", next.productQuery.trim());
  if (next.shippedFromIso) params.set("shippedFrom", next.shippedFromIso);
  if (next.shippedToIso) params.set("shippedTo", next.shippedToIso);
  if (next.sort !== DEFAULT_DELIVERY_LIST_SORT) params.set("sort", next.sort);
  if (next.perPage !== DEFAULT_PAGE_SIZE) params.set("perPage", String(next.perPage));

  const targetPage = overrides.page ?? 1;
  if (targetPage > 1) params.set("page", String(targetPage));

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** True when the only active state is the canonical default (`status=IN_TRANSIT`, default sort). */
export function hasOnlyDefaultDeliveryFilters(filters: DeliveryListActiveFilters): boolean {
  return (
    !filters.nameQuery &&
    !filters.overdueOnly &&
    !filters.arrivalFromIso &&
    !filters.arrivalToIso &&
    !filters.storeId &&
    !filters.productQuery &&
    !filters.shippedFromIso &&
    !filters.shippedToIso &&
    filters.sort === DEFAULT_DELIVERY_LIST_SORT &&
    filters.statuses.length === 1 &&
    filters.statuses[0] === DEFAULT_DELIVERY_STATUS
  );
}

function arrayFromParam(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parsePositiveInteger(value: string | string[] | undefined): number {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return 1;
  const parsed = Number.parseInt(first, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

/** Clamps `?perPage=` to the allow-listed `PAGE_SIZE_OPTIONS`; anything else falls back to the default. */
function parsePageSize(value: string | string[] | undefined): number {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return DEFAULT_PAGE_SIZE;
  const parsed = Number.parseInt(first, 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function parseDateParam(value: string | string[] | undefined): Date | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return undefined;
  const trimmed = first.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function parseBoolean(value: string | string[] | undefined): boolean {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "true" || first === "1";
}
