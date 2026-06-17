import { getTranslations } from "next-intl/server";
import ListPagination from "@/components/modules/ListPagination";

type DeliveryListPaginationProps = {
  locale: string;
  totalPages: number;
  currentPage: number;
  totalCount: number;
  pageSize: number;
  createPageHref: (page: number) => string;
};

export default async function DeliveryListPagination({
  locale,
  totalPages,
  currentPage,
  totalCount,
  pageSize,
  createPageHref,
}: DeliveryListPaginationProps) {
  if (totalCount === 0) return null;

  const t = await getTranslations({ locale, namespace: "deliveries" });
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return (
    <ListPagination
      totalPages={totalPages}
      currentPage={currentPage}
      totalCount={totalCount}
      createPageHref={createPageHref}
      labels={{
        showing: t("list.pagination.showing", { start, end, total: totalCount }),
        loadMore: t("list.pagination.loadMore"),
        navigationAriaLabel: t("list.pagination.navigationAriaLabel"),
        previous: t("list.pagination.previous"),
        next: t("list.pagination.next"),
        goToPage: (page) => t("list.pagination.goToPageAriaLabel", { page }),
      }}
    />
  );
}
