import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    storeReport: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    storeChangeRequest: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getAdminOpenStoreReports } from "../adminStoreReportQueries";
import { getStoreGovernanceSummary } from "@/lib/data/stores/storeGovernanceQueries";

const STORE_ID = "store-1";

const OPEN_REPORT_ROW = {
  id: "report-1",
  reason: "SPAM" as const,
  details: "This seller never shipped my order.",
  createdAt: new Date("2026-07-23T10:00:00Z"),
  reportedBy: {
    id: "user-9",
    username: "collector99",
    name: "Nine Collector",
    image: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminOpenStoreReports (admin read path)", () => {
  it("returns reporter identity and raw free-text for each open report, newest first", async () => {
    prismaMock.storeReport.findMany.mockResolvedValue([OPEN_REPORT_ROW]);

    const reports = await getAdminOpenStoreReports(STORE_ID);

    // Only OPEN reports for this store are queried.
    expect(prismaMock.storeReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: STORE_ID, status: "OPEN" } }),
    );
    expect(reports).toEqual([
      {
        id: "report-1",
        reason: "SPAM",
        details: "This seller never shipped my order.",
        createdAt: OPEN_REPORT_ROW.createdAt,
        reporter: { id: "user-9", username: "collector99", name: "Nine Collector", image: null },
      },
    ]);
    // The admin path is the only one that exposes identity + raw text.
    expect(reports[0].reporter.username).toBe("collector99");
    expect(reports[0].details).toBe("This seller never shipped my order.");
  });
});

describe("getStoreGovernanceSummary (public read model, BR-04-13 / BR-04-25)", () => {
  it("never exposes reporter identity or raw report free-text", async () => {
    prismaMock.storeReport.groupBy.mockResolvedValue([{ reason: "SPAM", _count: { _all: 2 } }]);
    prismaMock.storeReport.count.mockResolvedValue(2);
    prismaMock.storeChangeRequest.groupBy.mockResolvedValue([]);
    prismaMock.storeChangeRequest.count.mockResolvedValue(0);
    prismaMock.storeChangeRequest.findMany.mockResolvedValue([]);

    const summary = await getStoreGovernanceSummary(STORE_ID);

    // The summary carries only aggregate counts; no per-report identity or free-text leaks.
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("collector99");
    expect(serialized).not.toContain("never shipped");
    expect(serialized).not.toContain("details");
    expect(serialized).not.toContain("reporter");
    expect(summary.totalReports).toBe(2);
    expect(summary.openReports).toBe(2);
  });
});
