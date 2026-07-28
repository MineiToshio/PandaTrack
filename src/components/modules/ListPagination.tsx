import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/styles";
import { PAGE_SIZE_OPTIONS } from "@/lib/constants";
import PerPageSelect, { type PerPageSelectProps } from "./PerPageSelect";

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

/** Shape both the mobile "Load more" CTA and the desktop nav's links render through. Consumers
 *  that need a custom navigation mechanism (stores' transition-backed skeleton) override
 *  `LinkComponent`; everyone else gets a plain `next/link`. */
export type PaginationLinkComponentProps = {
  href: string;
  className?: string;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
  children: ReactNode;
};

type ListPaginationProps = {
  totalPages: number;
  currentPage: number;
  totalCount: number;
  createPageHref: (page: number) => string;
  labels: ListPaginationLabels;
  /** Current page size (one of `PAGE_SIZE_OPTIONS`). */
  perPage: number;
  /** Builds the href for a given page size (resets to page 1). Called once per option — the
   *  resulting hrefs, not the builder itself, cross into the client page-size control. */
  buildPerPageHref: (size: number) => string;
  perPageLabel: string;
  /** Override the link element for "Load more" + desktop nav (stores routes through its own
   *  transition-backed skeleton instead of a full navigation). */
  LinkComponent?: ComponentType<PaginationLinkComponentProps>;
  /** Override the page-size control (stores routes size changes through the same transition). */
  PerPageSelectComponent?: ComponentType<PerPageSelectProps>;
};

function DefaultPaginationLink({ href, className, children, ...rest }: PaginationLinkComponentProps) {
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

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
  perPage,
  buildPerPageHref,
  perPageLabel,
  LinkComponent,
  PerPageSelectComponent,
}: ListPaginationProps) {
  if (totalCount === 0) return null;

  const LinkComp = LinkComponent ?? DefaultPaginationLink;
  const PerPageSelectComp = PerPageSelectComponent ?? PerPageSelect;

  const tokens = buildPaginationTokens(totalPages, currentPage);
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;
  const hasNextPage = !isLast;

  // Built once, server-side: only the resulting strings (not `buildPerPageHref` itself) reach
  // the client page-size control.
  const perPageHrefBySize = Object.fromEntries(PAGE_SIZE_OPTIONS.map((size) => [size, buildPerPageHref(size)]));

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile — counter + Load more (canonical L062), stacked and centered */}
      <div className="flex flex-col items-center gap-3 lg:hidden">
        <p className="text-center [font-size:var(--text-caption)] [color:var(--text-muted)] tabular-nums">
          {labels.showing}
        </p>

        {hasNextPage && (
          <LinkComp
            href={createPageHref(nextPage)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-5 [font-size:var(--text-body)] [color:var(--text-primary)] [background:color-mix(in_oklch,var(--text-primary)_5%,transparent)] hover:[background:color-mix(in_oklch,var(--text-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
          >
            {labels.loadMore}
          </LinkComp>
        )}
      </div>

      {/* Desktop — summary (left) + per-page select + numbered nav (right), one row.
          `flex-wrap` is a safety net: at narrow `lg` widths (sidebar expanded, long counter
          text) the control cluster drops to its own line instead of overflowing. */}
      <div className="hidden items-center justify-between gap-x-4 gap-y-2 lg:flex lg:flex-wrap">
        <p className="[font-size:var(--text-caption)] [color:var(--text-muted)] tabular-nums">{labels.showing}</p>

        <div className="flex flex-wrap items-center justify-end gap-4">
          <PerPageSelectComp value={perPage} label={perPageLabel} hrefBySize={perPageHrefBySize} />

          <nav aria-label={labels.navigationAriaLabel} className="flex flex-wrap items-center gap-1">
            {isFirst ? (
              <span aria-disabled className={NAV_BUTTON_DISABLED_CLASSNAME}>
                <ChevronLeft size={16} aria-hidden />
              </span>
            ) : (
              <LinkComp
                href={createPageHref(previousPage)}
                aria-label={labels.previous}
                className={NAV_BUTTON_CLASSNAME}
              >
                <ChevronLeft size={16} aria-hidden />
              </LinkComp>
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
                <LinkComp
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
                </LinkComp>
              );
            })}

            {isLast ? (
              <span aria-disabled className={NAV_BUTTON_DISABLED_CLASSNAME}>
                <ChevronRight size={16} aria-hidden />
              </span>
            ) : (
              <LinkComp href={createPageHref(nextPage)} aria-label={labels.next} className={NAV_BUTTON_CLASSNAME}>
                <ChevronRight size={16} aria-hidden />
              </LinkComp>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
