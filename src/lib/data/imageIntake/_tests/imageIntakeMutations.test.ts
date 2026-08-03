import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { ImageIntakeEntrySource, ImageIntakeUsageStatus } from "../../../../../generated/prisma/client";
import { reserveImageIntakeUsage, settleImageIntakeUsage } from "../imageIntakeMutations";

const NOW = new Date("2026-07-28T12:00:00Z");

type LedgerRow = {
  id: string;
  userId: string;
  dayKey: string;
  imageCount: number;
  costMicroUsd: number;
  status: ImageIntakeUsageStatus;
};

type PeriodRow = { userId: string; periodKey: string; usedPhotos: number; costMicroUsd: number };

type MakeTxOptions = {
  rows?: Partial<LedgerRow>[];
  latestCreatedAt?: Date | null;
  periods?: PeriodRow[];
  /** Per-user monthly override, as stored on the account. */
  overrideLimit?: number | null;
};

function withRowDefaults(row: Partial<LedgerRow>, index: number): LedgerRow {
  return {
    id: row.id ?? `row-${index}`,
    userId: row.userId ?? "user-1",
    dayKey: row.dayKey ?? "2026-07-28",
    imageCount: row.imageCount ?? 0,
    costMicroUsd: row.costMicroUsd ?? 0,
    status: row.status ?? ImageIntakeUsageStatus.SUCCEEDED,
  };
}

/** In-memory stand-in for one period's rows, so totals, quota, and settlement can be asserted end to end. */
function makeTx(options: MakeTxOptions = {}) {
  const rows: LedgerRow[] = (options.rows ?? []).map(withRowDefaults);
  const periods: PeriodRow[] = options.periods ?? [];
  let nextId = rows.length + 1;

  const findPeriod = (where: { userId_periodKey: { userId: string; periodKey: string } }) =>
    periods.find(
      (period) =>
        period.userId === where.userId_periodKey.userId && period.periodKey === where.userId_periodKey.periodKey,
    ) ?? null;

  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    user: {
      findUnique: vi.fn(async () => ({ aiMonthlyPhotoLimit: options.overrideLimit ?? null })),
    },
    imageIntakePeriod: {
      findUnique: vi.fn(async ({ where }: { where: { userId_periodKey: { userId: string; periodKey: string } } }) =>
        findPeriod(where),
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { userId_periodKey: { userId: string; periodKey: string } };
          create: PeriodRow;
          update: { usedPhotos?: { increment?: number; decrement?: number }; costMicroUsd: { increment: number } };
        }) => {
          const existing = findPeriod(where);
          if (!existing) {
            periods.push({ ...create });
            return create;
          }
          existing.usedPhotos += update.usedPhotos?.increment ?? 0;
          existing.usedPhotos -= update.usedPhotos?.decrement ?? 0;
          existing.costMicroUsd += update.costMicroUsd.increment;
          return existing;
        },
      ),
    },
    imageIntakeUsage: {
      findFirst: vi.fn(async () =>
        options.latestCreatedAt === undefined || options.latestCreatedAt === null
          ? null
          : { createdAt: options.latestCreatedAt },
      ),
      // Returns a copy, like a real read does: the caller keeps reading the reservation's original
      // figures after the update statement has already replaced them.
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        return row ? { ...row } : null;
      }),
      // Attempts for one user and day, counted whatever their status: unlike the photo aggregate
      // below, this one never filters FAILED out.
      count: vi.fn(
        async ({ where }: { where: { userId: string; dayKey: string } }) =>
          rows.filter((row) => row.userId === where.userId && row.dayKey === where.dayKey).length,
      ),
      // Two shapes reach this mock: the global cost total for a period, and the daily photo total
      // for one user and day. They are told apart by the `dayKey` filter, exactly as the SQL is.
      aggregate: vi.fn(async ({ where }: { where: { dayKey?: string; userId?: string } }) => {
        if (where.dayKey) {
          const sameDay = rows.filter(
            (row) =>
              row.userId === where.userId &&
              row.dayKey === where.dayKey &&
              row.status !== ImageIntakeUsageStatus.FAILED,
          );
          return { _sum: { imageCount: sameDay.reduce((total, row) => total + row.imageCount, 0) } };
        }
        return { _sum: { costMicroUsd: rows.reduce((total, row) => total + row.costMicroUsd, 0) } };
      }),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            userId: string;
            dayKey: string;
            imageCount: number;
            costMicroUsd: number;
            status: ImageIntakeUsageStatus;
          };
        }) => {
          const row = withRowDefaults({ id: `row-${nextId++}`, ...data }, nextId);
          rows.push(row);
          return { id: row.id };
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { costMicroUsd: number; status: ImageIntakeUsageStatus };
        }) => {
          const row = rows.find((candidate) => candidate.id === where.id);
          if (!row) throw new Error("row not found");
          row.costMicroUsd = data.costMicroUsd;
          row.status = data.status;
          return row;
        },
      ),
    },
  };

  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
  return { tx, rows, periods };
}

const reserveInput = {
  userId: "user-1",
  periodKey: "2026-07",
  dayKey: "2026-07-28",
  entrySource: ImageIntakeEntrySource.IN_APP,
  imageCount: 3,
  model: "gemini-3.1-flash-lite",
  estimatedInputTokens: 3_360,
  estimatedOutputTokens: 500,
  estimatedCostMicroUsd: 1_590,
  now: NOW,
  rateLimitWindowMs: 10_000,
  hardStopMicroUsd: 5_000_000,
  isAdmin: false,
  defaultMonthlyPhotoQuota: 20,
  dailyPhotoCap: 10,
  dailyAttemptCap: 30,
};

/** Rows for one user and day, at the given count, all of them already FAILED. */
function failedAttempts(count: number): Partial<LedgerRow>[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `attempt-${index}`,
    userId: "user-1",
    dayKey: "2026-07-28",
    imageCount: 3,
    costMicroUsd: 560,
    status: ImageIntakeUsageStatus.FAILED,
  }));
}

describe("reserveImageIntakeUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("takes the advisory lock before reading anything or inserting", async () => {
    const { tx } = makeTx();

    await reserveImageIntakeUsage(reserveInput);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const lockOrder = tx.$executeRaw.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(tx.imageIntakeUsage.findFirst.mock.invocationCallOrder[0]);
    expect(lockOrder).toBeLessThan(tx.imageIntakeUsage.aggregate.mock.invocationCallOrder[0]);
    expect(lockOrder).toBeLessThan(tx.imageIntakeUsage.create.mock.invocationCallOrder[0]);
  });

  it("writes a PENDING row holding the estimated cost, with a null orderId", async () => {
    const { tx } = makeTx();

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result).toEqual({
      status: "reserved",
      reservationId: "row-1",
      periodTotalMicroUsdBeforeReservation: 0,
    });
    expect(tx.imageIntakeUsage.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        periodKey: "2026-07",
        dayKey: "2026-07-28",
        entrySource: ImageIntakeEntrySource.IN_APP,
        status: ImageIntakeUsageStatus.PENDING,
        imageCount: 3,
        model: "gemini-3.1-flash-lite",
        inputTokens: 3_360,
        outputTokens: 500,
        costMicroUsd: 1_590,
        orderId: null,
      },
      select: { id: true },
    });
  });

  it("counts PENDING reservations toward the ceiling, so in-flight requests cannot all pass", async () => {
    const { tx } = makeTx({
      rows: [{ id: "row-0", costMicroUsd: 5_000_000, status: ImageIntakeUsageStatus.PENDING }],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result).toEqual({ status: "budget-blocked" });
    expect(tx.imageIntakeUsage.create).not.toHaveBeenCalled();
  });

  it("counts FAILED rows toward the ceiling: a billed failure is still money spent", async () => {
    const { tx } = makeTx({
      rows: [{ id: "row-0", costMicroUsd: 5_000_000, status: ImageIntakeUsageStatus.FAILED }],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result).toEqual({ status: "budget-blocked" });
    expect(tx.imageIntakeUsage.create).not.toHaveBeenCalled();
  });

  it("refuses, and writes nothing, when the user submitted inside the rate-limit window", async () => {
    const { tx } = makeTx({ latestCreatedAt: new Date(NOW.getTime() - 5_000) });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result).toEqual({ status: "rate-limited" });
    expect(tx.imageIntakeUsage.create).not.toHaveBeenCalled();
  });

  it("reserves once the rate-limit window has elapsed", async () => {
    makeTx({ latestCreatedAt: new Date(NOW.getTime() - 11_000) });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result.status).toBe("reserved");
  });

  it("increments the collector's roll-up by the whole batch when it fits", async () => {
    const { periods } = makeTx({
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 5, costMicroUsd: 10 }],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result.status).toBe("reserved");
    expect(periods[0]).toEqual({ userId: "user-1", periodKey: "2026-07", usedPhotos: 8, costMicroUsd: 1_600 });
  });

  it("creates the roll-up on the first submission of a period, with no job having run", async () => {
    const { periods } = makeTx();

    await reserveImageIntakeUsage(reserveInput);

    expect(periods).toEqual([{ userId: "user-1", periodKey: "2026-07", usedPhotos: 3, costMicroUsd: 1_590 }]);
  });

  it("refuses the whole submission, writing nothing, when the batch does not fit the bag", async () => {
    const { tx, periods } = makeTx({
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 18, costMicroUsd: 10 }],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    // Never half a submission: two photos would have fitted, and neither is taken.
    expect(result).toEqual({ status: "quota-exceeded", remaining: 2 });
    expect(tx.imageIntakeUsage.create).not.toHaveBeenCalled();
    expect(periods[0].usedPhotos).toBe(18);
  });

  it("honours a per-user override above the default", async () => {
    makeTx({
      overrideLimit: 50,
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 25, costMicroUsd: 0 }],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result.status).toBe("reserved");
  });

  it("honours a per-user override below the default", async () => {
    makeTx({
      overrideLimit: 4,
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 3, costMicroUsd: 0 }],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result).toEqual({ status: "quota-exceeded", remaining: 1 });
  });

  it("refuses when the day's anti-burst cap cannot cover the batch, even with the bag healthy", async () => {
    const { tx } = makeTx({
      rows: [{ id: "row-0", userId: "user-1", dayKey: "2026-07-28", imageCount: 9, costMicroUsd: 10 }],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result).toEqual({ status: "daily-cap-exceeded", remaining: 1 });
    expect(tx.imageIntakeUsage.create).not.toHaveBeenCalled();
  });

  it("ignores failed rows when counting the day, because a failure costs no photo", async () => {
    makeTx({
      rows: [
        {
          id: "row-0",
          userId: "user-1",
          dayKey: "2026-07-28",
          imageCount: 9,
          costMicroUsd: 10,
          status: ImageIntakeUsageStatus.FAILED,
        },
      ],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result.status).toBe("reserved");
  });

  it("refuses once the day's attempt cap is reached, even though every attempt failed and refunded its photos", async () => {
    // The exact abuse the photo refund would otherwise pay for: thirty deterministic failures cost
    // real money, gave every photo back, and left the bag untouched.
    const { tx } = makeTx({ rows: failedAttempts(30) });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result).toEqual({ status: "daily-attempt-cap-exceeded" });
    expect(tx.imageIntakeUsage.create).not.toHaveBeenCalled();
  });

  it("still reserves on the last attempt below the cap", async () => {
    makeTx({ rows: failedAttempts(29) });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result.status).toBe("reserved");
  });

  it("counts succeeded and pending rows toward the attempt cap as well as failed ones", async () => {
    const mixed = failedAttempts(30).map((row, index) => ({
      ...row,
      status:
        index % 3 === 0
          ? ImageIntakeUsageStatus.SUCCEEDED
          : index % 3 === 1
            ? ImageIntakeUsageStatus.PENDING
            : ImageIntakeUsageStatus.FAILED,
      imageCount: 0,
    }));
    makeTx({ rows: mixed, overrideLimit: 1_000 });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result).toEqual({ status: "daily-attempt-cap-exceeded" });
  });

  it("counts only the same user's own day, not another collector's", async () => {
    makeTx({ rows: failedAttempts(30).map((row) => ({ ...row, userId: "user-2" })) });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result.status).toBe("reserved");
  });

  it("counts only today, so yesterday's exhausted attempts do not block a new day", async () => {
    makeTx({ rows: failedAttempts(30).map((row) => ({ ...row, dayKey: "2026-07-27" })) });

    const result = await reserveImageIntakeUsage(reserveInput);

    expect(result.status).toBe("reserved");
  });

  it("binds an administrator to the attempt cap, because it limits liability rather than an allowance", async () => {
    const { tx } = makeTx({ rows: failedAttempts(30) });

    const result = await reserveImageIntakeUsage({ ...reserveInput, isAdmin: true });

    expect(result).toEqual({ status: "daily-attempt-cap-exceeded" });
    expect(tx.imageIntakeUsage.create).not.toHaveBeenCalled();
  });

  it("leaves the photo caps forgiving failures: the bag is untouched by a day of failed attempts", async () => {
    makeTx({
      rows: failedAttempts(10),
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 0, costMicroUsd: 0 }],
    });

    const result = await reserveImageIntakeUsage(reserveInput);

    // Ten failed attempts of three photos each would have exhausted both the monthly bag and the
    // daily photo cap if failures consumed photos; they do not, so this reservation still passes.
    expect(result.status).toBe("reserved");
  });

  it("gives an administrator no photo cap and no daily cap, while still recording the consumption", async () => {
    const { tx, periods } = makeTx({
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 500, costMicroUsd: 0 }],
      rows: [{ id: "row-0", userId: "user-1", dayKey: "2026-07-28", imageCount: 99, costMicroUsd: 0 }],
    });

    const result = await reserveImageIntakeUsage({ ...reserveInput, isAdmin: true });

    expect(result.status).toBe("reserved");
    expect(tx.user.findUnique).toHaveBeenCalled();
    expect(periods[0].usedPhotos).toBe(503);
  });

  it("still applies the global cut-off to an administrator", async () => {
    makeTx({ rows: [{ id: "row-0", costMicroUsd: 5_000_000 }] });

    const result = await reserveImageIntakeUsage({ ...reserveInput, isAdmin: true });

    expect(result).toEqual({ status: "budget-blocked" });
  });

  it("serializes two reservations by the same collector so they cannot overdraw the bag", async () => {
    // Same advisory-lock behaviour as the spend ceiling: the second request sees the first one's
    // photos already reserved, so together they can never exceed the bag.
    const { tx, periods } = makeTx({
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 16, costMicroUsd: 0 }],
    });
    const serial = prismaMock.$transaction.getMockImplementation();
    let queue: Promise<unknown> = Promise.resolve();
    prismaMock.$transaction.mockImplementation((cb: (client: unknown) => unknown) => {
      const run = queue.then(() => serial?.(cb));
      queue = run.catch(() => undefined);
      return run;
    });

    const [first, second] = await Promise.all([
      reserveImageIntakeUsage(reserveInput),
      reserveImageIntakeUsage(reserveInput),
    ]);

    expect(first.status).toBe("reserved");
    expect(second).toEqual({ status: "quota-exceeded", remaining: 1 });
    expect(tx.imageIntakeUsage.create).toHaveBeenCalledTimes(1);
    expect(periods[0].usedPhotos).toBe(19);
  });

  it("serializes concurrent reservations so the ceiling holds for all of them", async () => {
    // Mimics `pg_advisory_xact_lock(hashtext(periodKey))`: transaction bodies for the same period
    // run one at a time. Both requests here start under a total that is just below the ceiling;
    // only the first may reserve, because the second sees the first reservation's estimate.
    const rows: Partial<LedgerRow>[] = [
      { id: "row-0", costMicroUsd: 4_999_000, status: ImageIntakeUsageStatus.SUCCEEDED },
    ];
    const { tx } = makeTx({ rows });
    const serial = prismaMock.$transaction.getMockImplementation();
    let queue: Promise<unknown> = Promise.resolve();
    prismaMock.$transaction.mockImplementation((cb: (client: unknown) => unknown) => {
      const run = queue.then(() => serial?.(cb));
      queue = run.catch(() => undefined);
      return run;
    });

    const [first, second] = await Promise.all([
      reserveImageIntakeUsage({ ...reserveInput, estimatedCostMicroUsd: 2_000 }),
      reserveImageIntakeUsage({ ...reserveInput, userId: "user-2", estimatedCostMicroUsd: 2_000 }),
    ]);

    expect(first.status).toBe("reserved");
    expect(second).toEqual({ status: "budget-blocked" });
    expect(tx.imageIntakeUsage.create).toHaveBeenCalledTimes(1);
  });
});

describe("settleImageIntakeUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the reservation with the real outcome and reports before/after totals", async () => {
    const { tx, rows } = makeTx({
      rows: [
        { id: "row-1", costMicroUsd: 1_000_000, status: ImageIntakeUsageStatus.SUCCEEDED },
        { id: "row-2", costMicroUsd: 1_590, imageCount: 3, status: ImageIntakeUsageStatus.PENDING },
      ],
    });

    const result = await settleImageIntakeUsage({
      reservationId: "row-2",
      periodKey: "2026-07",
      status: ImageIntakeUsageStatus.SUCCEEDED,
      model: "gemini-3.1-flash-lite",
      inputTokens: 2_240,
      outputTokens: 500,
      costMicroUsd: 1_310,
    });

    expect(result).toEqual({
      periodTotalMicroUsdBefore: 1_000_000,
      periodTotalMicroUsdAfter: 1_001_310,
    });
    expect(tx.imageIntakeUsage.update).toHaveBeenCalledWith({
      where: { id: "row-2" },
      data: {
        status: ImageIntakeUsageStatus.SUCCEEDED,
        model: "gemini-3.1-flash-lite",
        inputTokens: 2_240,
        outputTokens: 500,
        costMicroUsd: 1_310,
      },
    });
    expect(rows[1].costMicroUsd).toBe(1_310);
    expect(rows[1].status).toBe(ImageIntakeUsageStatus.SUCCEEDED);
  });

  it("adds a FAILED settlement's real cost to the period total", async () => {
    makeTx({ rows: [{ id: "row-1", costMicroUsd: 1_590, status: ImageIntakeUsageStatus.PENDING }] });

    const result = await settleImageIntakeUsage({
      reservationId: "row-1",
      periodKey: "2026-07",
      status: ImageIntakeUsageStatus.FAILED,
      model: "gemini-3.1-flash-lite",
      inputTokens: 2_240,
      outputTokens: 0,
      costMicroUsd: 560,
    });

    expect(result).toEqual({ periodTotalMicroUsdBefore: 0, periodTotalMicroUsdAfter: 560 });
  });

  it("takes the advisory lock before reading the reservation or the period total", async () => {
    const { tx } = makeTx({ rows: [{ id: "row-1", costMicroUsd: 1_590, status: ImageIntakeUsageStatus.PENDING }] });

    await settleImageIntakeUsage({
      reservationId: "row-1",
      periodKey: "2026-07",
      status: ImageIntakeUsageStatus.SUCCEEDED,
      model: "gemini-3.1-flash-lite",
      inputTokens: 1,
      outputTokens: 1,
      costMicroUsd: 2,
    });

    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.imageIntakeUsage.findUnique.mock.invocationCallOrder[0],
    );
  });

  it("gives the photos back on a failed settlement, so a provider failure costs the collector nothing", async () => {
    const { periods } = makeTx({
      rows: [
        { id: "row-1", userId: "user-1", imageCount: 3, costMicroUsd: 1_590, status: ImageIntakeUsageStatus.PENDING },
      ],
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 3, costMicroUsd: 1_590 }],
    });

    await settleImageIntakeUsage({
      reservationId: "row-1",
      periodKey: "2026-07",
      status: ImageIntakeUsageStatus.FAILED,
      model: "gemini-3.1-flash-lite",
      inputTokens: 2_240,
      outputTokens: 0,
      costMicroUsd: 560,
    });

    // Photos back, money kept: the request may still have been billed.
    expect(periods[0]).toEqual({ userId: "user-1", periodKey: "2026-07", usedPhotos: 0, costMicroUsd: 560 });
  });

  it("keeps the photos on a successful settlement and corrects the roll-up cost", async () => {
    const { periods } = makeTx({
      rows: [
        { id: "row-1", userId: "user-1", imageCount: 3, costMicroUsd: 1_590, status: ImageIntakeUsageStatus.PENDING },
      ],
      periods: [{ userId: "user-1", periodKey: "2026-07", usedPhotos: 3, costMicroUsd: 1_590 }],
    });

    await settleImageIntakeUsage({
      reservationId: "row-1",
      periodKey: "2026-07",
      status: ImageIntakeUsageStatus.SUCCEEDED,
      model: "gemini-3.1-flash-lite",
      inputTokens: 2_240,
      outputTokens: 500,
      costMicroUsd: 1_310,
    });

    expect(periods[0]).toEqual({ userId: "user-1", periodKey: "2026-07", usedPhotos: 3, costMicroUsd: 1_310 });
  });

  it("throws when the reservation does not exist", async () => {
    makeTx({ rows: [] });

    await expect(
      settleImageIntakeUsage({
        reservationId: "missing",
        periodKey: "2026-07",
        status: ImageIntakeUsageStatus.SUCCEEDED,
        model: "gemini-3.1-flash-lite",
        inputTokens: 1,
        outputTokens: 1,
        costMicroUsd: 2,
      }),
    ).rejects.toThrow("IMAGE_INTAKE_RESERVATION_NOT_FOUND");
  });

  it("throws instead of double counting an already settled reservation", async () => {
    const { tx } = makeTx({ rows: [{ id: "row-1", costMicroUsd: 1_310, status: ImageIntakeUsageStatus.SUCCEEDED }] });

    await expect(
      settleImageIntakeUsage({
        reservationId: "row-1",
        periodKey: "2026-07",
        status: ImageIntakeUsageStatus.SUCCEEDED,
        model: "gemini-3.1-flash-lite",
        inputTokens: 1,
        outputTokens: 1,
        costMicroUsd: 2,
      }),
    ).rejects.toThrow("IMAGE_INTAKE_RESERVATION_ALREADY_SETTLED");
    expect(tx.imageIntakeUsage.update).not.toHaveBeenCalled();
  });

  it("propagates a write failure instead of swallowing it", async () => {
    const { tx } = makeTx({ rows: [{ id: "row-1", costMicroUsd: 1_590, status: ImageIntakeUsageStatus.PENDING }] });
    tx.imageIntakeUsage.update.mockRejectedValue(new Error("DB_WRITE_FAILED"));

    await expect(
      settleImageIntakeUsage({
        reservationId: "row-1",
        periodKey: "2026-07",
        status: ImageIntakeUsageStatus.SUCCEEDED,
        model: "gemini-3.1-flash-lite",
        inputTokens: 1,
        outputTokens: 1,
        costMicroUsd: 2,
      }),
    ).rejects.toThrow("DB_WRITE_FAILED");
  });
});
