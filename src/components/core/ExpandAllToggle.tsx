"use client";

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";

export type ExpandAllToggleProps = {
  /** How many rows in the current set are expanded. */
  expandedCount: number;
  /** Total number of expandable rows in the current set (current page + filter). */
  total: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  className?: string;
};

/**
 * Single "Expand all / Collapse all" toggle for a list of expandable rows. The visible label shows
 * the *next* action: it reads "Expand all" until every row is open, then "Collapse all" — so a
 * partially-expanded list still offers "Expand all". The visible label can therefore fall out of
 * sync with the true state, so `aria-pressed` carries the honest tri-state for assistive tech:
 * `true` (all open), `false` (none open), `mixed` (some open). See Adrian Roselli, "Check-All /
 * Expand-All Controls".
 */
export default function ExpandAllToggle({
  expandedCount,
  total,
  onExpandAll,
  onCollapseAll,
  className,
}: ExpandAllToggleProps) {
  const t = useTranslations("components.expandAllToggle");
  const allExpanded = total > 0 && expandedCount >= total;
  const ariaPressed: boolean | "mixed" = allExpanded ? true : expandedCount === 0 ? false : "mixed";
  const Icon = allExpanded ? ChevronsDownUp : ChevronsUpDown;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={ariaPressed}
      leadingIcon={<Icon size={14} aria-hidden />}
      onClick={allExpanded ? onCollapseAll : onExpandAll}
      className={className}
    >
      {allExpanded ? t("collapseAll") : t("expandAll")}
    </Button>
  );
}
