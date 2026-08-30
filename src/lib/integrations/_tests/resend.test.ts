import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `sendEmailWithResend` is a thin wrapper around `fetch`, so every test drives it through a stubbed
 * global `fetch` rather than mocking the module itself, following the same pattern as
 * `src/lib/fx/_tests/exchangeRates.test.ts`.
 */
let fetchMock: ReturnType<typeof vi.fn>;

function okResponse(): Response {
  return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
}

function errorResponse(status: number, message = "failure"): Response {
  return { ok: false, status, statusText: "error", json: async () => ({ message }) } as unknown as Response;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  process.env.RESEND_API_KEY = "test-api-key";
  process.env.RESEND_FROM_EMAIL = "noreply@pandatrack.app";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

async function loadModule() {
  vi.resetModules();
  return import("../resend");
}

describe("sendEmailWithResend", () => {
  it("sends a request bounded by a timeout, so a hung connection cannot block the caller forever", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const { sendEmailWithResend } = await loadModule();

    await sendEmailWithResend({ to: "user@example.com", subject: "Subject", text: "Body" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // A real `AbortSignal.timeout(...)` result is not deep-equal-comparable to anything but itself,
    // so the shape under test is "a signal was actually attached", not its exact value.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not retry a 4xx: Resend refused what we sent, and it will refuse it identically again", async () => {
    fetchMock.mockResolvedValue(errorResponse(400, "invalid `to` field"));
    const { sendEmailWithResend } = await loadModule();

    await expect(sendEmailWithResend({ to: "user@example.com", subject: "s", text: "b" })).rejects.toThrow(
      /invalid `to` field/,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a 5xx and succeeds if the retry clears", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(503, "upstream unavailable")).mockResolvedValueOnce(okResponse());
    const { sendEmailWithResend } = await loadModule();

    await expect(sendEmailWithResend({ to: "user@example.com", subject: "s", text: "b" })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry when every attempt returns a 5xx", async () => {
    fetchMock.mockResolvedValue(errorResponse(500, "still down"));
    const { sendEmailWithResend } = await loadModule();

    await expect(sendEmailWithResend({ to: "user@example.com", subject: "s", text: "b" })).rejects.toThrow(
      /still down/,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once on a network failure (fetch rejecting, including a client-side timeout) and succeeds if the retry clears", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted.", "TimeoutError"));
    fetchMock.mockResolvedValueOnce(okResponse());
    const { sendEmailWithResend } = await loadModule();

    await expect(sendEmailWithResend({ to: "user@example.com", subject: "s", text: "b" })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry when every attempt is a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { sendEmailWithResend } = await loadModule();

    await expect(sendEmailWithResend({ to: "user@example.com", subject: "s", text: "b" })).rejects.toThrow(
      "fetch failed",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
