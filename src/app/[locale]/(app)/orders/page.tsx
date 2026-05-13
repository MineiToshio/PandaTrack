import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { prisma } from "@/lib/prisma";
import { getOrdersList } from "@/lib/data/orders/orderQueries";
import { getOrderableStores } from "@/lib/data/stores/storeQueries";
import { ROUTES } from "@/lib/constants";
import {
  DEFAULT_ORDER_LIST_SORT,
  ORDER_LIST_PAGE_SIZE,
  parseOrderListingParams,
  type OrderListActiveFilters,
} from "./_utils/orderListingParams";
import OrderListContent from "./_components/OrderListContent";
import OrderListFilters from "./_components/OrderListFilters";
import OrderListFilterChips from "./_components/OrderListFilterChips";
import OrderListPagination from "./_components/OrderListPagination";
import FxAnnouncer from "./_components/FxAnnouncer";
import OrderListLoadingSkeleton from "./_components/OrderListLoadingSkeleton";
import type { FxPendingOrder } from "./_components/FxReconciliationModal";

type OrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildListUrl(
  basePath: string,
  rawParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (key === "page" || value == null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }
    params.set(key, value);
  });
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export async function generateMetadata({ params }: OrdersPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "orderListing",
    pathSegment: "orders",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  });
}

export default async function OrdersPage({ params, searchParams }: OrdersPageProps) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);
  const rawParams = await searchParams;
  // Suspense key forces the async data-fetching subtree to remount on every URL params
  // change, surfacing `<OrderListLoadingSkeleton>` between navigations.
  const fingerprint = JSON.stringify(rawParams);

  return (
    <Suspense key={fingerprint} fallback={<OrdersListFallback locale={locale} />}>
      <OrdersListView locale={locale} userId={session.user.id} rawParams={rawParams} />
    </Suspense>
  );
}

async function OrdersListFallback({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "orderListing" });
  return <OrderListLoadingSkeleton title={t("hero.title")} />;
}

async function OrdersListView({
  locale,
  userId,
  rawParams,
}: {
  locale: string;
  userId: string;
  rawParams: Record<string, string | string[] | undefined>;
}) {
  const parsed = parseOrderListingParams(rawParams);
  const basePath = `/${locale}${ROUTES.orders}`;
  const dateFromIso = parsed.dateFrom ? parsed.dateFrom.toISOString().slice(0, 10) : undefined;
  const dateToIso = parsed.dateTo ? parsed.dateTo.toISOString().slice(0, 10) : undefined;
  const deliveryFromIso = parsed.deliveryFrom ? parsed.deliveryFrom.toISOString().slice(0, 10) : undefined;
  const deliveryToIso = parsed.deliveryTo ? parsed.deliveryTo.toISOString().slice(0, 10) : undefined;

  const activeFilters: OrderListActiveFilters = {
    nameQuery: parsed.nameQuery,
    productTypeKeys: parsed.productTypeKeys,
    storeId: parsed.storeId,
    statuses: parsed.statuses,
    paymentStates: parsed.paymentStates,
    fxPendingOnly: parsed.fxPendingOnly,
    sort: parsed.sort,
    appliedDefaultStatuses: parsed.appliedDefaultStatuses,
    dateFromIso,
    dateToIso,
    deliveryFromIso,
    deliveryToIso,
    deliveryOverdueOnly: parsed.deliveryOverdueOnly,
  };

  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { baseCurrencyCode: true },
  });
  const baseCurrencyCode = userRow?.baseCurrencyCode ?? null;

  const [listing, storeOptions, t, closedCount] = await Promise.all([
    getOrdersList(userId, {
      nameQuery: parsed.nameQuery,
      productTypeKeys: parsed.productTypeKeys.length > 0 ? parsed.productTypeKeys : undefined,
      storeId: parsed.storeId,
      statuses: parsed.statuses.length > 0 ? parsed.statuses : undefined,
      paymentStates: parsed.paymentStates.length > 0 ? parsed.paymentStates : undefined,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      deliveryFrom: parsed.deliveryFrom,
      deliveryTo: parsed.deliveryTo,
      deliveryOverdueOnly: parsed.deliveryOverdueOnly,
      fxPendingOnly: parsed.fxPendingOnly,
      baseCurrencyCode,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: ORDER_LIST_PAGE_SIZE,
    }),
    getOrderableStores(),
    getTranslations({ locale, namespace: "orderListing" }),
    prisma.order.count({ where: { userId, status: { in: ["COMPLETED", "CANCELLED"] } } }),
  ]);

  const today = new Date();
  const currentListUrl = buildListUrl(basePath, rawParams, listing.page);
  // "Limpiar filtros" lands on the bare /orders URL: no filter at all. Sidebar/burger nav
  // is the only entry point that pre-selects "Solo activas".
  const resetHref = basePath;

  const storesById: Record<string, string> = {};
  storeOptions.forEach((store) => {
    storesById[store.id] = store.name;
  });

  const buildPaginationHref = (targetPage: number) => buildListUrl(basePath, rawParams, targetPage);
  const totalAcrossUser = await prisma.order.count({ where: { userId } });
  const activeCount = Math.max(0, totalAcrossUser - closedCount);
  const hasAnyFilter =
    Boolean(parsed.nameQuery) ||
    parsed.productTypeKeys.length > 0 ||
    Boolean(parsed.storeId) ||
    parsed.statuses.length > 0 ||
    parsed.paymentStates.length > 0 ||
    parsed.fxPendingOnly ||
    Boolean(parsed.dateFrom) ||
    Boolean(parsed.dateTo) ||
    Boolean(parsed.deliveryFrom) ||
    Boolean(parsed.deliveryTo) ||
    parsed.deliveryOverdueOnly ||
    parsed.sort !== DEFAULT_ORDER_LIST_SORT;

  const fxPendingOrders: FxPendingOrder[] =
    listing.pendingFxCount > 0 && baseCurrencyCode
      ? await prisma.order
          .findMany({
            where: {
              userId,
              status: { not: "CANCELLED" },
              orderDate: { gte: startOfMonth(today) },
              currencyCode: { not: baseCurrencyCode },
            },
            select: { id: true, humanReadableId: true, totalCost: true, currencyCode: true },
            orderBy: { orderDate: "desc" },
            take: 500,
          })
          .then((rows) =>
            rows.map((row) => ({
              id: row.id,
              humanReadableId: row.humanReadableId,
              totalCost: row.totalCost,
              currencyCode: row.currencyCode,
            })),
          )
      : [];

  return (
    <div className="text-foreground">
      <div className="space-y-5">
        {/* Desktop page-heading; mobile gets title from app-topbar */}
        <div className="hidden flex-wrap items-baseline gap-2.5 lg:flex">
          <h1 className="[font-size:var(--text-display)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {t("hero.title")}
          </h1>
          <span className="[font-size:var(--text-caption)] [color:var(--text-muted)] tabular-nums">
            {listing.totalCount === 0 && hasAnyFilter
              ? t("heading.zeroResults")
              : t("heading.meta", { active: activeCount, closed: closedCount })}
          </span>
        </div>

        <OrderListFilters
          locale={locale}
          storeOptions={storeOptions.map((store) => ({ id: store.id, name: store.name }))}
          initial={activeFilters}
        />

        <OrderListFilterChips locale={locale} basePath={basePath} filters={activeFilters} storesById={storesById} />

        <FxAnnouncer count={listing.pendingFxCount} baseCurrencyCode={baseCurrencyCode} orders={fxPendingOrders} />

        <OrderListContent
          locale={locale}
          orders={listing.orders}
          totalCount={listing.totalCount}
          hasActiveFiltersBeyondDefault={hasAnyFilter}
          today={today}
          returnTo={currentListUrl}
          resetHref={resetHref}
        />

        <OrderListPagination
          locale={locale}
          totalPages={listing.totalPages}
          currentPage={listing.page}
          totalCount={listing.totalCount}
          pageSize={listing.pageSize}
          createPageHref={buildPaginationHref}
        />
      </div>
    </div>
  );
}

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
