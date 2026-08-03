import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    imageIntakePeriod: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { DEFAULT_MONTHLY_PHOTO_QUOTA } from "@/lib/imageIntake/constants";
import { getImageIntakeQuotaSnapshot, searchImageIntakeQuotaAccounts } from "../imageIntakeQuotaQueries";

const NOW = new Date("2026-07-28T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ aiMonthlyPhotoLimit: null });
  prismaMock.imageIntakePeriod.findUnique.mockResolvedValue(null);
});

describe("getImageIntakeQuotaSnapshot", () => {
  it("reads the balance from the current period's roll-up", async () => {
    prismaMock.imageIntakePeriod.findUnique.mockResolvedValue({ usedPhotos: 17 });

    const snapshot = await getImageIntakeQuotaSnapshot({ userId: "user-1", isAdmin: false, now: NOW });

    expect(snapshot).toEqual({
      limit: DEFAULT_MONTHLY_PHOTO_QUOTA,
      usedPhotos: 17,
      remaining: 3,
      periodKey: "2026-07",
      renewalAtIso: "2026-08-01T00:00:00.000Z",
    });
    expect(prismaMock.imageIntakePeriod.findUnique).toHaveBeenCalledWith({
      where: { userId_periodKey: { userId: "user-1", periodKey: "2026-07" } },
      select: { usedPhotos: true },
    });
  });

  it("counts reservations still in flight, because the roll-up holds them until they settle", async () => {
    // A PENDING submission has already incremented `usedPhotos`; the counter must not promise
    // photos that a request in progress is about to take.
    prismaMock.imageIntakePeriod.findUnique.mockResolvedValue({ usedPhotos: 20 });

    const snapshot = await getImageIntakeQuotaSnapshot({ userId: "user-1", isAdmin: false, now: NOW });

    expect(snapshot.remaining).toBe(0);
  });

  it("reports a full bag for a period with no roll-up row yet, with no job having run", async () => {
    const snapshot = await getImageIntakeQuotaSnapshot({ userId: "user-1", isAdmin: false, now: NOW });

    expect(snapshot.remaining).toBe(DEFAULT_MONTHLY_PHOTO_QUOTA);
    expect(snapshot.usedPhotos).toBe(0);
  });

  it("applies the per-user override", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ aiMonthlyPhotoLimit: 60 });
    prismaMock.imageIntakePeriod.findUnique.mockResolvedValue({ usedPhotos: 25 });

    const snapshot = await getImageIntakeQuotaSnapshot({ userId: "user-1", isAdmin: false, now: NOW });

    expect(snapshot).toMatchObject({ limit: 60, remaining: 35 });
  });

  it("reports no cap for an administrator, so no counter line is rendered", async () => {
    prismaMock.imageIntakePeriod.findUnique.mockResolvedValue({ usedPhotos: 120 });

    const snapshot = await getImageIntakeQuotaSnapshot({ userId: "admin-1", isAdmin: true, now: NOW });

    expect(snapshot).toMatchObject({ limit: null, remaining: null, usedPhotos: 120 });
  });
});

describe("searchImageIntakeQuotaAccounts", () => {
  it("returns nothing, and reads nothing, for a blank term", async () => {
    expect(await searchImageIntakeQuotaAccounts({ query: "   ", now: NOW })).toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("reports each account's override and its usage for the current period", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        username: "collector",
        name: "Collector",
        email: "collector@example.com",
        role: "user",
        aiMonthlyPhotoLimit: 40,
        imageIntakePeriods: [{ usedPhotos: 12 }],
      },
      {
        id: "user-2",
        username: "owner",
        name: "Owner",
        email: "owner@example.com",
        role: "moderator,admin",
        aiMonthlyPhotoLimit: null,
        imageIntakePeriods: [],
      },
    ]);

    const accounts = await searchImageIntakeQuotaAccounts({ query: "co", now: NOW });

    expect(accounts).toEqual([
      {
        userId: "user-1",
        username: "collector",
        name: "Collector",
        email: "collector@example.com",
        isAdmin: false,
        overrideLimit: 40,
        usedPhotos: 12,
      },
      {
        userId: "user-2",
        username: "owner",
        name: "Owner",
        email: "owner@example.com",
        isAdmin: true,
        overrideLimit: null,
        usedPhotos: 0,
      },
    ]);
    expect(prismaMock.user.findMany.mock.calls[0][0].select.imageIntakePeriods.where).toEqual({
      periodKey: "2026-07",
    });
  });
});
