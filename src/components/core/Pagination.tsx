"use client";

import { ChevronLeft, ChevronRight, Loader2, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import { cn } from "@/lib/styles";

// ── Classic (desktop numbered pagination) ──────────────────────────────────

type ClassicPaginationProps = {
  variant: "classic";
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
};

// ── Load-more (mobile infinite-style) ─────────────────────────────────────

type LoadMorePaginationProps = {
  variant: "load-more";
  hasMore: boolean;
  loading?: boolean;
  loadedCount: number;
  totalCount: number;
  onLoadMore: () => void;
  className?: string;
};

type PaginationProps = ClassicPaginationProps | LoadMorePaginationProps;

function generatePageRange(currentPage: number, totalPages: number, siblingCount = 1): (number | "ellipsis")[] {
  const delta = siblingCount + 2;
  const range: number[] = [];

  for (
    let i = Math.max(2, currentPage - siblingCount);
    i <= Math.min(totalPages - 1, currentPage + siblingCount);
    i++
  ) {
    range.push(i);
  }

  const showLeftEllipsis = range[0] > 2;
  const showRightEllipsis = range[range.length - 1] < totalPages - 1;

  const pages: (number | "ellipsis")[] = [1];
  if (showLeftEllipsis) pages.push("ellipsis");
  pages.push(...range);
  if (showRightEllipsis) pages.push("ellipsis");
  if (totalPages > 1) pages.push(totalPages);

  void delta;
  return pages;
}

function ClassicPagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
}: Omit<ClassicPaginationProps, "variant">) {
  const t = useTranslations("components.pagination");
  const pages = generatePageRange(currentPage, totalPages, siblingCount);

  return (
    <nav aria-label={t("ariaLabel")} className={cn("flex items-center justify-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label={t("previous")}
        className="focus-visible:ring-ring focus-visible:ring-offset-background text-text-secondary hover:bg-muted hover:text-text-primary disabled:text-text-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((page, index) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="text-text-muted flex h-9 w-9 items-center justify-center text-sm">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={t("page", { page })}
            className={cn(
              "focus-visible:ring-ring focus-visible:ring-offset-background flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              page === currentPage
                ? "bg-primary/15 text-primary font-medium"
                : "text-text-secondary hover:bg-muted hover:text-text-primary",
            )}
          >
            {page}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label={t("next")}
        className="focus-visible:ring-ring focus-visible:ring-offset-background text-text-secondary hover:bg-muted hover:text-text-primary disabled:text-text-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

function LoadMorePagination({
  hasMore,
  loading = false,
  loadedCount,
  totalCount,
  onLoadMore,
  className,
}: Omit<LoadMorePaginationProps, "variant">) {
  const t = useTranslations("components.pagination");

  if (!hasMore && loadedCount >= totalCount) return null;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <p className="text-text-muted text-sm">{t("loadedOf", { loaded: loadedCount, total: totalCount })}</p>
      {hasMore && (
        <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading} aria-busy={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              {t("loading")}
            </>
          ) : (
            t("loadMore")
          )}
        </Button>
      )}
    </div>
  );
}

export default function Pagination(props: PaginationProps) {
  if (props.variant === "classic") {
    const { variant: _, ...rest } = props;
    return <ClassicPagination {...rest} />;
  }
  const { variant: _, ...rest } = props;
  return <LoadMorePagination {...rest} />;
}

export { generatePageRange };
