import { ChevronRight, History } from "lucide-react";
import Button from "@/components/core/Button/Button";

type AdminPagerProps = {
  currentPage: number;
  totalPages: number;
  /** Accessible name for the pagination navigation region. */
  regionLabel: string;
  /** Label for the control that advances to older entries (next page). */
  olderLabel: string;
  /** Label for the control that returns toward the newest entries (previous page). */
  newerLabel: string;
  /**
   * Builds the href for a page number. Defaults to a bare `?page=N`, which is correct only when
   * `page` is the sole query param: a relative `?…` href replaces the whole query string, so a
   * listing that also carries `?q=` or `?user=` must pass a builder that keeps them.
   */
  buildHref?: (page: number) => string;
};

function defaultHref(page: number): string {
  return `?page=${page}`;
}

/**
 * Offset pagination controls shared by the admin console's newest-first listings (the audit viewer
 * and the collector point ledger). Navigation is plain links (page replacement, server round-trip,
 * no client list state), so the URL is the only state and nothing can fall out of sync with it.
 * "Older" advances to the next, older page; "Newer" returns toward page 1. Each disables at its
 * boundary.
 */
export default function AdminPager({
  currentPage,
  totalPages,
  regionLabel,
  olderLabel,
  newerLabel,
  buildHref = defaultHref,
}: AdminPagerProps) {
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <nav className="flex items-center justify-center gap-2.5 pt-1" aria-label={regionLabel}>
      <Button
        as="a"
        href={buildHref(currentPage - 1)}
        variant="ghost"
        size="sm"
        disabled={isFirstPage}
        leadingIcon={<ChevronRight className="h-4 w-4 rotate-180" aria-hidden />}
      >
        {newerLabel}
      </Button>
      <Button
        as="a"
        href={buildHref(currentPage + 1)}
        variant="ghost"
        size="sm"
        disabled={isLastPage}
        leadingIcon={<History className="h-4 w-4" aria-hidden />}
      >
        {olderLabel}
      </Button>
    </nav>
  );
}
