import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";

const PAGINATION_ELLIPSIS = "ellipsis";
const MAX_VISIBLE_PAGINATION_ITEMS = 7;

type PaginationToken = { type: "page"; page: number } | { type: typeof PAGINATION_ELLIPSIS; key: string };

type StoreListingPaginationProps = {
  locale: string;
  totalPages: number;
  currentPage: number;
  createPageHref: (page: number) => string;
};

function buildPaginationTokens(totalPages: number, currentPage: number): PaginationToken[] {
  if (totalPages <= MAX_VISIBLE_PAGINATION_ITEMS) {
    return Array.from({ length: totalPages }, (_, index) => ({ type: "page", page: index + 1 }));
  }

  const tokens: PaginationToken[] = [{ type: "page", page: 1 }];
  const centerStart = Math.max(2, currentPage - 1);
  const centerEnd = Math.min(totalPages - 1, currentPage + 1);

  if (centerStart > 2) {
    tokens.push({ type: PAGINATION_ELLIPSIS, key: "left" });
  }

  for (let page = centerStart; page <= centerEnd; page += 1) {
    tokens.push({ type: "page", page });
  }

  if (centerEnd < totalPages - 1) {
    tokens.push({ type: PAGINATION_ELLIPSIS, key: "right" });
  }

  tokens.push({ type: "page", page: totalPages });
  return tokens;
}

export default async function StoreListingPagination({
  locale,
  totalPages,
  currentPage,
  createPageHref,
}: StoreListingPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const tListing = await getTranslations({ locale, namespace: "storeListing" });
  const paginationTokens = buildPaginationTokens(totalPages, currentPage);
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  const isOnFirstPage = currentPage === 1;
  const isOnLastPage = currentPage === totalPages;

  return (
    <nav
      aria-label={tListing("pagination.navigationAriaLabel")}
      className="flex flex-wrap items-center justify-center gap-1.5"
    >
      {isOnFirstPage ? (
        <span
          aria-disabled="true"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "pointer-events-none min-h-9 rounded-lg px-3 opacity-50",
          )}
        >
          {tListing("pagination.previous")}
        </span>
      ) : (
        <Link
          href={createPageHref(previousPage)}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-h-9 rounded-lg px-3")}
        >
          {tListing("pagination.previous")}
        </Link>
      )}

      {paginationTokens.map((token) => {
        if (token.type === PAGINATION_ELLIPSIS) {
          return (
            <span key={token.key} className="text-text-muted inline-flex min-h-9 items-center px-2 text-sm">
              ...
            </span>
          );
        }

        const isCurrentPage = token.page === currentPage;
        return (
          <Link
            key={`store-page-${token.page}`}
            href={createPageHref(token.page)}
            aria-current={isCurrentPage ? "page" : undefined}
            aria-label={tListing("pagination.goToPageAriaLabel", { page: token.page })}
            className={cn(
              buttonVariants({ variant: isCurrentPage ? "primary" : "ghost", size: "sm" }),
              "min-h-9 min-w-9 rounded-lg px-3",
            )}
          >
            {token.page}
          </Link>
        );
      })}

      {isOnLastPage ? (
        <span
          aria-disabled="true"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "pointer-events-none min-h-9 rounded-lg px-3 opacity-50",
          )}
        >
          {tListing("pagination.next")}
        </span>
      ) : (
        <Link
          href={createPageHref(nextPage)}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-h-9 rounded-lg px-3")}
        >
          {tListing("pagination.next")}
        </Link>
      )}
    </nav>
  );
}
