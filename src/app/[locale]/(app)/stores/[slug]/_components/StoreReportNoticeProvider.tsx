"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { hasDerivedReportNotice } from "@/lib/store/reportNotice";

type StoreReportNoticeContextValue = {
  /** Open reports on this store right now, after any in-flight optimistic resolution. */
  openReportCount: number;
  /** Whether the derived public notice (banner plus hero chip) renders. */
  hasReportNotice: boolean;
  /** Report ids hidden by an in-flight optimistic resolution. Empty for a non-admin viewer. */
  pendingResolvedReportIds: ReadonlySet<string>;
  /** Hides a report optimistically, before its resolution has been confirmed. */
  markReportResolved: (reportId: string) => void;
  /** Puts a report back after its resolution failed, restoring the notice with it. */
  restoreReport: (reportId: string) => void;
};

const StoreReportNoticeContext = createContext<StoreReportNoticeContextValue | null>(null);

/** Reads the derived report-notice state. Throws outside {@link StoreReportNoticeProvider}. */
export function useStoreReportNotice(): StoreReportNoticeContextValue {
  const value = useContext(StoreReportNoticeContext);
  if (!value) {
    throw new Error("useStoreReportNotice must be used within a StoreReportNoticeProvider");
  }
  return value;
}

type StoreReportNoticeProviderProps = {
  /** Server-read open-report count, the source for every viewer who cannot resolve reports. */
  openReportCount: number;
  /**
   * Ids of the store's open reports, present only for an administrator (the viewer who can resolve
   * them). When present the count is derived from this list minus the optimistically resolved ids, so
   * a resolution clears the notice immediately and a server revalidation reconciles it on its own.
   */
  adminOpenReportIds?: string[];
  children: ReactNode;
};

/**
 * Holds the store detail's derived report-notice state so the banner, the hero chip, and the
 * governance modal all read one number. Nothing here is persisted: the notice is a read-time
 * derivation over open reports, and resolving the last one is what clears it.
 *
 * Optimistic resolution is keyed on report ids rather than on a decremented counter: the count is
 * recomputed from the fresh server list minus the ids still in flight, so it stays correct when the
 * revalidated payload arrives and a failed resolution restores the notice by restoring its id.
 */
export default function StoreReportNoticeProvider({
  openReportCount,
  adminOpenReportIds,
  children,
}: StoreReportNoticeProviderProps) {
  const [pendingResolvedReportIds, setPendingResolvedReportIds] = useState<ReadonlySet<string>>(new Set());

  const markReportResolved = useCallback((reportId: string) => {
    setPendingResolvedReportIds((current) => new Set(current).add(reportId));
  }, []);

  const restoreReport = useCallback((reportId: string) => {
    setPendingResolvedReportIds((current) => {
      const next = new Set(current);
      next.delete(reportId);
      return next;
    });
  }, []);

  const value = useMemo<StoreReportNoticeContextValue>(() => {
    const effectiveCount = adminOpenReportIds
      ? adminOpenReportIds.filter((reportId) => !pendingResolvedReportIds.has(reportId)).length
      : openReportCount;
    return {
      openReportCount: effectiveCount,
      hasReportNotice: hasDerivedReportNotice(effectiveCount),
      pendingResolvedReportIds,
      markReportResolved,
      restoreReport,
    };
  }, [adminOpenReportIds, markReportResolved, openReportCount, pendingResolvedReportIds, restoreReport]);

  return <StoreReportNoticeContext.Provider value={value}>{children}</StoreReportNoticeContext.Provider>;
}
