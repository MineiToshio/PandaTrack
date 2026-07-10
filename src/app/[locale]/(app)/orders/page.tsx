import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { domainDateToIsoString } from "@/lib/domainDate";
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

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function buildActiveFilters(parsed: ReturnType<typeof parseOrderListingParams>): OrderListActiveFilters {
  return {
    nameQuery: parsed.nameQuery,
    productTypeKeys: parsed.productTypeKeys,
    storeId: parsed.storeId,
    statuses: parsed.statuses,
    paymentStates: parsed.paymentStates,
    fxPendingOnly: parsed.fxPendingOnly,
    sort: parsed.sort,
    appliedDefaultStatuses: parsed.appliedDefaultStatuses,
    dateFromIso: domainDateToIsoString(parsed.dateFrom),
    dateToIso: domainDateToIsoString(parsed.dateTo),
    deliveryFromIso: domainDateToIsoString(parsed.deliveryFrom),
    deliveryToIso: domainDateToIsoString(parsed.deliveryTo),
    deliveryOverdueOnly: parsed.deliveryOverdueOnly,
  };
}

function hasActiveFilter(parsed: ReturnType<typeof parseOrderListingParams>): boolean {
  return (
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
    parsed.sort !== DEFAULT_ORDER_LIST_SORT
  );
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
  const userId = session.user.id;
  const rawParams = await searchParams;
  const basePath = `/${locale}${ROUTES.orders}`;
  const fingerprint = JSON.stringify(rawParams);

  const parsed = parseOrderListingParams(rawParams);
  const activeFilters = buildActiveFilters(parsed);
  // "Limpiar filtros" lands on the bare /orders URL: no filter at all.
  const resetHref = basePath;

  // Chrome data only (no heavy list query): store options feed the filter drawer + chips.
  const [storeOptions, t, tc] = await Promise.all([
    getOrderableStores(),
    getTranslations({ locale, namespace: "orderListing" }),
    getTranslations({ locale, namespace: "components" }),
  ]);
  const storesById: Record<string, string> = {};
  storeOptions.forEach((store) => {
    storesById[store.id] = store.name;
  });

  return (
    <div className="text-foreground">
      <div className="space-y-5">
        {/* Chrome — renders instantly. Only the counter (data) is a skeleton; the title is real. */}
        <div className="hidden flex-wrap items-baseline gap-2.5 lg:flex">
          <h1 className="[font-size:var(--text-display)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {t("hero.title")}
          </h1>
          <Suspense
            fallback={
              <span
                className="skeleton rounded-[6px]"
                style={{ width: 120, height: 16, display: "inline-block" }}
                aria-hidden
              />
            }
          >
            <OrdersHeadingCount locale={locale} userId={userId} />
          </Suspense>
        </div>

        <OrderListFilters
          locale={locale}
          storeOptions={storeOptions.map((store) => ({ id: store.id, name: store.name }))}
          initial={activeFilters}
        />

        <OrderListFilterChips locale={locale} basePath={basePath} filters={activeFilters} storesById={storesById} />

        {/* Data region — only this suspends, with a layout-matching (table desktop / cards mobile) skeleton. */}
        <Suspense
          key={fingerprint}
          fallback={
            <OrderListLoadingSkeleton
              loadingLabel={tc("skeleton.loading")}
              headerOrder={t("table.headerOrder")}
              headerProducts={t("table.headerProducts")}
              headerStatus={t("table.headerStatus")}
              headerTotal={t("table.headerTotal")}
              headerProgress={t("table.headerProgress")}
            />
          }
        >
          <OrdersDataSection
            locale={locale}
            userId={userId}
            parsed={parsed}
            rawParams={rawParams}
            basePath={basePath}
            resetHref={resetHref}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** Global active/closed order counts for the heading meta. Suspended (the counter is a skeleton). */
async function OrdersHeadingCount({ locale, userId }: { locale: string; userId: string }) {
  const [t, totalAcrossUser, closedCount] = await Promise.all([
    getTranslations({ locale, namespace: "orderListing" }),
    prisma.order.count({ where: { userId } }),
    prisma.order.count({ where: { userId, status: { in: ["COMPLETED", "CANCELLED"] } } }),
  ]);
  const activeCount = Math.max(0, totalAcrossUser - closedCount);
  return (
    <span className="[font-size:var(--text-caption)] [color:var(--text-muted)] tabular-nums">
      {t("heading.meta", { active: activeCount, closed: closedCount })}
    </span>
  );
}

/** Heavy list query + FX reconciliation + table/cards + pagination. The only part that suspends. */
async function OrdersDataSection({
  locale,
  userId,
  parsed,
  rawParams,
  basePath,
  resetHref,
}: {
  locale: string;
  userId: string;
  parsed: ReturnType<typeof parseOrderListingParams>;
  rawParams: Record<string, string | string[] | undefined>;
  basePath: string;
  resetHref: string;
}) {
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { baseCurrencyCode: true },
  });
  const baseCurrencyCode = userRow?.baseCurrencyCode ?? null;

  const listing = await getOrdersList(userId, {
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
  });

  const today = new Date();
  const currentListUrl = buildListUrl(basePath, rawParams, listing.page);
  const buildPaginationHref = (targetPage: number) => buildListUrl(basePath, rawParams, targetPage);

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
    <>
      <FxAnnouncer count={listing.pendingFxCount} baseCurrencyCode={baseCurrencyCode} orders={fxPendingOrders} />

      <OrderListContent
        locale={locale}
        orders={listing.orders}
        totalCount={listing.totalCount}
        hasActiveFiltersBeyondDefault={hasActiveFilter(parsed)}
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
    </>
  );
}
