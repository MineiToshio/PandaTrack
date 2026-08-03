import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reserveMock, settleMock, sendEmailWithResendMock, captureExceptionMock, captureMessageMock } = vi.hoisted(
  () => ({
    reserveMock: vi.fn(),
    settleMock: vi.fn(),
    sendEmailWithResendMock: vi.fn(),
    captureExceptionMock: vi.fn(),
    captureMessageMock: vi.fn(),
  }),
);

vi.mock("../imageIntakeMutations", () => ({
  reserveImageIntakeUsage: reserveMock,
  settleImageIntakeUsage: settleMock,
}));
vi.mock("@/lib/integrations/resend", () => ({ sendEmailWithResend: sendEmailWithResendMock }));
vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  captureMessage: captureMessageMock,
}));

import { ImageIntakeEntrySource, ImageIntakeUsageStatus } from "../../../../../generated/prisma/client";
import {
  extract,
  SpendGuardBlockedError,
  type ExtractionContext,
  type ExtractionProvider,
  type ImagePart,
} from "@/lib/imageIntake/extractionEngine";
import {
  DAILY_ATTEMPT_CAP,
  DAILY_PHOTO_CAP,
  DEFAULT_MONTHLY_PHOTO_QUOTA,
  IMAGE_INTAKE_MAX_OUTPUT_TOKENS,
} from "@/lib/imageIntake/constants";
import { createImageIntakeSpendGuard } from "../spendGuard";

const ENV_KEYS = [
  "IMAGE_INTAKE_SPEND_ALERT_USD",
  "IMAGE_INTAKE_SPEND_HARD_STOP_USD",
  "IMAGE_INTAKE_ALERT_EMAIL",
] as const;

let originalEnv: Record<(typeof ENV_KEYS)[number], string | undefined>;

const NOW = new Date("2026-07-28T12:00:00Z");
const MODEL_ID = "gemini-3.1-flash-lite";

beforeEach(() => {
  vi.clearAllMocks();
  // The guard compares the injected clock against the server clock, so the server clock is pinned
  // here instead of being whatever the machine running the suite happens to say.
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as typeof originalEnv;
  for (const key of ENV_KEYS) delete process.env[key];
  reserveMock.mockResolvedValue({
    status: "reserved",
    reservationId: "res-1",
    periodTotalMicroUsdBeforeReservation: 0,
  });
  settleMock.mockResolvedValue({ periodTotalMicroUsdBefore: 0, periodTotalMicroUsdAfter: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function buildGuard(overrides: Partial<Parameters<typeof createImageIntakeSpendGuard>[0]> = {}) {
  return createImageIntakeSpendGuard({
    userId: "user-1",
    entrySource: ImageIntakeEntrySource.IN_APP,
    now: NOW,
    imageCount: 2,
    model: MODEL_ID,
    isAdmin: false,
    ...overrides,
  });
}

describe("createImageIntakeSpendGuard: env validation", () => {
  it("throws at construction when the hard stop override is not numeric", () => {
    process.env.IMAGE_INTAKE_SPEND_HARD_STOP_USD = "not-a-number";
    expect(() => buildGuard()).toThrow();
  });

  it("throws at construction when the alert email override is not a valid email", () => {
    process.env.IMAGE_INTAKE_ALERT_EMAIL = "not-an-email";
    expect(() => buildGuard()).toThrow();
  });

  it("throws at construction when the alert threshold sits above the hard stop", () => {
    process.env.IMAGE_INTAKE_SPEND_ALERT_USD = "9";
    process.env.IMAGE_INTAKE_SPEND_HARD_STOP_USD = "5";
    expect(() => buildGuard()).toThrow(/must not exceed/i);
  });

  it("accepts an alert threshold equal to the hard stop", () => {
    process.env.IMAGE_INTAKE_SPEND_ALERT_USD = "5";
    process.env.IMAGE_INTAKE_SPEND_HARD_STOP_USD = "5";
    expect(() => buildGuard()).not.toThrow();
  });

  it("builds successfully with the documented defaults (alert $4, hard stop $5) when unset", () => {
    expect(() => buildGuard()).not.toThrow();
  });
});

describe("createImageIntakeSpendGuard: photo quota refusals", () => {
  it("passes the product's photo limits and the caller's admin flag to the reservation", async () => {
    const guard = buildGuard({ isAdmin: true });

    await guard.assertCanSpend();

    expect(reserveMock.mock.calls[0][0]).toMatchObject({
      isAdmin: true,
      defaultMonthlyPhotoQuota: DEFAULT_MONTHLY_PHOTO_QUOTA,
      dailyPhotoCap: DAILY_PHOTO_CAP,
    });
  });

  it("carries the remaining balance on a monthly quota refusal", async () => {
    reserveMock.mockResolvedValue({ status: "quota-exceeded", remaining: 3 });
    const guard = buildGuard();

    const error = await guard.assertCanSpend().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(SpendGuardBlockedError);
    expect(error).toMatchObject({ code: "quota-exceeded", remaining: 3 });
  });

  it("carries the remaining balance on a daily cap refusal", async () => {
    reserveMock.mockResolvedValue({ status: "daily-cap-exceeded", remaining: 1 });
    const guard = buildGuard();

    const error = await guard.assertCanSpend().catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({ code: "daily-cap-exceeded", remaining: 1 });
  });

  it("reaches the extraction engine as a typed outcome carrying the balance", async () => {
    reserveMock.mockResolvedValue({ status: "quota-exceeded", remaining: 2 });
    const provider: ExtractionProvider = { generateDraft: vi.fn() };
    const context: ExtractionContext = { baseCurrency: "PEN", now: NOW, locale: "es", productCategories: [] };

    const outcome = await extract([] as ImagePart[], context, { provider, spendGuard: buildGuard() }, MODEL_ID);

    expect(outcome).toEqual({ status: "quota-exceeded", remaining: 2 });
    expect(provider.generateDraft).not.toHaveBeenCalled();
  });
});

describe("createImageIntakeSpendGuard: clock handling", () => {
  it("uses the caller's clock when it is close to the server clock", async () => {
    const guard = buildGuard({ now: new Date(NOW.getTime() - 60_000) });

    await guard.assertCanSpend();

    expect(reserveMock.mock.calls[0][0]).toMatchObject({ periodKey: "2026-07", dayKey: "2026-07-28" });
  });

  it("falls back to the server clock when the caller's clock is implausibly far off", async () => {
    // A skewed clock would otherwise write into another billing period and read a rate-limit
    // window that has "already" elapsed; the injected clock exists for tests, not for trust.
    const guard = buildGuard({ now: new Date("2025-01-15T00:00:00Z") });

    await guard.assertCanSpend();

    expect(reserveMock.mock.calls[0][0]).toMatchObject({
      periodKey: "2026-07",
      dayKey: "2026-07-28",
      now: NOW,
    });
  });

  it("falls back to the server clock when the caller's clock is not a usable date", async () => {
    const guard = buildGuard({ now: new Date("not-a-date") });

    await guard.assertCanSpend();

    expect(reserveMock.mock.calls[0][0]).toMatchObject({ periodKey: "2026-07", now: NOW });
  });
});

describe("assertCanSpend: reservation", () => {
  it("reserves a PENDING row with the pre-call estimate and the caller's thresholds", async () => {
    const guard = buildGuard({ imageCount: 3 });

    await guard.assertCanSpend();

    // 3 images * 1120 input tokens * 0.25 USD/M = 840 micro-USD, plus the worst-case 32,000 output
    // tokens * 1.50 USD/M = 48,000 micro-USD.
    expect(reserveMock).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      periodKey: "2026-07",
      dayKey: "2026-07-28",
      entrySource: ImageIntakeEntrySource.IN_APP,
      imageCount: 3,
      model: MODEL_ID,
      estimatedInputTokens: 3_360,
      estimatedOutputTokens: 32_000,
      estimatedCostMicroUsd: 48_840,
      now: NOW,
      rateLimitWindowMs: 10_000,
      hardStopMicroUsd: 5_000_000,
      isAdmin: false,
      defaultMonthlyPhotoQuota: DEFAULT_MONTHLY_PHOTO_QUOTA,
      dailyPhotoCap: DAILY_PHOTO_CAP,
      dailyAttemptCap: DAILY_ATTEMPT_CAP,
    });
  });

  it("reserves the provider's own output ceiling, never a typical-case output estimate", async () => {
    const guard = buildGuard({ imageCount: 1 });

    await guard.assertCanSpend();

    // Pinned to the same constant the request sends as `maxOutputTokens`, so the reservation can
    // never be smaller than what the provider is allowed to bill. A cheaper estimate here would let
    // concurrent requests each pass the ceiling check and together overshoot the ceiling.
    const [call] = reserveMock.mock.calls[0];
    expect(call.estimatedOutputTokens).toBe(IMAGE_INTAKE_MAX_OUTPUT_TOKENS);
    expect(call.estimatedCostMicroUsd).toBe(Math.round(1_120 * 0.25 + IMAGE_INTAKE_MAX_OUTPUT_TOKENS * 1.5));
  });

  it("maps the daily attempt cap refusal to its own code, with no personal balance attached", async () => {
    reserveMock.mockResolvedValue({ status: "daily-attempt-cap-exceeded" });
    const guard = buildGuard();

    const error = await guard.assertCanSpend().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(SpendGuardBlockedError);
    expect(error).toMatchObject({ code: "daily-attempt-cap-exceeded", remaining: null });
  });

  it("reaches the extraction engine as its own typed outcome", async () => {
    reserveMock.mockResolvedValue({ status: "daily-attempt-cap-exceeded" });
    const provider: ExtractionProvider = { generateDraft: vi.fn() };
    const context: ExtractionContext = { baseCurrency: "PEN", now: NOW, locale: "es", productCategories: [] };

    const outcome = await extract([] as ImagePart[], context, { provider, spendGuard: buildGuard() }, MODEL_ID);

    expect(outcome).toEqual({ status: "daily-attempt-cap-exceeded" });
    expect(provider.generateDraft).not.toHaveBeenCalled();
  });

  it("maps a budget refusal from the ledger to SpendGuardBlockedError(budget-blocked)", async () => {
    reserveMock.mockResolvedValue({ status: "budget-blocked" });
    const guard = buildGuard();

    await expect(guard.assertCanSpend()).rejects.toBeInstanceOf(SpendGuardBlockedError);
    await expect(guard.assertCanSpend()).rejects.toMatchObject({ code: "budget-blocked" });
  });

  it("maps a rate-limit refusal from the ledger to its own code", async () => {
    reserveMock.mockResolvedValue({ status: "rate-limited" });
    const guard = buildGuard();

    await expect(guard.assertCanSpend()).rejects.toMatchObject({ code: "rate-limited" });
  });

  it("fails closed and reports to Sentry when the ledger write throws", async () => {
    reserveMock.mockRejectedValue(new Error("DB_UNAVAILABLE"));
    const guard = buildGuard();

    await expect(guard.assertCanSpend()).rejects.toBeInstanceOf(SpendGuardBlockedError);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("reports an unreadable ledger as a ledger failure, never as a budget that ran out", async () => {
    // Advisory-lock contention surfaces here as a transaction timeout. Refusing is right; telling
    // the collector their spend ran out is not, and it points them at the wrong remedy.
    reserveMock.mockRejectedValue(new Error("Transaction API error: transaction already closed"));
    const guard = buildGuard();

    await expect(guard.assertCanSpend()).rejects.toMatchObject({ code: "ledger-error" });
  });

  it("stops the extraction before any provider call when the ledger is unreadable", async () => {
    reserveMock.mockRejectedValue(new Error("DB_UNAVAILABLE"));
    const provider: ExtractionProvider = { generateDraft: vi.fn() };
    const context: ExtractionContext = { baseCurrency: "PEN", now: NOW, locale: "es", productCategories: [] };

    const outcome = await extract([] as ImagePart[], context, { provider, spendGuard: buildGuard() }, MODEL_ID);

    expect(outcome).toEqual({ status: "ledger-error" });
    expect(provider.generateDraft).not.toHaveBeenCalled();
  });

  it("refuses via extract() before any provider call once blocked", async () => {
    reserveMock.mockResolvedValue({ status: "budget-blocked" });
    const guard = buildGuard();
    const provider: ExtractionProvider = { generateDraft: vi.fn() };
    const images: ImagePart[] = [{ data: Buffer.from("x"), mimeType: "image/webp" }];
    const context: ExtractionContext = { baseCurrency: "USD", now: NOW, locale: "es", productCategories: [] };

    const outcome = await extract(images, context, { provider, spendGuard: guard }, MODEL_ID);

    expect(outcome).toEqual({ status: "budget-blocked" });
    expect(provider.generateDraft).not.toHaveBeenCalled();
  });
});

describe("recordUsage and recordFailure: settling the reservation", () => {
  it("settles the reserved row as SUCCEEDED with the real tokens and cost", async () => {
    const guard = buildGuard();
    await guard.assertCanSpend();

    await guard.recordUsage({ model: MODEL_ID, inputTokens: 2_240, outputTokens: 500, costMicroUsd: 1_310 });

    expect(settleMock).toHaveBeenCalledExactlyOnceWith({
      reservationId: "res-1",
      periodKey: "2026-07",
      status: ImageIntakeUsageStatus.SUCCEEDED,
      model: MODEL_ID,
      inputTokens: 2_240,
      outputTokens: 500,
      costMicroUsd: 1_310,
    });
  });

  it("settles the reserved row as FAILED with the provider-reported tokens", async () => {
    const guard = buildGuard();
    await guard.assertCanSpend();

    await guard.recordFailure({ model: MODEL_ID, inputTokens: 2_240, outputTokens: 500 });

    expect(settleMock).toHaveBeenCalledExactlyOnceWith({
      reservationId: "res-1",
      periodKey: "2026-07",
      status: ImageIntakeUsageStatus.FAILED,
      model: MODEL_ID,
      inputTokens: 2_240,
      outputTokens: 500,
      costMicroUsd: 1_310,
    });
  });

  it("keeps the reservation's worst-case estimate when the failure reported no tokens at all", async () => {
    const guard = buildGuard({ imageCount: 2 });
    await guard.assertCanSpend();

    await guard.recordFailure(null);

    // A request that never reported tokens may still have been billed for anything up to the
    // output ceiling, so the reservation's own worst-case figure stands rather than being lowered.
    expect(settleMock).toHaveBeenCalledExactlyOnceWith({
      reservationId: "res-1",
      periodKey: "2026-07",
      status: ImageIntakeUsageStatus.FAILED,
      model: MODEL_ID,
      inputTokens: 2_240,
      outputTokens: 32_000,
      costMicroUsd: 48_560,
    });
  });

  it("throws on settlement without an active reservation, instead of writing an orphan row", async () => {
    const guard = buildGuard();

    await expect(
      guard.recordUsage({ model: MODEL_ID, inputTokens: 1, outputTokens: 1, costMicroUsd: 2 }),
    ).rejects.toThrow(/no active reservation/i);
    await expect(guard.recordFailure(null)).rejects.toThrow(/no active reservation/i);
    expect(settleMock).not.toHaveBeenCalled();
  });

  it("throws rather than settling the same reservation twice", async () => {
    const guard = buildGuard();
    await guard.assertCanSpend();
    await guard.recordUsage({ model: MODEL_ID, inputTokens: 1, outputTokens: 1, costMicroUsd: 2 });

    await expect(guard.recordFailure(null)).rejects.toThrow(/no active reservation/i);
    expect(settleMock).toHaveBeenCalledOnce();
  });

  it("propagates a settlement failure so extract() can fail closed", async () => {
    settleMock.mockRejectedValue(new Error("DB_WRITE_FAILED"));
    const guard = buildGuard();
    await guard.assertCanSpend();

    await expect(
      guard.recordUsage({ model: MODEL_ID, inputTokens: 1, outputTokens: 1, costMicroUsd: 2 }),
    ).rejects.toThrow("DB_WRITE_FAILED");
  });
});

describe("every failure path leaves a ledger row", () => {
  const images: ImagePart[] = [{ data: Buffer.from("x"), mimeType: "image/webp" }];
  const context: ExtractionContext = { baseCurrency: "USD", now: NOW, locale: "es", productCategories: [] };

  it("settles the reservation as FAILED when the model answers with an unusable draft", async () => {
    const guard = buildGuard();
    const provider: ExtractionProvider = {
      generateDraft: vi
        .fn()
        .mockResolvedValue({ raw: { not: "a draft" }, usage: { inputTokens: 900, outputTokens: 40 } }),
    };

    const outcome = await extract(images, context, { provider, spendGuard: guard }, MODEL_ID);

    expect(outcome.status).toBe("invalid-model-response");
    expect(settleMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: ImageIntakeUsageStatus.FAILED, inputTokens: 900, outputTokens: 40 }),
    );
  });
});

describe("alert threshold crossing", () => {
  it("fires the email exactly once, on the settlement that crosses the threshold", async () => {
    process.env.IMAGE_INTAKE_ALERT_EMAIL = "alerts@pandatrack.app";
    const usage = { model: MODEL_ID, inputTokens: 100, outputTokens: 50, costMicroUsd: 3_000_000 };

    const crossings = [
      { periodTotalMicroUsdBefore: 0, periodTotalMicroUsdAfter: 3_000_000 },
      { periodTotalMicroUsdBefore: 3_000_000, periodTotalMicroUsdAfter: 6_000_000 },
      { periodTotalMicroUsdBefore: 6_000_000, periodTotalMicroUsdAfter: 9_000_000 },
    ];

    for (const crossing of crossings) {
      settleMock.mockResolvedValueOnce(crossing);
      const guard = buildGuard();
      await guard.assertCanSpend();
      await guard.recordUsage(usage);
    }

    expect(sendEmailWithResendMock).toHaveBeenCalledTimes(1);
  });

  it("fires on a FAILED settlement too: a billed failure spends the same money", async () => {
    process.env.IMAGE_INTAKE_ALERT_EMAIL = "alerts@pandatrack.app";
    settleMock.mockResolvedValue({ periodTotalMicroUsdBefore: 3_900_000, periodTotalMicroUsdAfter: 4_100_000 });
    const guard = buildGuard();
    await guard.assertCanSpend();

    await guard.recordFailure({ model: MODEL_ID, inputTokens: 100, outputTokens: 50 });

    expect(sendEmailWithResendMock).toHaveBeenCalledTimes(1);
  });

  it("reports the crossing to monitoring, and never emails, when IMAGE_INTAKE_ALERT_EMAIL is empty", async () => {
    process.env.IMAGE_INTAKE_ALERT_EMAIL = "";
    settleMock.mockResolvedValue({ periodTotalMicroUsdBefore: 0, periodTotalMicroUsdAfter: 5_000_000 });
    const guard = buildGuard();
    await guard.assertCanSpend();

    await guard.recordUsage({ model: MODEL_ID, inputTokens: 100, outputTokens: 50, costMicroUsd: 5_000_000 });

    expect(sendEmailWithResendMock).not.toHaveBeenCalled();
    expect(captureMessageMock).toHaveBeenCalledTimes(1);
    expect(captureMessageMock.mock.calls[0][1]).toMatchObject({ level: "warning" });
  });

  it("carries only aggregate figures: no user id, order id, or extracted content in the email", async () => {
    process.env.IMAGE_INTAKE_ALERT_EMAIL = "alerts@pandatrack.app";
    settleMock.mockResolvedValue({ periodTotalMicroUsdBefore: 0, periodTotalMicroUsdAfter: 5_000_000 });
    const guard = buildGuard({ userId: "user-secret-identity" });
    await guard.assertCanSpend();

    await guard.recordUsage({ model: MODEL_ID, inputTokens: 100, outputTokens: 50, costMicroUsd: 5_000_000 });

    expect(sendEmailWithResendMock).toHaveBeenCalledTimes(1);
    const [emailArgs] = sendEmailWithResendMock.mock.calls[0];
    const serialized = `${emailArgs.subject}\n${emailArgs.text}`;
    expect(serialized).not.toContain("user-secret-identity");
    expect(serialized).toMatch(/\$\d+\.\d{2}/); // only dollar figures, no names/phones/content
  });

  it("never lets a failed alert email surface as an extraction failure", async () => {
    process.env.IMAGE_INTAKE_ALERT_EMAIL = "alerts@pandatrack.app";
    sendEmailWithResendMock.mockRejectedValue(new Error("RESEND_DOWN"));
    settleMock.mockResolvedValue({ periodTotalMicroUsdBefore: 0, periodTotalMicroUsdAfter: 5_000_000 });
    const guard = buildGuard();
    await guard.assertCanSpend();

    await expect(
      guard.recordUsage({ model: MODEL_ID, inputTokens: 100, outputTokens: 50, costMicroUsd: 5_000_000 }),
    ).resolves.toBeUndefined();
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});
