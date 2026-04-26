import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/auth/auth-server";
import { prisma } from "@/lib/prisma";
import { getOrdersList } from "@/lib/data/orders/orderQueries";
import { getUserStores } from "@/lib/data/stores/storeQueries";
import { listActiveStoreProductTypeKeys } from "@/queries/storeProductType";
import AppPageHero from "@/components/modules/AppPageHero";
import { APP_SHELL_FORM_RAIL_CLASSNAME, ROUTES } from "@/lib/constants";
import {
  buildOrderListFilterUrl,
  hasOnlyDefaultActiveFilters,
  ORDER_LIST_PAGE_SIZE,
  parseOrderListingParams,
} from "./_utils/orderListingParams";
import OrderListContent from "./_components/OrderListContent";
import OrderListFilters from "./_components/OrderListFilters";
import OrderListFilterChips from "./_components/OrderListFilterChips";
import OrderListPagination from "./_components/OrderListPagination";

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
  const userId = session.user.id;

  const rawParams = await searchParams;
  const parsed = parseOrderListingParams(rawParams);
  const basePath = `/${locale}${ROUTES.orders}`;
  const dateFromIso = parsed.dateFrom ? parsed.dateFrom.toISOString().slice(0, 10) : undefined;
  const dateToIso = parsed.dateTo ? parsed.dateTo.toISOString().slice(0, 10) : undefined;
  const activeFilters = {
    nameQuery: parsed.nameQuery,
    productTypeKeys: parsed.productTypeKeys,
    storeId: parsed.storeId,
    statuses: parsed.statuses,
    appliedDefaultStatuses: false,
    dateFromIso,
    dateToIso,
  };

  if (parsed.appliedDefaultStatuses) {
    redirect(
      buildOrderListFilterUrl(basePath, activeFilters, {
        appliedDefaultStatuses: false,
        page: parsed.page,
      }),
    );
  }

  const [listing, storeOptions, productTypeOptions, t] = await Promise.all([
    getOrdersList(userId, {
      nameQuery: parsed.nameQuery,
      productTypeKeys: parsed.productTypeKeys.length > 0 ? parsed.productTypeKeys : undefined,
      storeId: parsed.storeId,
      statuses: parsed.statuses.length > 0 ? parsed.statuses : undefined,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      page: parsed.page,
      pageSize: ORDER_LIST_PAGE_SIZE,
    }),
    getUserStores(userId),
    listActiveStoreProductTypeKeys(prisma),
    getTranslations({ locale, namespace: "orderListing" }),
  ]);

  const today = new Date();
  const showingFrom = listing.totalCount === 0 ? 0 : (listing.page - 1) * listing.pageSize + 1;
  const showingTo = Math.min(listing.page * listing.pageSize, listing.totalCount);
  const currentListUrl = buildListUrl(basePath, rawParams, listing.page);

  const storesById: Record<string, string> = {};
  storeOptions.forEach((store) => {
    storesById[store.id] = store.name;
  });

  const buildPaginationHref = (targetPage: number) => buildListUrl(basePath, rawParams, targetPage);

  const hasActiveFiltersBeyondDefault = !hasOnlyDefaultActiveFilters(activeFilters);

  return (
    <div className="text-foreground">
      <div className={`${APP_SHELL_FORM_RAIL_CLASSNAME} space-y-6`}>
        <AppPageHero eyebrow={t("hero.eyebrow")} title={t("hero.title")} description={t("hero.description")} />

        <OrderListFilters
          locale={locale}
          totalCount={listing.totalCount}
          showingFrom={showingFrom}
          showingTo={showingTo}
          storeOptions={storeOptions.map((store) => ({ id: store.id, name: store.name }))}
          productTypeOptions={productTypeOptions}
          initial={{
            nameQuery: parsed.nameQuery ?? "",
            storeId: parsed.storeId ?? "",
            productTypeKeys: parsed.productTypeKeys,
            statuses: parsed.statuses,
            appliedDefaultStatuses: parsed.appliedDefaultStatuses,
            dateFromIso,
            dateToIso,
          }}
        />

        <OrderListFilterChips
          locale={locale}
          basePath={basePath}
          filters={activeFilters}
          storesById={storesById}
        />

        <OrderListContent
          locale={locale}
          orders={listing.orders}
          totalCount={listing.totalCount}
          hasActiveFiltersBeyondDefault={hasActiveFiltersBeyondDefault}
          today={today}
          returnTo={currentListUrl}
        />

        <OrderListPagination
          locale={locale}
          totalPages={listing.totalPages}
          currentPage={listing.page}
          createPageHref={buildPaginationHref}
        />
      </div>
    </div>
  );
}
