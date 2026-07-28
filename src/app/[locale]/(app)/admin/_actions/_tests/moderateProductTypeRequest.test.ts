import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  getPostHogClientMock,
  captureMock,
  approveStoreProductTypeRequestMock,
  rejectStoreProductTypeRequestMock,
  revalidatePathMock,
  captureExceptionMock,
  AdminAccessError,
  StoreProductTypeApprovalError,
} = vi.hoisted(() => {
  class AdminAccessError extends Error {
    constructor() {
      super("admin access required");
      this.name = "AdminAccessError";
    }
  }
  class StoreProductTypeApprovalError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "StoreProductTypeApprovalError";
      this.code = code;
    }
  }
  return {
    requireAdminMock: vi.fn(),
    getPostHogClientMock: vi.fn(),
    captureMock: vi.fn(),
    approveStoreProductTypeRequestMock: vi.fn(),
    rejectStoreProductTypeRequestMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    captureExceptionMock: vi.fn(),
    AdminAccessError,
    StoreProductTypeApprovalError,
  };
});

vi.mock("@/lib/auth/auth-server", () => ({ requireAdmin: requireAdminMock, AdminAccessError }));
vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));
vi.mock("@/lib/data/catalog/storeProductTypeMutations", () => ({
  approveStoreProductTypeRequest: approveStoreProductTypeRequestMock,
  rejectStoreProductTypeRequest: rejectStoreProductTypeRequestMock,
  StoreProductTypeApprovalError,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { approveProductTypeRequestAction, rejectProductTypeRequestAction } from "../moderateProductTypeRequest";

const ADMIN_SESSION = { user: { id: "admin-1" } };
const APPROVE_INPUT = { requestId: "req-1", locale: "en", nameEs: "Juguetes de vinilo", nameEn: "Vinyl toys" };
const REJECT_INPUT = { requestId: "req-1", locale: "en" };

beforeEach(() => {
  vi.clearAllMocks();
  getPostHogClientMock.mockReturnValue({ capture: captureMock, shutdown: vi.fn() });
});

describe("approveProductTypeRequestAction gating", () => {
  it("refuses a non-admin before any mutation or audit runs", async () => {
    requireAdminMock.mockRejectedValue(new AdminAccessError());

    const result = await approveProductTypeRequestAction(APPROVE_INPUT);

    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(approveStoreProductTypeRequestMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });
});

describe("approveProductTypeRequestAction success", () => {
  it("authors the type and emits the approved event with identifiers only", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_SESSION);
    approveStoreProductTypeRequestMock.mockResolvedValue({ requestId: "req-1", key: "vinyl_toys" });

    const result = await approveProductTypeRequestAction(APPROVE_INPUT);

    expect(result).toEqual({ success: true, key: "vinyl_toys" });
    expect(approveStoreProductTypeRequestMock).toHaveBeenCalledWith({
      requestId: "req-1",
      actorId: "admin-1",
      nameEs: "Juguetes de vinilo",
      nameEn: "Vinyl toys",
      key: undefined,
    });
    expect(captureMock).toHaveBeenCalledTimes(1);
    const captureArg = captureMock.mock.calls[0][0];
    expect(captureArg.event).toBe("store_product_type_request_approved");
    expect(captureArg.properties).toEqual({ request_id: "req-1", product_type_key: "vinyl_toys" });
    expect(JSON.stringify(captureArg.properties)).not.toContain("reason");
  });

  it("maps a duplicate-key mutation error to its code without reporting to Sentry", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_SESSION);
    approveStoreProductTypeRequestMock.mockRejectedValue(new StoreProductTypeApprovalError("duplicateKey"));

    const result = await approveProductTypeRequestAction(APPROVE_INPUT);

    expect(result).toEqual({ success: false, error: "duplicateKey" });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input at the Zod boundary before the mutation runs", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_SESSION);

    const result = await approveProductTypeRequestAction({ requestId: "req-1", locale: "en", nameEs: "", nameEn: "x" });

    expect(result).toMatchObject({ success: false });
    expect(approveStoreProductTypeRequestMock).not.toHaveBeenCalled();
  });
});

describe("rejectProductTypeRequestAction", () => {
  it("refuses a non-admin before any mutation runs", async () => {
    requireAdminMock.mockRejectedValue(new AdminAccessError());

    const result = await rejectProductTypeRequestAction(REJECT_INPUT);

    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(rejectStoreProductTypeRequestMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("rejects and emits the rejected event with the request id only", async () => {
    requireAdminMock.mockResolvedValue(ADMIN_SESSION);
    rejectStoreProductTypeRequestMock.mockResolvedValue({ requestId: "req-1" });

    const result = await rejectProductTypeRequestAction(REJECT_INPUT);

    expect(result).toEqual({ success: true });
    expect(rejectStoreProductTypeRequestMock).toHaveBeenCalledWith({ requestId: "req-1", actorId: "admin-1" });
    const captureArg = captureMock.mock.calls[0][0];
    expect(captureArg.event).toBe("store_product_type_request_rejected");
    expect(captureArg.properties).toEqual({ request_id: "req-1" });
  });
});
