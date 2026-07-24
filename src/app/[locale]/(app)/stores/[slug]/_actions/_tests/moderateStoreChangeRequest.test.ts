import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  getPostHogClientMock,
  captureMock,
  getEditableStoreBySlugMock,
  applyStoreChangeRequestMock,
  rejectStoreChangeRequestMock,
  revalidatePathMock,
  captureExceptionMock,
  AdminAccessError,
  StoreChangeRequestError,
} = vi.hoisted(() => {
  class AdminAccessError extends Error {
    constructor() {
      super("admin access required");
      this.name = "AdminAccessError";
    }
  }
  class StoreChangeRequestError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "StoreChangeRequestError";
      this.code = code;
    }
  }
  return {
    requireAdminMock: vi.fn(),
    getPostHogClientMock: vi.fn(),
    captureMock: vi.fn(),
    getEditableStoreBySlugMock: vi.fn(),
    applyStoreChangeRequestMock: vi.fn(),
    rejectStoreChangeRequestMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    captureExceptionMock: vi.fn(),
    AdminAccessError,
    StoreChangeRequestError,
  };
});

vi.mock("@/lib/auth/auth-server", () => ({ requireAdmin: requireAdminMock, AdminAccessError }));
vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));
vi.mock("@/lib/data/stores/storeGovernanceQueries", () => ({ getEditableStoreBySlug: getEditableStoreBySlugMock }));
vi.mock("@/lib/data/stores/storeGovernanceMutations", () => ({
  applyStoreChangeRequest: applyStoreChangeRequestMock,
  rejectStoreChangeRequest: rejectStoreChangeRequestMock,
  StoreChangeRequestError,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { applyStoreChangeRequestAction, rejectStoreChangeRequestAction } from "../moderateStoreChangeRequest";

const ADMIN_SESSION = { user: { id: "admin-1" } };
const INPUT = { slug: "store-one", locale: "en", changeRequestId: "cr-1" };
const STORE = { id: "store-1", slug: "store-one" };

beforeEach(() => {
  vi.clearAllMocks();
  getPostHogClientMock.mockReturnValue({ capture: captureMock, shutdown: vi.fn() });
  getEditableStoreBySlugMock.mockResolvedValue(STORE);
});

describe("applyStoreChangeRequestAction gating", () => {
  it("refuses a non-admin before any mutation or audit runs", async () => {
    requireAdminMock.mockRejectedValue(new AdminAccessError());

    const result = await applyStoreChangeRequestAction(INPUT);

    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(applyStoreChangeRequestMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });
});

describe("applyStoreChangeRequestAction success", () => {
  it("emits the applied event with counts (never the comment) and returns the applied outcome", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_SESSION);
    applyStoreChangeRequestMock.mockResolvedValue({
      outcome: "applied",
      slug: "store-one",
      appliedFieldCount: 2,
      supersededCount: 1,
    });

    const result = await applyStoreChangeRequestAction(INPUT);

    expect(result).toEqual({ success: true, outcome: "applied" });
    expect(applyStoreChangeRequestMock).toHaveBeenCalledWith(STORE, "cr-1", "admin-1");
    expect(captureMock).toHaveBeenCalledTimes(1);
    const captureArg = captureMock.mock.calls[0][0];
    expect(captureArg.event).toBe("store_change_request_applied");
    expect(captureArg.properties).toEqual({
      store_slug: "store-one",
      change_request_id: "cr-1",
      applied_field_count: 2,
      superseded_count: 1,
    });
    expect(JSON.stringify(captureArg.properties)).not.toContain("comment");
  });

  it("emits no analytics event when approval resulted in a supersede", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_SESSION);
    applyStoreChangeRequestMock.mockResolvedValue({ outcome: "superseded", slug: "store-one" });

    const result = await applyStoreChangeRequestAction(INPUT);

    expect(result).toEqual({ success: true, outcome: "superseded" });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("maps a typed mutation error to its code without reporting to Sentry", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_SESSION);
    applyStoreChangeRequestMock.mockRejectedValue(new StoreChangeRequestError("invalidTransition"));

    const result = await applyStoreChangeRequestAction(INPUT);

    expect(result).toEqual({ success: false, error: "invalidTransition" });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});

describe("rejectStoreChangeRequestAction", () => {
  it("refuses a non-admin before any mutation runs", async () => {
    requireAdminMock.mockRejectedValue(new AdminAccessError());

    const result = await rejectStoreChangeRequestAction(INPUT);

    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(rejectStoreChangeRequestMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("rejects and emits the rejected event with identifiers only", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_SESSION);
    rejectStoreChangeRequestMock.mockResolvedValue({ id: "cr-1", slug: "store-one" });

    const result = await rejectStoreChangeRequestAction(INPUT);

    expect(result).toEqual({ success: true });
    expect(rejectStoreChangeRequestMock).toHaveBeenCalledWith(STORE, "cr-1", "admin-1");
    const captureArg = captureMock.mock.calls[0][0];
    expect(captureArg.event).toBe("store_change_request_rejected");
    expect(captureArg.properties).toEqual({ store_slug: "store-one", change_request_id: "cr-1" });
  });
});
