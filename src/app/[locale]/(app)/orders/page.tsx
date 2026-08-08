import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Store as StoreIcon } from "lucide-react";
import { buildPageMetadata } from "@/lib/seo";
import { domainDateToIsoString } from "@/lib/domainDate";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import {
  getOrdersHeadingCounts,
  getOrderStoreOptions,
  getOrdersList,
  listOrdersPendingFxReconciliation,
} from "@/lib/data/orders/orderQueries";
import { getPendingProductsByStore } from "@/lib/data/orders/pendingProductsByStoreQueries";
import { getImageIntakeQuotaSnapshotCached } from "@/lib/data/imageIntake/imageIntakeQuotaQueries";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { DEFAULT_PAGE_SIZE, ORDER_LIST_VIEW_COOKIE_NAME, POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { DEFAULT_STORE_VIEW_SORT, parseStoreViewSort, sortStoreGroups } from "@/lib/orders/storeViewSort";
import {
  DEFAULT_ORDER_LIST_SORT,
  parseOrderListingParams,
  resolveOrderListView,
  type OrderListActiveFilters,
} from "./_utils/orderListingParams";
import OrderListContent from "./_components/OrderListContent";
import OrderListFilters from "./_components/OrderListFilters";
import OrderListFilterChips from "./_components/OrderListFilterChips";
import OrderListPagination from "./_components/OrderListPagination";
import FxAnnouncer from "./_components/FxAnnouncer";
import OrderListLoadingSkeleton from "./_components/OrderListLoadingSkeleton";
import StoreGroupedView from "./_components/StoreGroupedView";
import StoreGroupedViewLoadingSkeleton from "./_components/StoreGroupedViewLoadingSkeleton";
import EmptyState from "@/components/modules/EmptyState";
import type { FxPendingOrder } from "./_components/FxReconciliationModal";
import { ListExpandAllToggle, ListExpansionProvider } from "@/hooks/useListExpansion";

/** Wires the shared expand/collapse-all state to the orders list's analytics events. */
const ORDER_EXPANSION_EVENTS = {
  cardExpanded: POSTHOG_EVENTS.ORDER.LIST_CARD_EXPANDED,
  cardCollapsed: POSTHOG_EVENTS.ORDER.LIST_CARD_COLLAPSED,
  expandedAll: POSTHOG_EVENTS.ORDER.LIST_EXPANDED_ALL,
  collapsedAll: POSTHOG_EVENTS.ORDER.LIST_COLLAPSED_ALL,
  idProp: "order_id",
};

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

/** Changing the page size always resets to page 1; only a non-default size is kept in the URL. */
function buildPerPageUrl(
  basePath: string,
  rawParams: Record<string, string | string[] | undefined>,
  perPageSize: number,
): string {
  const params = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (key === "page" || key === "perPage" || value == null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }
    params.set(key, value);
  });
  if (perPageSize !== DEFAULT_PAGE_SIZE) params.set("perPage", String(perPageSize));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function buildActiveFilters(parsed: ReturnType<typeof parseOrderListingParams>): OrderListActiveFilters {
  return {
    nameQuery: parsed.nameQuery,
    productTypeKeys: parsed.productTypeKeys,
    storeId: parsed.storeId,
    statuses: parsed.statuses,
    fxPendingOnly: parsed.fxPendingOnly,
    sort: parsed.sort,
    appliedDefaultStatuses: parsed.appliedDefaultStatuses,
    dateFromIso: domainDateToIsoString(parsed.dateFrom),
    dateToIso: domainDateToIsoString(parsed.dateTo),
    deliveryFromIso: domainDateToIsoString(parsed.deliveryFrom),
    deliveryToIso: domainDateToIsoString(parsed.deliveryTo),
    deliveryOverdueOnly: parsed.deliveryOverdueOnly,
    deliveryLateOnly: parsed.deliveryLateOnly,
    perPage: parsed.perPage,
  };
}

function hasActiveFilter(parsed: ReturnType<typeof parseOrderListingParams>): boolean {
  return (
    Boolean(parsed.nameQuery) ||
    parsed.productTypeKeys.length > 0 ||
    Boolean(parsed.storeId) ||
    parsed.statuses.length > 0 ||
    parsed.fxPendingOnly ||
    Boolean(parsed.dateFrom) ||
    Boolean(parsed.dateTo) ||
    Boolean(parsed.deliveryFrom) ||
    Boolean(parsed.deliveryTo) ||
    parsed.deliveryOverdueOnly ||
    parsed.deliveryLateOnly ||
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
  // Desktop toolbar entry point: the same selector the shell's floating button opens, so it shows
  // the same balance. Memoized per request, so this does not read the roll-up a second time.
  const photoCounter = await getImageIntakeQuotaSnapshotCached(userId, getIsAdmin(session));
  const rawParams = await searchParams;
  const basePath = `/${locale}${ROUTES.orders}`;
  const fingerprint = JSON.stringify(rawParams);

  const parsed = parseOrderListingParams(rawParams);
  const activeFilters = buildActiveFilters(parsed);
  // "Limpiar filtros" lands on the bare /orders URL: no filter at all.
  const resetHref = basePath;

  // View mode: URL-first, then the collector's last choice (cookie, read server-side so the
  // default renders with no client flash), then "order". Store view's own sort domain shares the
  // ?sort= param but is parsed separately (its default is "arrival-asc", not "recent").
  const cookieStore = await cookies();
  const view = resolveOrderListView(rawParams.view, cookieStore.get(ORDER_LIST_VIEW_COOKIE_NAME)?.value);
  const storeSort = parseStoreViewSort(rawParams.sort);

  // Chrome data only (no heavy list query): store options feed the filter drawer + chips.
  const [storeOptions, t, tc] = await Promise.all([
    getOrderStoreOptions(userId),
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
          photoCounter={photoCounter}
          storeOptions={storeOptions.map((store) => ({ id: store.id, name: store.name }))}
          initial={activeFilters}
          view={view}
          storeSort={storeSort}
        />

        {/* Filter chips + expand/collapse-all share one row (chips left, toggle pinned right). The
            provider wraps this row and the data Suspense so the toggle — outside the boundary —
            stays flicker-free while the list re-suspends. `empty:hidden` drops the row when there
            are neither chips nor a toggle. Store view has no filters to chip and reuses none of
            the classic list's expand/collapse-all (its own groups collapse independently), so this
            whole row is order-view only. */}
        <ListExpansionProvider events={ORDER_EXPANSION_EVENTS}>
          {view === "order" && (
            <div className="flex items-center gap-3 empty:hidden">
              <OrderListFilterChips
                locale={locale}
                basePath={basePath}
                filters={activeFilters}
                storesById={storesById}
              />
              <ListExpandAllToggle className="ml-auto shrink-0" />
            </div>
          )}

          {/* Data region — only this suspends, with a layout-matching skeleton per view. */}
          <Suspense
            key={`${view}:${fingerprint}`}
            fallback={
              view === "store" ? (
                <StoreGroupedViewLoadingSkeleton loadingLabel={tc("skeleton.loading")} />
              ) : (
                <OrderListLoadingSkeleton
                  loadingLabel={tc("skeleton.loading")}
                  headerOrder={t("table.headerOrder")}
                  headerProducts={t("table.headerProducts")}
                  headerStatus={t("table.headerStatus")}
                  headerTotal={t("table.headerTotal")}
                />
              )
            }
          >
            {view === "store" ? (
              <StoreViewDataSection locale={locale} userId={userId} storeSort={storeSort} basePath={basePath} />
            ) : (
              <OrdersDataSection
                locale={locale}
                userId={userId}
                parsed={parsed}
                rawParams={rawParams}
                basePath={basePath}
                resetHref={resetHref}
              />
            )}
          </Suspense>
        </ListExpansionProvider>
      </div>
    </div>
  );
}

/** Global active/closed order counts for the heading meta. Suspended (the counter is a skeleton). */
async function OrdersHeadingCount({ locale, userId }: { locale: string; userId: string }) {
  const [t, { activeCount, closedCount }] = await Promise.all([
    getTranslations({ locale, namespace: "orderListing" }),
    getOrdersHeadingCounts(userId),
  ]);
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
  const preferences = await getCollectorPreferencesSnapshot(userId);
  const baseCurrencyCode = preferences?.baseCurrencyCode ?? null;

  const listing = await getOrdersList(userId, {
    nameQuery: parsed.nameQuery,
    productTypeKeys: parsed.productTypeKeys.length > 0 ? parsed.productTypeKeys : undefined,
    storeId: parsed.storeId,
    statuses: parsed.statuses.length > 0 ? parsed.statuses : undefined,
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
    deliveryFrom: parsed.deliveryFrom,
    deliveryTo: parsed.deliveryTo,
    deliveryOverdueOnly: parsed.deliveryOverdueOnly,
    deliveryLateOnly: parsed.deliveryLateOnly,
    fxPendingOnly: parsed.fxPendingOnly,
    baseCurrencyCode,
    sort: parsed.sort,
    page: parsed.page,
    pageSize: parsed.perPage,
  });

  const today = new Date();
  const currentListUrl = buildListUrl(basePath, rawParams, listing.page);
  const buildPaginationHref = (targetPage: number) => buildListUrl(basePath, rawParams, targetPage);
  const buildPerPageHref = (size: number) => buildPerPageUrl(basePath, rawParams, size);

  const fxPendingOrders: FxPendingOrder[] =
    listing.pendingFxCount > 0 && baseCurrencyCode
      ? await listOrdersPendingFxReconciliation(userId, baseCurrencyCode)
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
        baseCurrencyCode={baseCurrencyCode}
      />

      <OrderListPagination
        locale={locale}
        totalPages={listing.totalPages}
        currentPage={listing.page}
        totalCount={listing.totalCount}
        pageSize={listing.pageSize}
        createPageHref={buildPaginationHref}
        buildPerPageHref={buildPerPageHref}
      />
    </>
  );
}

/**
 * "Por tienda" view data: every pending product across every store, grouped and two-level sorted.
 * Not paginated (see `getPendingProductsByStore`), so this is the whole list in one query.
 */
async function StoreViewDataSection({
  locale,
  userId,
  storeSort,
  basePath,
}: {
  locale: string;
  userId: string;
  storeSort: ReturnType<typeof parseStoreViewSort>;
  basePath: string;
}) {
  const [groupsRaw, t] = await Promise.all([
    getPendingProductsByStore(userId),
    getTranslations({ locale, namespace: "orderListing" }),
  ]);

  if (groupsRaw.length === 0) {
    return (
      <EmptyState
        appearance="card"
        headingAs="h2"
        icon={<StoreIcon width={28} height={28} />}
        iconTone="accent"
        title={t("storeView.empty.title")}
        subtitle={t("storeView.empty.description")}
      />
    );
  }

  const groups = sortStoreGroups(groupsRaw, storeSort);
  const sortParam = storeSort === DEFAULT_STORE_VIEW_SORT ? undefined : storeSort;
  const returnTo = `${basePath}?view=store${sortParam ? `&sort=${sortParam}` : ""}`;

  return <StoreGroupedView groups={groups} locale={locale} returnTo={returnTo} />;
}
