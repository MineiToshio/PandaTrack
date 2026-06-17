import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/styles";

const PAGINATION_ELLIPSIS = "ellipsis";
const MAX_VISIBLE_PAGINATION_ITEMS = 7;

type PaginationToken = { type: "page"; page: number } | { type: typeof PAGINATION_ELLIPSIS; key: string };

export type ListPaginationLabels = {
  /** Counter line, e.g. "Mostrando 1–30 de 92 entregas". */
  showing: string;
  /** Mobile load-more CTA. */
  loadMore: string;
  navigationAriaLabel: string;
  previous: string;
  next: string;
  goToPage: (page: number) => string;
};

type ListPaginationProps = {
  totalPages: number;
  currentPage: number;
  totalCount: number;
  createPageHref: (page: number) => string;
  labels: ListPaginationLabels;
};

function buildPaginationTokens(totalPages: number, currentPage: number): PaginationToken[] {
  if (totalPages <= MAX_VISIBLE_PAGINATION_ITEMS) {
    return Array.from({ length: totalPages }, (_, index) => ({ type: "page", page: index + 1 }));
  }

  const tokens: PaginationToken[] = [{ type: "page", page: 1 }];
  const centerStart = Math.max(2, currentPage - 1);
  const centerEnd = Math.min(totalPages - 1, currentPage + 1);

  if (centerStart > 2) tokens.push({ type: PAGINATION_ELLIPSIS, key: "left" });
  for (let page = centerStart; page <= centerEnd; page += 1) tokens.push({ type: "page", page });
  if (centerEnd < totalPages - 1) tokens.push({ type: PAGINATION_ELLIPSIS, key: "right" });
  tokens.push({ type: "page", page: totalPages });
  return tokens;
}

const NAV_BUTTON_CLASSNAME =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius-md)] [color:var(--text-secondary)] hover:[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]";

const NAV_BUTTON_DISABLED_CLASSNAME =
  "pointer-events-none inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius-md)] opacity-40 [color:var(--text-secondary)]";

/**
 * Cross-module list pagination (canonical L062): counter line + mobile "Load more"
 * + desktop numeric pagination. Consumers translate the labels in their own
 * namespace and pass them in.
 */
export default function ListPagination({
  totalPages,
  currentPage,
  totalCount,
  createPageHref,
  labels,
}: ListPaginationProps) {
  if (totalCount === 0) return null;

  if (totalPages <= 1) {
    return (
      <p className="text-center [font-size:var(--text-caption)] [color:var(--text-muted)] tabular-nums">
        {labels.showing}
      </p>
    );
  }

  const tokens = buildPaginationTokens(totalPages, currentPage);
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;
  const hasNextPage = !isLast;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center [font-size:var(--text-caption)] [color:var(--text-muted)] tabular-nums">
        {labels.showing}
      </p>

      {/* Mobile — Load more (canonical L062) */}
      {hasNextPage && (
        <Link
          href={createPageHref(nextPage)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-5 [font-size:var(--text-body)] [color:var(--text-primary)] [background:color-mix(in_oklch,var(--text-primary)_5%,transparent)] hover:[background:color-mix(in_oklch,var(--text-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)] lg:hidden"
        >
          {labels.loadMore}
        </Link>
      )}

      {/* Desktop — Numeric pagination */}
      <nav aria-label={labels.navigationAriaLabel} className="hidden items-center gap-1 lg:flex">
        {isFirst ? (
          <span aria-disabled className={NAV_BUTTON_DISABLED_CLASSNAME}>
            <ChevronLeft size={16} aria-hidden />
          </span>
        ) : (
          <Link href={createPageHref(previousPage)} aria-label={labels.previous} className={NAV_BUTTON_CLASSNAME}>
            <ChevronLeft size={16} aria-hidden />
          </Link>
        )}

        {tokens.map((token) => {
          if (token.type === PAGINATION_ELLIPSIS) {
            return (
              <span
                key={token.key}
                className="inline-flex h-9 min-w-9 items-center justify-center [color:var(--text-muted)]"
              >
                …
              </span>
            );
          }
          const isCurrent = token.page === currentPage;
          return (
            <Link
              key={`list-page-${token.page}`}
              href={createPageHref(token.page)}
              aria-current={isCurrent ? "page" : undefined}
              aria-label={labels.goToPage(token.page)}
              className={cn(
                NAV_BUTTON_CLASSNAME,
                "tabular-nums",
                isCurrent &&
                  "[color:var(--text-on-accent)] [background:var(--accent)] hover:[color:var(--text-on-accent)]",
              )}
            >
              {token.page}
            </Link>
          );
        })}

        {isLast ? (
          <span aria-disabled className={NAV_BUTTON_DISABLED_CLASSNAME}>
            <ChevronRight size={16} aria-hidden />
          </span>
        ) : (
          <Link href={createPageHref(nextPage)} aria-label={labels.next} className={NAV_BUTTON_CLASSNAME}>
            <ChevronRight size={16} aria-hidden />
          </Link>
        )}
      </nav>
    </div>
  );
}
