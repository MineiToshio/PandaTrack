import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { Prisma } from "../../../../../generated/prisma/client";
import { POINT_RULE_KEYS, PROGRESSION_ENTITY_TYPES } from "../pointRules";
import { awardPoints, type AwardPointsInput } from "../progressionMutations";
import { civilDay } from "./progressionFixtures";

function duplicateKeyError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

/** A `tx` carrying only what `awardPoints` actually calls. */
function makeTx(create = vi.fn().mockResolvedValue({ id: "entry-1" })) {
  return { create, tx: { pointLedgerEntry: { create } } };
}

const VALID_INPUT: AwardPointsInput = {
  userId: "user-1",
  ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
  entityType: PROGRESSION_ENTITY_TYPES.ORDER,
  entityId: "order-1",
  points: 5,
  occurredOn: civilDay(2026, 3, 10),
  source: "LIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("awardPoints", () => {
  it("writes one entry the first time a key is seen", async () => {
    const { create, tx } = makeTx();

    await expect(awardPoints(tx as never, VALID_INPUT)).resolves.toEqual({ credited: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      userId: "user-1",
      ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
      entityType: PROGRESSION_ENTITY_TYPES.ORDER,
      entityId: "order-1",
      points: 5,
      source: "LIVE",
    });
  });

  it("resolves rather than throwing when the key already exists", async () => {
    const create = vi.fn().mockRejectedValue(duplicateKeyError());
    const { tx } = makeTx(create);

    // A repeated credit is an ordinary outcome, not a failure: re-marking a delivery arrived or
    // retrying a Server Action must not surface an error to a collector who did nothing wrong.
    await expect(awardPoints(tx as never, VALID_INPUT)).resolves.toEqual({ credited: false });
  });

  it("lets exactly one of two racing writes win, and the loser resolves (no TOCTOU)", async () => {
    // The database refuses the duplicate; nothing here checked "does it exist yet" first, which is
    // the read-then-write both retries would have passed simultaneously.
    let written = 0;
    const create = vi.fn().mockImplementation(async () => {
      if (written > 0) throw duplicateKeyError();
      written += 1;
      return { id: "entry-1" };
    });
    const { tx } = makeTx(create);

    const results = await Promise.all([awardPoints(tx as never, VALID_INPUT), awardPoints(tx as never, VALID_INPUT)]);

    expect(written).toBe(1);
    expect(results.filter((result) => result.credited)).toHaveLength(1);
    expect(results.filter((result) => !result.credited)).toHaveLength(1);
  });

  it("propagates a genuine database failure instead of reporting it as a duplicate", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connection reset"));
    const { tx } = makeTx(create);

    await expect(awardPoints(tx as never, VALID_INPUT)).rejects.toThrow("connection reset");
  });

  it.each([0, -5])("refuses %i points before writing anything (BR-12-05)", async (points) => {
    const { create, tx } = makeTx();

    await expect(awardPoints(tx as never, { ...VALID_INPUT, points })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a fractional point value before writing anything", async () => {
    const { create, tx } = makeTx();

    await expect(awardPoints(tx as never, { ...VALID_INPUT, points: 2.5 })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a rule key the catalogue does not define", async () => {
    const { create, tx } = makeTx();

    await expect(awardPoints(tx as never, { ...VALID_INPUT, ruleKey: "invented-rule" })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses an occurredOn that is not a civil day at UTC midnight (BR-12-17)", async () => {
    const { create, tx } = makeTx();

    // A picker's local midnight from Lima arrives as 05:00Z; storing it would file the credit under
    // the wrong day and, at a month boundary, under the wrong monthly cap.
    await expect(
      awardPoints(tx as never, { ...VALID_INPUT, occurredOn: new Date("2026-03-10T05:00:00.000Z") }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a civil day well beyond any real timezone offset", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
    const { create, tx } = makeTx();

    await expect(awardPoints(tx as never, { ...VALID_INPUT, occurredOn: civilDay(2026, 3, 20) })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("accepts the civil day of a collector east of UTC, whose day starts before the server's", async () => {
    // 08:00 in Tokyo on the 11th is still 23:00 UTC on the 10th, so the correct civil day is
    // legitimately an hour ahead of the server's clock. Refusing it would break every such credit.
    vi.useFakeTimers().setSystemTime(new Date("2026-03-10T23:00:00.000Z"));
    const { create, tx } = makeTx();

    await expect(awardPoints(tx as never, { ...VALID_INPUT, occurredOn: civilDay(2026, 3, 11) })).resolves.toEqual({
      credited: true,
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each(["LIVE", "BACKFILL"] as const)("persists source %s verbatim (BR-12-12)", async (source) => {
    const { create, tx } = makeTx();

    await awardPoints(tx as never, { ...VALID_INPUT, source });

    expect(create.mock.calls[0][0].data.source).toBe(source);
  });

  it("joins the caller's transaction instead of opening one of its own (FR-12-12)", async () => {
    const { create, tx } = makeTx();

    await awardPoints(tx as never, VALID_INPUT);

    // The credit has to be able to roll back with the business write it rode in on.
    expect(create).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
