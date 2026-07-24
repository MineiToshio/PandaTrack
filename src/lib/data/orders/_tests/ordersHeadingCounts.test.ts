import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { count: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getOrdersHeadingCounts } from "../orderQueries";

describe("getOrdersHeadingCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts the user's total orders and closed (COMPLETED/CANCELLED) orders", async () => {
    prismaMock.order.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4);

    await getOrdersHeadingCounts("user-1");

    expect(prismaMock.order.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prismaMock.order.count).toHaveBeenCalledWith({
      where: { userId: "user-1", status: { in: ["COMPLETED", "CANCELLED"] } },
    });
    expect(prismaMock.order.count).toHaveBeenCalledTimes(2);
  });

  it("derives activeCount as total minus closed", async () => {
    prismaMock.order.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4);

    const result = await getOrdersHeadingCounts("user-1");

    expect(result).toEqual({ activeCount: 6, closedCount: 4 });
  });

  it("clamps activeCount at 0 when closed exceeds total (defensive against a stale race)", async () => {
    prismaMock.order.count.mockResolvedValueOnce(2).mockResolvedValueOnce(5);

    const result = await getOrdersHeadingCounts("user-1");

    expect(result).toEqual({ activeCount: 0, closedCount: 5 });
  });
});
