import { describe, expect, it } from "vitest";
import { STORE_REPORT_CLUSTER_THRESHOLD, STORE_REPORT_NOTICE_THRESHOLD } from "@/lib/constants";
import { hasDerivedReportNotice, isReportCluster } from "../reportNotice";

describe("hasDerivedReportNotice", () => {
  it("shows no notice for a store with no open reports", () => {
    expect(hasDerivedReportNotice(0)).toBe(false);
  });

  it("shows the notice from the first open report", () => {
    expect(hasDerivedReportNotice(1)).toBe(true);
    expect(hasDerivedReportNotice(2)).toBe(true);
  });

  it("clears the notice when the last open report is resolved or dismissed", () => {
    // The resolution path returns the store's remaining open reports; reaching zero is what turns
    // the public notice off, with no write on the store row.
    const openReportsRemaining = 0;
    expect(hasDerivedReportNotice(openReportsRemaining)).toBe(false);
  });

  it("reads its own named threshold", () => {
    expect(hasDerivedReportNotice(STORE_REPORT_NOTICE_THRESHOLD)).toBe(true);
    expect(hasDerivedReportNotice(STORE_REPORT_NOTICE_THRESHOLD - 1)).toBe(false);
  });
});

describe("isReportCluster", () => {
  it("keeps a single open report as its own queue row", () => {
    expect(isReportCluster(0)).toBe(false);
    expect(isReportCluster(1)).toBe(false);
  });

  it("collapses a store's reports into one row from the cluster threshold up", () => {
    expect(isReportCluster(2)).toBe(true);
    expect(isReportCluster(5)).toBe(true);
  });

  it("reads its own named threshold", () => {
    expect(isReportCluster(STORE_REPORT_CLUSTER_THRESHOLD)).toBe(true);
    expect(isReportCluster(STORE_REPORT_CLUSTER_THRESHOLD - 1)).toBe(false);
  });
});

describe("the two thresholds", () => {
  it("are distinct values, so buyer information and queue escalation stay independent", () => {
    expect(STORE_REPORT_NOTICE_THRESHOLD).not.toBe(STORE_REPORT_CLUSTER_THRESHOLD);
  });

  it("answer different questions at the same open-report count", () => {
    // One open report: the buyer is informed, the moderation queue is not escalated.
    expect(hasDerivedReportNotice(1)).toBe(true);
    expect(isReportCluster(1)).toBe(false);
  });
});
