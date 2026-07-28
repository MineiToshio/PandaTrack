import { getTranslations } from "next-intl/server";
import ListPagination from "@/components/modules/ListPagination";

type OrderListPaginationProps = {
  locale: string;
  totalPages: number;
  currentPage: number;
  totalCount: number;
  pageSize: number;
  createPageHref: (page: number) => string;
  buildPerPageHref: (size: number) => string;
};

export default async function OrderListPagination({
  locale,
  totalPages,
  currentPage,
  totalCount,
  pageSize,
  createPageHref,
  buildPerPageHref,
}: OrderListPaginationProps) {
  if (totalCount === 0) return null;

  const t = await getTranslations({ locale, namespace: "orderListing" });
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
    />
  );
}
