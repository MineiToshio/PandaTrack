import { ChevronRight, History } from "lucide-react";
import Button from "@/components/core/Button/Button";

type AuditPagerProps = {
  currentPage: number;
  totalPages: number;
  /** Accessible name for the pagination navigation region. */
  regionLabel: string;
  /** Label for the control that advances to older entries (next page). */
  olderLabel: string;
  /** Label for the control that returns toward the newest entries (previous page). */
  newerLabel: string;
};

/**
 * Offset pagination controls for the audit viewer. Navigation is plain links that set `?page=N`
 * (page replacement, server round-trip, no client list state). "Older" advances to the next,
 * older page; "Newer" returns toward page 1. Each disables at its boundary.
 */
export default function AuditPager({ currentPage, totalPages, regionLabel, olderLabel, newerLabel }: AuditPagerProps) {
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <nav className="flex items-center justify-center gap-2.5 pt-1" aria-label={regionLabel}>
      <Button
        as="a"
        href={`?page=${currentPage - 1}`}
        variant="ghost"
        size="sm"
        disabled={isFirstPage}
        leadingIcon={<ChevronRight className="h-4 w-4 rotate-180" aria-hidden />}
      >
        {newerLabel}
      </Button>
      <Button
        as="a"
        href={`?page=${currentPage + 1}`}
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
