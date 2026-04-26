import type { OrderStatus } from "../../../../../../generated/prisma/client";

const ALL_ORDER_STATUSES: OrderStatus[] = [
  "OPEN",
  "PARTIALLY_IN_TRANSIT",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

export const DEFAULT_ACTIVE_STATUSES: OrderStatus[] = [
  "OPEN",
  "PARTIALLY_IN_TRANSIT",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
];

export const ORDER_LIST_PAGE_SIZE = 20;

export type ParsedOrderListingParams = {
  nameQuery: string | undefined;
  productTypeKeys: string[];
  storeId: string | undefined;
  statuses: OrderStatus[];
  /** True when no `?status=` param is present and the default active set was applied. */
  appliedDefaultStatuses: boolean;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  page: number;
};

export type OrderListActiveFilters = {
  nameQuery: string | undefined;
  productTypeKeys: string[];
  storeId: string | undefined;
  statuses: OrderStatus[];
  appliedDefaultStatuses: boolean;
  dateFromIso: string | undefined;
  dateToIso: string | undefined;
};

export function parseOrderListingParams(raw: Record<string, string | string[] | undefined>): ParsedOrderListingParams {
  const nameQuery = typeof raw.q === "string" ? raw.q.trim() || undefined : undefined;
  const productTypeKeys = arrayFromParam(raw.productType).filter(Boolean);
  const storeId = typeof raw.store === "string" && raw.store.trim() ? raw.store.trim() : undefined;

  const hasStatusParam = raw.status !== undefined;
  const parsedStatuses = arrayFromParam(raw.status).filter((value): value is OrderStatus =>
    (ALL_ORDER_STATUSES as string[]).includes(value),
  );
  const statuses = hasStatusParam ? parsedStatuses : DEFAULT_ACTIVE_STATUSES;

  const dateFrom = parseDateParam(raw.dateFrom);
  const dateTo = parseDateParam(raw.dateTo);

  const page = parsePositiveInteger(raw.page);

  return {
    nameQuery,
    productTypeKeys,
    storeId,
    statuses,
    appliedDefaultStatuses: !hasStatusParam,
    dateFrom,
    dateTo,
    page,
  };
}

export function isDefaultActiveStatusSet(statuses: OrderStatus[]): boolean {
  return (
    statuses.length === DEFAULT_ACTIVE_STATUSES.length &&
    DEFAULT_ACTIVE_STATUSES.every((status) => statuses.includes(status))
  );
}

export function buildOrderListFilterUrl(
  basePath: string,
  filters: OrderListActiveFilters,
  overrides: Partial<OrderListActiveFilters & { page: number }> = {},
): string {
  const next = {
    nameQuery: overrides.nameQuery !== undefined ? overrides.nameQuery : filters.nameQuery,
    productTypeKeys: overrides.productTypeKeys ?? filters.productTypeKeys,
    storeId: overrides.storeId !== undefined ? overrides.storeId : filters.storeId,
    statuses: overrides.statuses ?? filters.statuses,
    appliedDefaultStatuses:
      overrides.appliedDefaultStatuses !== undefined
        ? overrides.appliedDefaultStatuses
        : filters.appliedDefaultStatuses,
    dateFromIso: overrides.dateFromIso !== undefined ? overrides.dateFromIso : filters.dateFromIso,
    dateToIso: overrides.dateToIso !== undefined ? overrides.dateToIso : filters.dateToIso,
  };

  const params = new URLSearchParams();
  if (next.nameQuery && next.nameQuery.trim()) params.set("q", next.nameQuery.trim());
  if (next.storeId) params.set("store", next.storeId);
  next.productTypeKeys.forEach((value) => params.append("productType", value));
  next.statuses.forEach((value) => params.append("status", value));
  if (next.statuses.length === 0 && overrides.statuses !== undefined) {
    params.set("status", "");
  }
  if (next.dateFromIso) params.set("dateFrom", next.dateFromIso);
  if (next.dateToIso) params.set("dateTo", next.dateToIso);

  const targetPage = overrides.page ?? 1;
  if (targetPage > 1) params.set("page", String(targetPage));

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function hasOnlyDefaultActiveFilters(filters: OrderListActiveFilters): boolean {
  return (
    !filters.nameQuery &&
    filters.productTypeKeys.length === 0 &&
    !filters.storeId &&
    !filters.dateFromIso &&
    !filters.dateToIso &&
    isDefaultActiveStatusSet(filters.statuses)
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

function parseDateParam(value: string | string[] | undefined): Date | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return undefined;
  const trimmed = first.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}
