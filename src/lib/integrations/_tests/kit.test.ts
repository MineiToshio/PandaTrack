import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `createSubscriber` and `tagSubscriberByEmail` are thin wrappers around `fetch`, so these tests
 * drive them through a stubbed global `fetch` rather than mocking the module itself, following the
 * same pattern as `src/lib/integrations/_tests/resend.test.ts`.
 */
let fetchMock: ReturnType<typeof vi.fn>;

function okSubscriberResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      subscriber: {
        id: 1,
        first_name: null,
        email_address: "user@example.com",
        state: "active",
        created_at: "",
        fields: {},
      },
    }),
  } as unknown as Response;
}

function okTagResponse(): Response {
  return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  process.env.KIT_API_KEY = "test-api-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

async function loadModule() {
  vi.resetModules();
  return import("../kit");
}

describe("createSubscriber", () => {
  it("sends a request bounded by a timeout, so a hung connection cannot block the caller forever", async () => {
    fetchMock.mockResolvedValue(okSubscriberResponse());
    const { createSubscriber } = await loadModule();

    await createSubscriber({ email: "user@example.com" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // A real `AbortSignal.timeout(...)` result is not deep-equal-comparable to anything but itself,
    // so the shape under test is "a signal was actually attached", not its exact value.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("tagSubscriberByEmail", () => {
  it("sends a request bounded by a timeout, so a hung connection cannot block the caller forever", async () => {
    fetchMock.mockResolvedValue(okTagResponse());
    const { tagSubscriberByEmail } = await loadModule();

    await tagSubscriberByEmail(123, "user@example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
