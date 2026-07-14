import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, createStoreProductTypeRequestMock, posthogCaptureMock, captureExceptionMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    createStoreProductTypeRequestMock: vi.fn(),
    posthogCaptureMock: vi.fn(),
    captureExceptionMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/stores/storeGovernanceMutations", () => ({
  createStoreProductTypeRequest: createStoreProductTypeRequestMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { saveStoreProductTypeRequest } from "../saveStoreProductTypeRequest";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("locale", overrides.locale ?? "en");
  formData.set("source", overrides.source ?? "create");
  formData.set("suggestedName", overrides.suggestedName ?? "Vinyl figures");
  if (overrides.reason !== undefined) formData.set("reason", overrides.reason);
  return formData;
}

describe("saveStoreProductTypeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await saveStoreProductTypeRequest(null, buildFormData());

    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(createStoreProductTypeRequestMock).not.toHaveBeenCalled();
  });

  it("rejects input that fails validation without capturing to Sentry", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await saveStoreProductTypeRequest(null, buildFormData({ suggestedName: "" }));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("validation_failed");
    expect(createStoreProductTypeRequestMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("persists the request and tracks the event on the happy path", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    createStoreProductTypeRequestMock.mockResolvedValue(undefined);

    const result = await saveStoreProductTypeRequest(null, buildFormData({ reason: "Popular category" }));

    expect(result).toEqual({ success: true });
    expect(createStoreProductTypeRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      suggestedName: "Vinyl figures",
      reason: "Popular category",
    });
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.STORE.PRODUCT_TYPE_REQUEST_SUBMITTED,
      properties: {
        source: "create",
        suggested_name_length: "Vinyl figures".length,
        has_reason: true,
      },
    });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("captures an unexpected failure once and returns the generic error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    const unexpected = new Error("db down");
    createStoreProductTypeRequestMock.mockRejectedValue(unexpected);

    const result = await saveStoreProductTypeRequest(null, buildFormData());

    expect(result).toEqual({ success: false, error: "saveProductTypeRequestFailed" });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(unexpected);
  });
});
