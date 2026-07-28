import { getTranslations } from "next-intl/server";
import ListPagination from "@/components/modules/ListPagination";
import PaginationLink from "./PaginationLink";
import StorePerPageSelect from "./StorePerPageSelect";

type StoreListingPaginationProps = {
  locale: string;
  totalPages: number;
  currentPage: number;
  totalCount: number;
  pageSize: number;
  createPageHref: (page: number) => string;
  buildPerPageHref: (size: number) => string;
};

/**
 * Thin translation + summary-math wrapper around the shared `ListPagination` (canonical L062
 * desktop row, mirrors `OrderListPagination`/`DeliveryListPagination`). `LinkComponent` and
 * `PerPageSelectComponent` are overridden with the stores transition-aware variants so page and
 * page-size changes keep routing through the same `useTransition`-backed skeleton as filters/sort.
 */
export default async function StoreListingPagination({
  locale,
  totalPages,
  currentPage,
  totalCount,
  pageSize,
  createPageHref,
  buildPerPageHref,
}: StoreListingPaginationProps) {
  if (totalCount === 0) return null;

  const t = await getTranslations({ locale, namespace: "storeListing" });
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return (
    <ListPagination
      totalPages={totalPages}
      currentPage={currentPage}
      totalCount={totalCount}
      createPageHref={createPageHref}
      labels={{
        showing: t("pagination.showing", { start, end, total: totalCount }),
        loadMore: t("pagination.loadMore"),
        navigationAriaLabel: t("pagination.navigationAriaLabel"),
        previous: t("pagination.previous"),
        next: t("pagination.next"),
        goToPage: (page) => t("pagination.goToPageAriaLabel", { page }),
      }}
      perPage={pageSize}
      buildPerPageHref={buildPerPageHref}
      perPageLabel={t("pagination.perPage")}
      LinkComponent={PaginationLink}
      PerPageSelectComponent={StorePerPageSelect}
    />
  );
}
