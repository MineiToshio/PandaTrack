import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { prisma } from "@/lib/prisma";
import { getDeliveriesList, getDeliveryStoreOptions } from "@/lib/data/deliveries/deliveryQueries";
import { domainDateToIsoString } from "@/lib/domainDate";
import { DEFAULT_PAGE_SIZE, POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  DEFAULT_DELIVERY_STATUS,
  parseDeliveryListingParams,
  type DeliveryListActiveFilters,
} from "./_utils/deliveryListingParams";
import DeliveryListContent from "./_components/DeliveryListContent";
import DeliveryListFilters from "./_components/DeliveryListFilters";
import DeliveryListFilterChips from "./_components/DeliveryListFilterChips";
import DeliveryListPagination from "./_components/DeliveryListPagination";
import DeliveryListLoadingSkeleton from "./_components/DeliveryListLoadingSkeleton";
import { ListExpandAllToggle, ListExpansionProvider } from "@/hooks/useListExpansion";

/** Wires the shared expand/collapse-all state to the deliveries list's analytics events. */
const DELIVERY_EXPANSION_EVENTS = {
  cardExpanded: POSTHOG_EVENTS.DELIVERY.LIST_CARD_EXPANDED,
  cardCollapsed: POSTHOG_EVENTS.DELIVERY.LIST_CARD_COLLAPSED,
  expandedAll: POSTHOG_EVENTS.DELIVERY.LIST_EXPANDED_ALL,
  collapsedAll: POSTHOG_EVENTS.DELIVERY.LIST_COLLAPSED_ALL,
  idProp: "delivery_id",
};

type DeliveriesPageProps = {
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

function buildActiveFilters(parsed: ReturnType<typeof parseDeliveryListingParams>): DeliveryListActiveFilters {
  return {
    nameQuery: parsed.nameQuery,
    statuses: parsed.statuses,
    overdueOnly: parsed.overdueOnly,
    arrivalFromIso: domainDateToIsoString(parsed.arrivalFrom),
    arrivalToIso: domainDateToIsoString(parsed.arrivalTo),
    storeId: parsed.storeId,
    productQuery: parsed.productQuery,
    shippedFromIso: domainDateToIsoString(parsed.shippedFrom),
    shippedToIso: domainDateToIsoString(parsed.shippedTo),
    sort: parsed.sort,
    perPage: parsed.perPage,
  };
}

function hasActiveFilter(parsed: ReturnType<typeof parseDeliveryListingParams>): boolean {
  return (
    Boolean(parsed.nameQuery) ||
    parsed.statuses.length > 0 ||
    parsed.overdueOnly ||
    Boolean(parsed.arrivalFrom) ||
    Boolean(parsed.arrivalTo) ||
    Boolean(parsed.storeId) ||
    Boolean(parsed.productQuery) ||
    Boolean(parsed.shippedFrom) ||
    Boolean(parsed.shippedTo)
  );
}

export async function generateMetadata({ params }: DeliveriesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    locale,
    namespace: "deliveries",
    pathSegment: "deliveries",
    titleKey: "list.title",
    descriptionKey: "list.description",
  });
}

export default async function DeliveriesPage({ params, searchParams }: DeliveriesPageProps) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);
  const userId = session.user.id;
  const rawParams = await searchParams;
  const basePath = `/${locale}${ROUTES.deliveries}`;

  // Canonical default (BP-01): a bare URL (no `status` key) redirects to the "En camino" view.
  if (rawParams.status === undefined) {
    const canonicalParams = new URLSearchParams();
    Object.entries(rawParams).forEach(([key, value]) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach((item) => canonicalParams.append(key, item));
        return;
      }
      canonicalParams.set(key, value);
    });
    canonicalParams.set("status", DEFAULT_DELIVERY_STATUS);
    redirect(`${basePath}?${canonicalParams.toString()}`);
  }

  const parsed = parseDeliveryListingParams(rawParams);
  const activeFilters = buildActiveFilters(parsed);
  const fingerprint = JSON.stringify(rawParams);
  const resetHref = `${basePath}?status=`;

  // Chrome data only (no heavy list query): store options feed the filter drawer + chips.
  const [storeOptions, t, tc] = await Promise.all([
    getDeliveryStoreOptions(userId),
    getTranslations({ locale, namespace: "deliveries" }),
    getTranslations({ locale, namespace: "components" }),
  ]);
  const storesById: Record<string, string> = {};
  storeOptions.forEach((store) => {
    storesById[store.storeId] = store.storeName;
  });

  return (
    <div className="text-foreground">
      <div className="space-y-5">
        {/* Chrome — renders instantly. Only the counter (data) is a skeleton; the title is real. */}
        <div className="hidden flex-wrap items-baseline gap-2.5 lg:flex">
          <h1 className="[font-size:var(--text-display)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {t("list.title")}
          </h1>
          <Suspense
            fallback={
              <span
                className="skeleton rounded-[6px]"
                style={{ width: 140, height: 16, display: "inline-block" }}
                aria-hidden
              />
            }
          >
            <DeliveriesHeadingCount locale={locale} userId={userId} />
          </Suspense>
        </div>

        <DeliveryListFilters
          locale={locale}
          storeOptions={storeOptions.map((store) => ({ id: store.storeId, name: store.storeName }))}
          initial={activeFilters}
        />

        {/* Filter chips + expand/collapse-all share one row (chips left, toggle pinned right). The
            provider wraps this row and the data Suspense so the toggle — outside the boundary —
            stays flicker-free while the list re-suspends. `empty:hidden` drops the row when there
            are neither chips nor a toggle. */}
        <ListExpansionProvider events={DELIVERY_EXPANSION_EVENTS}>
          <div className="flex items-center gap-3 empty:hidden">
            <DeliveryListFilterChips
              locale={locale}
              basePath={basePath}
              filters={activeFilters}
              storesById={storesById}
            />
            <ListExpandAllToggle className="ml-auto shrink-0" />
          </div>

          {/* Data region — only this suspends, with a layout-matching (table desktop / cards mobile) skeleton. */}
          <Suspense
            key={fingerprint}
            fallback={
              <DeliveryListLoadingSkeleton
                loadingLabel={tc("skeleton.loading")}
                headers={{
                  delivery: t("list.table.headerDelivery"),
                  products: t("list.table.headerProducts"),
                  status: t("list.table.headerStatus"),
                  cost: t("list.table.headerCost"),
                  arrival: t("list.table.headerArrival"),
                }}
              />
            }
          >
            <DeliveriesTableSection
              locale={locale}
              userId={userId}
              parsed={parsed}
              rawParams={rawParams}
              basePath={basePath}
              resetHref={resetHref}
            />
          </Suspense>
        </ListExpansionProvider>
      </div>
    </div>
  );
}

/** Global delivery counts for the heading meta. Suspended (Sergio: the counter is a skeleton). */
async function DeliveriesHeadingCount({ locale, userId }: { locale: string; userId: string }) {
  const [t, inTransitCount, deliveredCount] = await Promise.all([
    getTranslations({ locale, namespace: "deliveries" }),
    prisma.delivery.count({ where: { userId, status: "IN_TRANSIT" } }),
    prisma.delivery.count({ where: { userId, status: "DELIVERED" } }),
  ]);
  return (
    <span className="[font-size:var(--text-caption)] [color:var(--text-muted)] tabular-nums">
      {t("list.heading.meta", { inTransit: inTransitCount, delivered: deliveredCount })}
    </span>
  );
}

/** Heavy list query + table/cards + pagination. The only part that suspends on filter changes. */
async function DeliveriesTableSection({
  locale,
  userId,
  parsed,
  rawParams,
  basePath,
  resetHref,
}: {
  locale: string;
  userId: string;
  parsed: ReturnType<typeof parseDeliveryListingParams>;
  rawParams: Record<string, string | string[] | undefined>;
  basePath: string;
  resetHref: string;
}) {
  const listing = await getDeliveriesList(userId, {
    nameQuery: parsed.nameQuery,
    statuses: parsed.statuses.length > 0 ? parsed.statuses : undefined,
    storeId: parsed.storeId,
    productQuery: parsed.productQuery,
    overdueOnly: parsed.overdueOnly,
    arrivalFrom: parsed.arrivalFrom,
    arrivalTo: parsed.arrivalTo,
    shippedFrom: parsed.shippedFrom,
    shippedTo: parsed.shippedTo,
    sort: parsed.sort,
    page: parsed.page,
    pageSize: parsed.perPage,
  });

  const today = new Date();
  const currentListUrl = buildListUrl(basePath, rawParams, listing.page);
  const buildPaginationHref = (targetPage: number) => buildListUrl(basePath, rawParams, targetPage);
  const buildPerPageHref = (size: number) => buildPerPageUrl(basePath, rawParams, size);

  return (
    <>
      <DeliveryListContent
        locale={locale}
        deliveries={listing.deliveries}
        totalCount={listing.totalCount}
        hasAnyFilter={hasActiveFilter(parsed)}
        searchTerm={parsed.nameQuery}
        today={today}
        returnTo={currentListUrl}
        resetHref={resetHref}
      />

      <DeliveryListPagination
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
