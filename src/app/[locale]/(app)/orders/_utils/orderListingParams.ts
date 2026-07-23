import type { OrderStatus } from "../../../../../../generated/prisma/client";
import { ORDER_LIST_SORT_VALUES, type OrderListPaymentState, type OrderListSort } from "@/lib/orders/orderListSort";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/constants";

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

export const DEFAULT_ORDER_LIST_SORT: OrderListSort = "recent";

const ALL_PAYMENT_STATES: OrderListPaymentState[] = ["paid", "partial", "unpaid", "overdue"];

export type ParsedOrderListingParams = {
  nameQuery: string | undefined;
  productTypeKeys: string[];
  storeId: string | undefined;
  statuses: OrderStatus[];
  paymentStates: OrderListPaymentState[];
  fxPendingOnly: boolean;
  sort: OrderListSort;
  /** True when no `?status=` param is present and the default active set was applied. */
  appliedDefaultStatuses: boolean;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  deliveryFrom: Date | undefined;
  deliveryTo: Date | undefined;
  deliveryOverdueOnly: boolean;
  /** "Atrasados": strict overdue — see `deliveryLateOnly` in `orderQueries.ts`. */
  deliveryLateOnly: boolean;
  page: number;
  /** Desktop page-size selector value — one of `PAGE_SIZE_OPTIONS`. */
  perPage: number;
};

export type OrderListActiveFilters = {
  nameQuery: string | undefined;
  productTypeKeys: string[];
  storeId: string | undefined;
  statuses: OrderStatus[];
  paymentStates: OrderListPaymentState[];
  fxPendingOnly: boolean;
  sort: OrderListSort;
  appliedDefaultStatuses: boolean;
  dateFromIso: string | undefined;
  dateToIso: string | undefined;
  deliveryFromIso: string | undefined;
  deliveryToIso: string | undefined;
  deliveryOverdueOnly: boolean;
  deliveryLateOnly: boolean;
  perPage: number;
};

export function parseOrderListingParams(raw: Record<string, string | string[] | undefined>): ParsedOrderListingParams {
  const nameQuery = typeof raw.q === "string" ? raw.q.trim() || undefined : undefined;
  const productTypeKeys = arrayFromParam(raw.productType).filter(Boolean);
  const storeId = typeof raw.store === "string" && raw.store.trim() ? raw.store.trim() : undefined;

  // Status is never auto-applied. The sidebar / burger entry-point hard-codes the four
  // default-active statuses in its href so clicking it shows "Solo activas". Any other
  // entry (typed URL, chip clear, back-nav) leaves the filter empty.
  const statuses = arrayFromParam(raw.status).filter((value): value is OrderStatus =>
    (ALL_ORDER_STATUSES as string[]).includes(value),
  );

  const paymentStates = arrayFromParam(raw.payment).filter((value): value is OrderListPaymentState =>
    (ALL_PAYMENT_STATES as string[]).includes(value),
  );

  const fxPendingOnly = parseBoolean(raw.fxPending);

  const sortParam = typeof raw.sort === "string" ? raw.sort : undefined;
  const sort: OrderListSort = (ORDER_LIST_SORT_VALUES as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as OrderListSort)
    : DEFAULT_ORDER_LIST_SORT;

  const dateFrom = parseDateParam(raw.dateFrom);
  const dateTo = parseDateParam(raw.dateTo);
  const deliveryFrom = parseDateParam(raw.deliveryFrom);
  const deliveryTo = parseDateParam(raw.deliveryTo);
  const deliveryOverdueOnly = parseBoolean(raw.delOverdue);
  const deliveryLateOnly = parseBoolean(raw.delLate);

  const page = parsePositiveInteger(raw.page);
  const perPage = parsePageSize(raw.perPage);

  return {
    nameQuery,
    productTypeKeys,
    storeId,
    statuses,
    paymentStates,
    fxPendingOnly,
    sort,
    // No longer represents an auto-default — kept on the shape only because callers still
    // pass it through `buildOrderListFilterUrl`. Future cleanup can drop the flag entirely.
    appliedDefaultStatuses: false,
    dateFrom,
    dateTo,
    deliveryFrom,
    deliveryTo,
    deliveryOverdueOnly,
    deliveryLateOnly,
    page,
    perPage,
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
  // Use `in` checks so callers can pass an explicit `undefined`/`false` to clear a filter
  // (e.g. removing the search chip needs `nameQuery: undefined` to win over `filters.nameQuery`).
  const next = {
    nameQuery: "nameQuery" in overrides ? overrides.nameQuery : filters.nameQuery,
    productTypeKeys: "productTypeKeys" in overrides ? overrides.productTypeKeys! : filters.productTypeKeys,
    storeId: "storeId" in overrides ? overrides.storeId : filters.storeId,
    statuses: "statuses" in overrides ? overrides.statuses! : filters.statuses,
    paymentStates: "paymentStates" in overrides ? overrides.paymentStates! : filters.paymentStates,
    fxPendingOnly: "fxPendingOnly" in overrides ? Boolean(overrides.fxPendingOnly) : filters.fxPendingOnly,
    sort: "sort" in overrides ? overrides.sort! : filters.sort,
    appliedDefaultStatuses:
      "appliedDefaultStatuses" in overrides ? overrides.appliedDefaultStatuses! : filters.appliedDefaultStatuses,
    dateFromIso: "dateFromIso" in overrides ? overrides.dateFromIso : filters.dateFromIso,
    dateToIso: "dateToIso" in overrides ? overrides.dateToIso : filters.dateToIso,
    deliveryFromIso: "deliveryFromIso" in overrides ? overrides.deliveryFromIso : filters.deliveryFromIso,
    deliveryToIso: "deliveryToIso" in overrides ? overrides.deliveryToIso : filters.deliveryToIso,
    deliveryOverdueOnly:
      "deliveryOverdueOnly" in overrides ? Boolean(overrides.deliveryOverdueOnly) : filters.deliveryOverdueOnly,
    deliveryLateOnly: "deliveryLateOnly" in overrides ? Boolean(overrides.deliveryLateOnly) : filters.deliveryLateOnly,
    perPage: "perPage" in overrides ? overrides.perPage! : filters.perPage,
  };

  const params = new URLSearchParams();
  if (next.nameQuery && next.nameQuery.trim()) params.set("q", next.nameQuery.trim());
  if (next.storeId) params.set("store", next.storeId);
  next.productTypeKeys.forEach((value) => params.append("productType", value));
  next.statuses.forEach((value) => params.append("status", value));
  if (next.statuses.length === 0 && overrides.statuses !== undefined) {
    params.set("status", "");
  }
  next.paymentStates.forEach((value) => params.append("payment", value));
  if (next.fxPendingOnly) params.set("fxPending", "true");
  if (next.sort !== DEFAULT_ORDER_LIST_SORT) params.set("sort", next.sort);
  if (next.dateFromIso) params.set("dateFrom", next.dateFromIso);
  if (next.dateToIso) params.set("dateTo", next.dateToIso);
  if (next.deliveryFromIso) params.set("deliveryFrom", next.deliveryFromIso);
  if (next.deliveryToIso) params.set("deliveryTo", next.deliveryToIso);
  if (next.deliveryOverdueOnly) params.set("delOverdue", "true");
  if (next.deliveryLateOnly) params.set("delLate", "true");
  if (next.perPage !== DEFAULT_PAGE_SIZE) params.set("perPage", String(next.perPage));

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
    !filters.deliveryFromIso &&
    !filters.deliveryToIso &&
    !filters.deliveryOverdueOnly &&
    !filters.deliveryLateOnly &&
    filters.paymentStates.length === 0 &&
    !filters.fxPendingOnly &&
    filters.sort === DEFAULT_ORDER_LIST_SORT &&
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
