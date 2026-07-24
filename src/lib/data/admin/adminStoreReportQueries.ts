import type { StoreReportReason } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * A single open store report as seen by an administrator: the raw free-text detail plus the
 * reporter's identity. This is the only read path that exposes either; the public governance read
 * model (`getStoreGovernanceSummary`) returns counts only and is never widened (BR-04-13,
 * BR-04-25). Callers must gate with `requireAdmin()` (or the page-level admin check) before reading.
 */
export type AdminOpenStoreReport = {
  id: string;
  reason: StoreReportReason;
  details: string | null;
  createdAt: Date;
  reporter: {
    id: string;
    username: string;
    name: string;
    image: string | null;
  };
};

/**
 * Lists every `OPEN` report for a store, newest first, with reporter identity and raw free-text for
 * the admin resolution surface. Server-only and admin-only: this must never be reached from a public
 * route. `REVIEWED` / `DISMISSED` reports are history and are not returned here.
 */
export async function getAdminOpenStoreReports(storeId: string): Promise<AdminOpenStoreReport[]> {
  const reports = await prisma.storeReport.findMany({
    where: { storeId, status: "OPEN" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      reason: true,
      details: true,
      createdAt: true,
      reportedBy: {
        select: {
          id: true,
          username: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return reports.map((report) => ({
    id: report.id,
    reason: report.reason,
    details: report.details,
    createdAt: report.createdAt,
    reporter: report.reportedBy,
  }));
}
