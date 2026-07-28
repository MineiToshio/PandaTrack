"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import posthog from "posthog-js";
import ExpandAllToggle from "@/components/core/ExpandAllToggle";

/**
 * Analytics event names for a list's expansion interactions. Passed as plain strings so a Server
 * Component can wire a specific list (orders / deliveries) without shipping callbacks across the
 * boundary.
 */
export type ListExpansionEvents = {
  cardExpanded: string;
  cardCollapsed: string;
  expandedAll: string;
  collapsedAll: string;
  /** Property key for the per-row id on card events, e.g. "order_id" / "delivery_id". */
  idProp: string;
};

type ListExpansionApi = {
  expandedIds: Set<string>;
  isExpanded: (id: string) => boolean;
  expandedCount: number;
  total: number;
  toggleOne: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** The list body publishes the current page's ids here (in an effect) so the toggle — rendered
   *  outside the list — knows the total, and stale ids are pruned on filter/page changes. */
  syncIds: (ids: string[]) => void;
};

const ListExpansionContext = createContext<ListExpansionApi | null>(null);

/**
 * Shares one multi-open expansion set between a list body and an "expand/collapse all" toggle that
 * lives outside the list's own subtree (e.g. up in the filter-chips row, above the data Suspense
 * boundary). The provider sits above that boundary so the toggle stays mounted and flicker-free
 * while the list re-suspends on filter/page changes; ids no longer present are pruned on sync.
 */
export function ListExpansionProvider({ children, events }: { children: ReactNode; events: ListExpansionEvents }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [ids, setIds] = useState<string[]>([]);

  const syncIds = useCallback((next: string[]) => {
    setIds((prev) => (prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next));
    setExpandedIds((prev) => {
      if (prev.size === 0) return prev;
      const allowed = new Set(next);
      const pruned = new Set<string>();
      prev.forEach((id) => allowed.has(id) && pruned.add(id));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, []);

  const toggleOne = useCallback(
    (id: string) => {
      const willExpand = !expandedIds.has(id);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      posthog.capture(willExpand ? events.cardExpanded : events.cardCollapsed, { [events.idProp]: id });
    },
    [expandedIds, events],
  );

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(ids));
    posthog.capture(events.expandedAll, { count: ids.length });
  }, [ids, events]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
    posthog.capture(events.collapsedAll, { count: ids.length });
  }, [ids, events]);

  const value = useMemo<ListExpansionApi>(
    () => ({
      expandedIds,
      isExpanded: (id: string) => expandedIds.has(id),
      expandedCount: expandedIds.size,
      total: ids.length,
      toggleOne,
      expandAll,
      collapseAll,
      syncIds,
    }),
    [expandedIds, ids, toggleOne, expandAll, collapseAll, syncIds],
  );

  return <ListExpansionContext.Provider value={value}>{children}</ListExpansionContext.Provider>;
}

export function useListExpansion(): ListExpansionApi {
  const ctx = useContext(ListExpansionContext);
  if (!ctx) throw new Error("useListExpansion must be used within a ListExpansionProvider");
  return ctx;
}

/**
 * The context-bound expand/collapse-all toggle. Rendered in the filter-chips row (not inside the
 * list) so it shares a single row with the chips. Renders nothing until the list has ≥2 rows to
 * act on, so `empty:hidden` can collapse the row when there are neither chips nor a toggle.
 */
export function ListExpandAllToggle({ className }: { className?: string }) {
  const { expandedCount, total, expandAll, collapseAll } = useListExpansion();
  if (total < 2) return null;
  return (
    <ExpandAllToggle
      expandedCount={expandedCount}
      total={total}
      onExpandAll={expandAll}
      onCollapseAll={collapseAll}
      className={className}
    />
  );
}
