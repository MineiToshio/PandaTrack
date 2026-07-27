import { STORE_REPORT_CLUSTER_THRESHOLD, STORE_REPORT_NOTICE_THRESHOLD } from "@/lib/constants";

/**
 * Derived trust signals over a store's open-report count.
 *
 * Both predicates live here, beside each other and beside their constants, so no call site writes its
 * own `count >= n` comparison: the public store detail and the moderation console read the same
 * function and cannot disagree about whether a store counts as reported. Nothing about reports is
 * persisted on the store row; these are computed on every read (ADR 0019).
 */

/**
 * Whether the public store detail shows the derived report notice (banner plus "Con reportes" chip).
 * True from the first open report: the notice informs that a report exists and is pending review, it
 * makes no claim about the seller.
 */
export function hasDerivedReportNotice(openReportCount: number): boolean {
  return openReportCount >= STORE_REPORT_NOTICE_THRESHOLD;
}

/**
 * Whether a store's open reports collapse into a single report-cluster row in the moderation inbox
 * instead of one row per report. Escalation ergonomics for the queue, independent of the public
 * notice above.
 */
export function isReportCluster(openReportCount: number): boolean {
  return openReportCount >= STORE_REPORT_CLUSTER_THRESHOLD;
}
