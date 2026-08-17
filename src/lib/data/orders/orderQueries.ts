import { prisma } from "@/lib/prisma";
import { buildNeedsFxReconciliationWhere, needsFxReconciliation } from "@/lib/fx/reconciliation";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { getTodayStart } from "@/lib/data/dashboard/dashboardPeriods";
import { deriveHasUnpaidBalance } from "@/lib/orders/orderState";
import { computeOrderEligibility, type OrderEligibilityResult } from "@/lib/orders/orderLifecycle";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { resolveBasePagableMinor } from "@/lib/orders/productPaymentState";
import {
  mapAllocationsToOrderPayments,
  ORDER_PAYMENT_ALLOCATION_ORDER_BY,
  ORDER_PAYMENT_ALLOCATION_SELECT,
  type OrderPaymentRecord,
} from "./orderPaymentAllocations";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import type { OrderListSort } from "@/lib/orders/orderListSort";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/constants";
import {
  DeliveryStatus,
  OrderItemDeliveryState,
  type OrderItemDeliveryState as OrderItemDeliveryStatePrisma,
  type OrderStatus,
  type StoreRemovalReason,
  type StoreStatus,
} from "../../../../generated/prisma/client";

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  productTypeKey: string | null;
  position: number;
};

export type OrderListItem = {
  id: string;
  humanReadableId: string;
  storeId: string;
  storeName: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  totalCost: number;
  status: OrderStatus;
  createdAt: Date;
};

/** An order's payments come from its allocations; see `orderPaymentAllocations` for the shape. */
export type OrderPayment = OrderPaymentRecord;
export type { OrderPaymentRecord };

export type OrderDetail = OrderListItem & {
  note: string | null;
  cancellationReason: string | null;
  /** True when this order's stored exchange rate is stale after a base-currency change. */
  needsExchangeRateUpdate: boolean;
  updatedAt: Date;
  hasUnpaidBalance: boolean;
  paidAmount: number;
  remainingAmount: number;
  paymentPercentage: number;
  items: OrderItem[];
  payments: OrderPayment[];
  history: Array<{
    id: string;
    eventType: string;
    metadata: unknown;
    createdAt: Date;
  }>;
};

export type OrderListFilters = {
  status?: OrderStatus;
  storeId?: string;
};

export type OrderItemWithDeliveryState = OrderItem & {
  deliveryState: ItemDeliveryState;
  /**
   * The collector's own "this product is paid" mark. Independent of `deliveryState`: arriving and
   * being paid are different axes, and the detail is the only surface where a delivered product can
   * still be audited for payment.
   */
  paidDeclared: boolean;
  /**
   * Money already declared against THIS item specifically (`PaymentAllocation.amountMinor` rows
   * naming it). Order-level money that never named a product is not counted here. Raw input for
   * `resolveProductPaymentState`, same shape as `PendingProductRow.allocatedMinor`.
   */
  allocatedMinor: number;
  /**
   * The amount this item is "responsible" for out of the order total: unit price x quantity when
   * known, or the whole order total when this is the order's only item. `null` when neither can be
   * derived. Raw input for `resolveProductPaymentState`, same shape as
   * `PendingProductRow.basePagableMinor`.
   */
  basePagableMinor: number | null;
};

/**
 * Alias of the pure rule's result type. The rule itself lives in `@/lib/orders/orderLifecycle`;
 * this name is kept because the detail surfaces already import it from here.
 */
export type OrderEligibility = OrderEligibilityResult;

export type OrderFlags = {
  hasPayments: boolean;
  hasNonCancelledDeliveryLinks: boolean;
};

export type OrderDetailFull = Omit<OrderDetail, "items"> & {
  store: {
    id: string;
    name: string;
    slug: string;
    status: StoreStatus;
    removalReason: StoreRemovalReason | null;
    logoUrl: string | null;
  };
  items: OrderItemWithDeliveryState[];
  eligibility: OrderEligibility;
  flags: OrderFlags;
  /**
   * Money declared against this order without naming a product. Stated as its own figure instead of
   * being spread across the items, which nothing in this codebase is allowed to do.
   */
  undetailedPaidMinor: number;
};

/**
 * Minimal order lookup for the shell header (title / breadcrumb) on the detail-segment layout.
 * Selects only the human-readable id so it can run above the detail-route Suspense boundary
 * without duplicating the heavy detail query.
 */
export async function getOrderHeader(
  orderId: string,
  userId: string,
): Promise<{ id: string; humanReadableId: string } | null> {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, humanReadableId: true },
  });
}

/**
 * Finds an order this user already saved under a given note marker, following the marker precedent
 * of `scripts/local/migrate-pedidos/chat-load.ts`. Scoped by `userId` so one collector's marker can
 * never resolve to another's order, and selected down to the id because the only question the
 * caller has is "does this already exist".
 */
export async function findOrderIdByNoteMarker(userId: string, marker: string): Promise<string | null> {
  const row = await prisma.order.findFirst({
    where: { userId, note: { contains: marker } },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * The ids of an order's items paired with the position each one was written at.
 *
 * The one read that lets a declaration made against an order that did not exist yet be resolved to
 * real products: the review screen speaks positions (the only key that survives the client/server
 * hop, since `createMany` returns no ids in Postgres), and this turns them back into `orderItemId`s
 * once the create transaction has committed.
 *
 * It returns rows and NOT a `Map` on purpose. A `Map` would already have resolved the ordering, so a
 * caller mapping by array index instead of by `position` would look identical from the outside, and
 * no test of the caller could tell the two apart.
 */
export async function listOrderItemPositions(
  orderId: string,
  userId: string,
): Promise<{ id: string; position: number }[]> {
  return prisma.orderItem.findMany({
    where: { orderId, userId },
    select: { id: true, position: true },
  });
}

export async function getOrderById(orderId: string, userId: string): Promise<OrderDetail | null> {
  const preferences = await getCollectorPreferencesSnapshot(userId);
  const row = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      humanReadableId: true,
      storeId: true,
      store: { select: { name: true } },
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      exchangeRate: true,
      exchangeRateBaseCode: true,
      totalCost: true,
      note: true,
      status: true,
      cancellationReason: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          productTypeKey: true,
          position: true,
        },
        orderBy: { position: "asc" },
      },
      paymentAllocations: {
        select: ORDER_PAYMENT_ALLOCATION_SELECT,
        orderBy: ORDER_PAYMENT_ALLOCATION_ORDER_BY,
      },
      history: {
        select: { id: true, eventType: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!row) return null;

  const payments = mapAllocationsToOrderPayments(row.paymentAllocations);
  const { paidAmount, remainingAmount, paymentPercentage } = calculatePaymentSummary(row.totalCost, payments);

  return {
    id: row.id,
    humanReadableId: row.humanReadableId,
    storeId: row.storeId,
    storeName: row.store.name,
    orderDate: row.orderDate,
    expectedDeliveryFrom: row.expectedDeliveryFrom,
    expectedDeliveryTo: row.expectedDeliveryTo,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    needsExchangeRateUpdate: needsFxReconciliation(
      {
        currencyCode: row.currencyCode,
        exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
        exchangeRateBaseCode: row.exchangeRateBaseCode,
      },
      preferences?.baseCurrencyCode ?? null,
    ),
    totalCost: row.totalCost,
    note: row.note,
    cancellationReason: row.cancellationReason,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasUnpaidBalance: deriveHasUnpaidBalance(row.totalCost, paidAmount),
    paidAmount,
    remainingAmount,
    paymentPercentage,
    items: row.items,
    payments,
    history: row.history,
  };
}

/**
 * Exported for `pendingProductsByStoreQueries.ts` (the "Por tienda" list view), so both list shapes
 * derive an item's display state from the same rule instead of drifting apart.
 */
export function deriveItemDeliveryState(
  deliveryItems: Array<{ delivery: { status: DeliveryStatus } }>,
  ownDeliveryState: OrderItemDeliveryStatePrisma,
): ItemDeliveryState {
  if (deliveryItems.length > 0) {
    const hasDelivered = deliveryItems.some((d) => d.delivery.status === DeliveryStatus.DELIVERED);
    if (hasDelivered) return "delivered";
    return "in_transit";
  }
  if (ownDeliveryState === "ARRIVED_AT_STORE") return "arrived_at_store";
  return "open";
}

export async function getOrderDetail(orderId: string, userId: string): Promise<OrderDetailFull | null> {
  const preferences = await getCollectorPreferencesSnapshot(userId);
  const row = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      humanReadableId: true,
      storeId: true,
      store: {
        select: { id: true, name: true, slug: true, status: true, removalReason: true, logoUrl: true },
      },
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      exchangeRate: true,
      exchangeRateBaseCode: true,
      totalCost: true,
      note: true,
      status: true,
      cancellationReason: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          productTypeKey: true,
          position: true,
          deliveryState: true,
          paidDeclaredAt: true,
          deliveryItems: {
            select: { delivery: { select: { status: true } } },
            where: { delivery: { status: { not: DeliveryStatus.CANCELLED } } },
          },
        },
        orderBy: { position: "asc" },
      },
      paymentAllocations: {
        select: ORDER_PAYMENT_ALLOCATION_SELECT,
        orderBy: ORDER_PAYMENT_ALLOCATION_ORDER_BY,
      },
      history: {
        select: { id: true, eventType: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!row) return null;

  const payments = mapAllocationsToOrderPayments(row.paymentAllocations);
  const { paidAmount, remainingAmount, paymentPercentage } = calculatePaymentSummary(row.totalCost, payments);

  // Money already declared against each item specifically, read from the allocations already
  // fetched above rather than a second query — `paymentAllocations` already carries `orderItemId`.
  const allocatedMinorByItemId = new Map<string, number>();
  for (const allocation of row.paymentAllocations) {
    if (allocation.orderItemId === null) continue;
    allocatedMinorByItemId.set(
      allocation.orderItemId,
      (allocatedMinorByItemId.get(allocation.orderItemId) ?? 0) + allocation.amountMinor,
    );
  }

  const itemsWithState: OrderItemWithDeliveryState[] = row.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    productTypeKey: item.productTypeKey,
    position: item.position,
    deliveryState: deriveItemDeliveryState(item.deliveryItems, item.deliveryState),
    paidDeclared: item.paidDeclaredAt !== null,
    allocatedMinor: allocatedMinorByItemId.get(item.id) ?? 0,
    basePagableMinor: resolveBasePagableMinor(item.unitPrice, item.quantity, row.totalCost, row.items.length),
  }));

  const undetailedPaidMinor = row.paymentAllocations.reduce(
    (sum, allocation) => (allocation.orderItemId === null ? sum + allocation.amountMinor : sum),
    0,
  );

  // The rule for "can this order still be cancelled or deleted" is owned by
  // `@/lib/orders/orderLifecycle`; this query only feeds it the derived item states.
  const eligibility: OrderEligibility = computeOrderEligibility(itemsWithState);

  const flags: OrderFlags = {
    hasPayments: payments.length > 0,
    hasNonCancelledDeliveryLinks: eligibility.blockReason === "ITEMS_LINKED_TO_DELIVERY",
  };

  return {
    id: row.id,
    humanReadableId: row.humanReadableId,
    storeId: row.storeId,
    store: row.store,
    storeName: row.store.name,
    orderDate: row.orderDate,
    expectedDeliveryFrom: row.expectedDeliveryFrom,
    expectedDeliveryTo: row.expectedDeliveryTo,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    needsExchangeRateUpdate: needsFxReconciliation(
      {
        currencyCode: row.currencyCode,
        exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
        exchangeRateBaseCode: row.exchangeRateBaseCode,
      },
      preferences?.baseCurrencyCode ?? null,
    ),
    totalCost: row.totalCost,
    note: row.note,
    cancellationReason: row.cancellationReason,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasUnpaidBalance: deriveHasUnpaidBalance(row.totalCost, paidAmount),
    paidAmount,
    remainingAmount,
    paymentPercentage,
    items: itemsWithState,
    payments,
    history: row.history,
    eligibility,
    flags,
    undetailedPaidMinor,
  };
}

export type OrdersListPageItem = {
  id: string;
  humanReadableId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  totalCost: number;
  status: OrderStatus;
  store: {
    id: string;
    name: string;
    slug: string;
    status: StoreStatus;
    removalReason: StoreRemovalReason | null;
    logoUrl: string | null;
  };
  itemCount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    productTypeKey: string | null;
    unitPrice: number | null;
    deliveryState: ItemDeliveryState;
  }>;
  paidAmount: number;
  paymentPercentage: number;
  hasUnpaidBalance: boolean;
};

export { ORDER_LIST_SORT_VALUES } from "@/lib/orders/orderListSort";
export type { OrderListSort } from "@/lib/orders/orderListSort";

export type OrdersListPageFilters = {
  nameQuery?: string;
  productTypeKeys?: string[];
  storeId?: string;
  statuses?: OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  /** Expected-delivery range overlap (any part of the order's window inside the range). */
  deliveryFrom?: Date;
  deliveryTo?: Date;
  /**
   * "Por recibir": orders whose expectedDeliveryFrom <= today and are still pending
   * (status NOT IN COMPLETED/CANCELLED). Includes orders past their window. Mutually
   * exclusive with `deliveryFrom`/`deliveryTo` (caller is expected to enforce that).
   */
  deliveryOverdueOnly?: boolean;
  /**
   * "Atrasados": stricter than `deliveryOverdueOnly` — the delivery window has fully
   * closed (`expectedDeliveryTo ?? expectedDeliveryFrom < today`), not just started, and
   * the order is still pending. Mirrors the dashboard's overdue-arrivals definition
   * (`resolveArrivalDueDate` in dashboardAggregation.ts). Takes priority over
   * `deliveryOverdueOnly`/`deliveryFrom`/`deliveryTo` when set.
   */
  deliveryLateOnly?: boolean;
  /**
   * "Con saldo pendiente": the order's declared allocations do not cover its own total
   * (`totalCost > allocatedAmountMinor`), i.e. the same fact `deriveHasUnpaidBalance` reports per
   * row. Cancelled orders are always excluded, whatever `statuses` says: ADR 0025 defines debt as
   * `Σ committed (non-cancelled orders) − Σ paid`, so a cancelled pedido owes nothing regardless of
   * the total it was created with. Composes with every other filter (`status=COMPLETED` plus this
   * is the "delivered but still owing" question that motivated it).
   */
  withBalanceOnly?: boolean;
  /** When true, restrict to orders eligible for FX reconciliation (foreign currency, current-month). */
  fxPendingOnly?: boolean;
  /** User's base currency, required for `fxPendingOnly` and `pendingFxCount`. */
  baseCurrencyCode?: string | null;
  /**
   * The collector's IANA timezone, used to resolve the CIVIL day the delivery toggles compare
   * against. Travels with `baseCurrencyCode` because it comes from the same preferences snapshot.
   * Without it the day falls back to UTC (`resolveTimeZone`), which is the dashboard's and the
   * reminders' behaviour too — being consistent with them is worth more than being special here.
   */
  timeZone?: string | null;
  sort?: OrderListSort;
  page: number;
  pageSize: number;
};

export type OrdersListPageResult = {
  orders: OrdersListPageItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  pendingFxCount: number;
};

function buildFxPendingWhere(userId: string, baseCurrencyCode: string | null | undefined) {
  const fxWhere = buildNeedsFxReconciliationWhere(baseCurrencyCode);
  if (!fxWhere) return null;
  // Pending-ness comes straight from the shared derivation, so this list, its count, the modal's
  // rows, and the dashboard rollup can never disagree. Cancelled orders are excluded; reactivating
  // one re-surfaces it, because nothing about the rate changed while it was cancelled.
  return {
    userId,
    status: { not: "CANCELLED" as OrderStatus },
    ...fxWhere,
  };
}

/**
 * Counts the collector's non-cancelled foreign-currency orders flagged for FX reconciliation
 * against the given base currency. Used by Settings to decide whether to surface a
 * "reconcile rates" shortcut after a base-currency change. Returns 0 when there is no base
 * currency (nothing can be flagged as stale without one).
 */
export async function countOrdersPendingFxReconciliation(
  userId: string,
  baseCurrencyCode: string | null,
): Promise<number> {
  const where = buildFxPendingWhere(userId, baseCurrencyCode);
  if (!where) return 0;
  return prisma.order.count({ where });
}

export type FxReconciliationOrder = {
  id: string;
  humanReadableId: string;
  totalCost: number;
  currencyCode: string;
};

/**
 * Lists the same set of orders `countOrdersPendingFxReconciliation` counts, using the identical
 * `buildFxPendingWhere` predicate. Feeds the "Actualizar tipos de cambio" modal so its rows can
 * never diverge from the banner count. Returns `[]` when there is no base currency.
 */
export async function listOrdersPendingFxReconciliation(
  userId: string,
  baseCurrencyCode: string | null,
): Promise<FxReconciliationOrder[]> {
  const where = buildFxPendingWhere(userId, baseCurrencyCode);
  if (!where) return [];
  return prisma.order.findMany({
    where,
    select: { id: true, humanReadableId: true, totalCost: true, currencyCode: true },
    orderBy: { orderDate: "desc" },
    take: 500,
  });
}

export type OrdersHeadingCounts = {
  activeCount: number;
  closedCount: number;
};

/**
 * Global active/closed order counts for the orders page heading meta ("N active, N closed").
 * "Closed" means a terminal status (COMPLETED or CANCELLED); "active" is everything else,
 * derived as `total - closed` rather than a separate query.
 */
export async function getOrdersHeadingCounts(userId: string): Promise<OrdersHeadingCounts> {
  const [totalAcrossUser, closedCount] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.count({ where: { userId, status: { in: ["COMPLETED", "CANCELLED"] } } }),
  ]);
  return {
    activeCount: Math.max(0, totalAcrossUser - closedCount),
    closedCount,
  };
}

export type OrderStoreOption = { id: string; name: string };

/**
 * Distinct stores the user has orders with — feeds the list filter drawer. Independent of current
 * orderability (`getOrderableStores`, used by order creation): a store the user already ordered
 * from must stay filterable even after it closes or is removed, mirroring `getDeliveryStoreOptions`.
 */
export async function getOrderStoreOptions(userId: string): Promise<OrderStoreOption[]> {
  const rows = await prisma.order.findMany({
    where: { userId },
    select: { store: { select: { id: true, name: true } } },
    distinct: ["storeId"],
    orderBy: { store: { name: "asc" } },
  });
  return rows.map((row) => ({ id: row.store.id, name: row.store.name }));
}

export async function getOrdersList(userId: string, filters: OrdersListPageFilters): Promise<OrdersListPageResult> {
  const {
    nameQuery,
    productTypeKeys,
    storeId,
    statuses,
    dateFrom,
    dateTo,
    deliveryFrom,
    deliveryTo,
    deliveryOverdueOnly,
    deliveryLateOnly,
    withBalanceOnly,
    fxPendingOnly,
    baseCurrencyCode,
    timeZone,
    sort = "recent",
    page,
    pageSize: requestedPageSize,
  } = filters;
  // Hardened against arbitrary URL values: only the allow-listed options are honored.
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  // The collector's civil day at UTC midnight, never a wall-clock instant. The delivery toggles
  // below compare against midnight-UTC domain dates, so a raw `new Date()` made "Atrasados" pick up
  // an order due TOMORROW from 19:00 in Lima — and it would then disagree with the row chip on the
  // very same page, which resolves the same question with `getTodayStart`.
  const now = getTodayStart(new Date(), timeZone);

  const itemConditions: Array<Record<string, unknown>> = [];
  if (nameQuery && nameQuery.trim()) {
    const trimmed = nameQuery.trim();
    itemConditions.push({
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { order: { is: { humanReadableId: { contains: trimmed, mode: "insensitive" } } } },
      ],
    });
  }
  if (productTypeKeys && productTypeKeys.length > 0) {
    itemConditions.push({ productTypeKey: { in: productTypeKeys } });
  }

  const trimmedQuery = nameQuery?.trim();
  // Same derivation the banner count and the modal rows use, so "N pedidos por reconciliar" always
  // lands on exactly those N rows. Joined as an AND group rather than spread at the top level: it
  // carries its own `OR`, which would otherwise sit alongside the search/payment-state `OR`s.
  const fxPendingWhere = fxPendingOnly ? buildNeedsFxReconciliationWhere(baseCurrencyCode) : null;

  // Column-to-column comparison via a Prisma field reference, so the filter, `prisma.order.count`
  // and the pagination window all read the same rows in SQL. Deriving it in memory would need the
  // whole result set fetched first, which is exactly what the allocation cache exists to avoid.
  const withBalanceWhere: Record<string, unknown> | null = withBalanceOnly
    ? {
        totalCost: { gt: prisma.order.fields.allocatedAmountMinor },
        status: { not: "CANCELLED" satisfies OrderStatus },
      }
    : null;

  // Delivery filter — `deliveryLateOnly` ("Atrasados") wins over `deliveryOverdueOnly`
  // ("Por recibir"), which wins over an explicit range, when more than one is present.
  // `deliveryLateOnly`: the window has fully closed (`expectedDeliveryTo ?? expectedDeliveryFrom
  // < today`) and order still pending — mirrors the dashboard's overdue-arrivals definition.
  // `deliveryOverdueOnly`: window already started (`expectedDeliveryFrom <= today`) and
  // order still pending. Range mode: overlap with [from, to].
  const deliveryWhere: Record<string, unknown> = {};
  // When the user already filters by status, intersect with the explicit set (no implicit
  // notIn). Otherwise apply the "still pending" constraint inherent to the toggle.
  const hasExplicitStatuses = statuses && statuses.length > 0;
  if (deliveryLateOnly) {
    // Same rule as `resolveOrderArrivalDueDate`, expressed in SQL: the window close, or its start
    // when there is no close.
    deliveryWhere.OR = [
      { expectedDeliveryTo: { lt: now } },
      { expectedDeliveryTo: null, expectedDeliveryFrom: { lt: now } },
    ];
    // `isOrderArrivalObserved` expressed in SQL: at least one product still WAITING, so an order
    // whose every product has already been observed reaching the store drops out of the filter the
    // same way it drops out of the chip. The pairing is the point — this filter and the row chips
    // sit on the same page, and a row that matches the filter with no chip on it is the defect the
    // civil-day guard already exists to prevent in the other dimension.
    //
    // "Waiting" is spelled the way `deriveItemDeliveryState` derives it, not as `deliveryState:
    // NONE` alone: an item still at NONE but linked to a live delivery is `in_transit`, and the
    // `not: CANCELLED` narrow here is the same one the row select applies to `deliveryItems`.
    //
    // An order with NO items at all can satisfy neither `some` clause above, so on its own the
    // "waiting" narrow would drop it from the filter while `isOrderArrivalObserved([]) === false`
    // (see orderDerivedState.ts) keeps its chip amber — the exact pairing failure this narrow
    // exists to prevent, just reached from the other side. `items: { none: {} }` is the SQL reading
    // of that same `false`: an itemless order is never "observed", so it stays in "Atrasados" too.
    deliveryWhere.AND = [
      {
        OR: [
          {
            items: {
              some: {
                deliveryState: OrderItemDeliveryState.NONE,
                deliveryItems: { none: { delivery: { status: { not: DeliveryStatus.CANCELLED } } } },
              },
            },
          },
          { items: { none: {} } },
        ],
      },
    ];
    // `isOrderOverdue` hard-zeroes COMPLETED/CANCELLED whatever else is true of the order
    // (orderDerivedState.ts), so this narrow must always intersect the caller's own explicit
    // statuses rather than only filling in when none were given — otherwise ticking "Cancelado"
    // alongside "Atrasados" could return a cancelled order with a waiting product and no overdue
    // chip on it, the same pairing failure as the itemless case above.
    const stillPendingStatuses: OrderStatus[] = ["COMPLETED", "CANCELLED"];
    deliveryWhere.status = hasExplicitStatuses
      ? { in: statuses, notIn: stillPendingStatuses }
      : { notIn: stillPendingStatuses };
  } else if (deliveryOverdueOnly) {
    deliveryWhere.expectedDeliveryFrom = { lte: now };
    if (!hasExplicitStatuses) {
      deliveryWhere.status = { notIn: ["COMPLETED", "CANCELLED"] as OrderStatus[] };
    }
  } else if (deliveryFrom || deliveryTo) {
    // Overlap: order window touches the requested range when
    //   order.expectedDeliveryFrom <= range.to AND order.expectedDeliveryTo >= range.from.
    // Null endpoints mean "open-ended" on that side.
    const conditions: Array<Record<string, unknown>> = [];
    if (deliveryTo) conditions.push({ expectedDeliveryFrom: { lte: deliveryTo } });
    if (deliveryFrom) conditions.push({ expectedDeliveryTo: { gte: deliveryFrom } });
    if (conditions.length > 0) Object.assign(deliveryWhere, { AND: conditions });
  }

  const baseFilters: Record<string, unknown> = {
    userId,
    ...(storeId ? { storeId } : {}),
    ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
    ...(dateFrom || dateTo
      ? {
          orderDate: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...deliveryWhere,
  };

  const matchAny: Array<Record<string, unknown>> = [];
  if (itemConditions.length > 0) {
    matchAny.push({ items: { some: { AND: itemConditions } } });
  }
  if (trimmedQuery) {
    matchAny.push({ humanReadableId: { contains: trimmedQuery, mode: "insensitive" } });
    matchAny.push({ store: { is: { name: { contains: trimmedQuery, mode: "insensitive" } } } });
  }

  const existingAnd = baseFilters.AND;
  const andGroups: Array<Record<string, unknown>> = Array.isArray(existingAnd) ? [...existingAnd] : [];
  if (matchAny.length > 0) andGroups.push({ OR: matchAny });
  if (fxPendingWhere) andGroups.push(fxPendingWhere);
  if (withBalanceWhere) andGroups.push(withBalanceWhere);

  const { AND: _ignoredBaseAnd, ...baseWithoutAnd } = baseFilters;
  const where = andGroups.length > 0 ? { ...baseWithoutAnd, AND: andGroups } : baseFilters;

  const orderBy = resolveOrderBy(sort);

  const select = {
    id: true,
    humanReadableId: true,
    orderDate: true,
    expectedDeliveryFrom: true,
    expectedDeliveryTo: true,
    currencyCode: true,
    exchangeRate: true,
    totalCost: true,
    status: true,
    store: {
      select: { id: true, name: true, slug: true, status: true, removalReason: true, logoUrl: true },
    },
    items: {
      select: {
        id: true,
        name: true,
        quantity: true,
        productTypeKey: true,
        unitPrice: true,
        position: true,
        deliveryState: true,
        deliveryItems: {
          select: { delivery: { select: { status: true } } },
          where: { delivery: { status: { not: DeliveryStatus.CANCELLED } } },
        },
      },
      orderBy: { position: "asc" } as const,
    },
    allocatedAmountMinor: true,
  } as const;

  const fxWhere = buildFxPendingWhere(userId, baseCurrencyCode ?? null);

  // The persisted payment cache lets filtering, sorting, and pagination all run natively in SQL,
  // so the list no longer over-fetches to derive percentages in memory. `totalCount` therefore
  // comes straight from the DB count of the same filtered `where`.
  const [rows, totalCount, pendingFxCount] = await Promise.all([
    prisma.order.findMany({
      where,
      select,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
    fxWhere ? prisma.order.count({ where: fxWhere }) : Promise.resolve(0),
  ]);

  const orders: OrdersListPageItem[] = rows.map((row) => ({
    id: row.id,
    humanReadableId: row.humanReadableId,
    orderDate: row.orderDate,
    expectedDeliveryFrom: row.expectedDeliveryFrom,
    expectedDeliveryTo: row.expectedDeliveryTo,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    totalCost: row.totalCost,
    status: row.status,
    store: row.store,
    itemCount: row.items.length,
    items: row.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      productTypeKey: item.productTypeKey,
      unitPrice: item.unitPrice,
      deliveryState: deriveItemDeliveryState(item.deliveryItems, item.deliveryState),
    })),
    // Read from the allocation cache: money declared against this order under store-level
    // payments. The percentage is derived from the same number rather than read from the frozen
    // `paymentPercent` column, so the card's amount and its progress can never disagree.
    paidAmount: row.allocatedAmountMinor,
    paymentPercentage: calculatePaymentSummary(row.totalCost, [{ amount: row.allocatedAmountMinor }]).paymentPercentage,
    hasUnpaidBalance: deriveHasUnpaidBalance(row.totalCost, row.allocatedAmountMinor),
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return { orders, totalCount, totalPages, page, pageSize, pendingFxCount };
}

/**
 * Terminal tiebreaker on a unique column. Without one, every key here is non-unique (two orders
 * share a date, a store, a total), so Postgres may order tied rows differently between two
 * paginated queries and a row can be dropped from one page and repeated on the next.
 */
const ID_TIEBREAKER = { id: "asc" as const };

function resolveOrderBy(sort: OrderListSort) {
  switch (sort) {
    case "oldest":
      return [{ orderDate: "asc" as const }, ID_TIEBREAKER];
    case "store-asc":
      return [{ store: { name: "asc" as const } }, ID_TIEBREAKER];
    case "store-desc":
      return [{ store: { name: "desc" as const } }, ID_TIEBREAKER];
    case "total-desc":
      return [{ totalCost: "desc" as const }, ID_TIEBREAKER];
    case "recent":
    default:
      return [{ orderDate: "desc" as const }, ID_TIEBREAKER];
  }
}

export async function listOrders(userId: string, filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  const rows = await prisma.order.findMany({
    where: {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.storeId ? { storeId: filters.storeId } : {}),
    },
    select: {
      id: true,
      humanReadableId: true,
      storeId: true,
      store: { select: { name: true } },
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      exchangeRate: true,
      totalCost: true,
      status: true,
      createdAt: true,
    },
    orderBy: { orderDate: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    humanReadableId: row.humanReadableId,
    storeId: row.storeId,
    storeName: row.store.name,
    orderDate: row.orderDate,
    expectedDeliveryFrom: row.expectedDeliveryFrom,
    expectedDeliveryTo: row.expectedDeliveryTo,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    totalCost: row.totalCost,
    status: row.status,
    createdAt: row.createdAt,
  }));
}
