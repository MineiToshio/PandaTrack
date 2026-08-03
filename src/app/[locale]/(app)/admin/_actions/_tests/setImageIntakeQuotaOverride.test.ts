import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  getPostHogClientMock,
  captureMock,
  setImageIntakeQuotaOverrideMock,
  captureExceptionMock,
  AdminAccessError,
  ImageIntakeQuotaOverrideError,
} = vi.hoisted(() => {
  class AdminAccessError extends Error {
    constructor() {
      super("admin access required");
      this.name = "AdminAccessError";
    }
  }
  class ImageIntakeQuotaOverrideError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "ImageIntakeQuotaOverrideError";
      this.code = code;
    }
  }
  return {
    requireAdminMock: vi.fn(),
    getPostHogClientMock: vi.fn(),
    captureMock: vi.fn(),
    setImageIntakeQuotaOverrideMock: vi.fn(),
    captureExceptionMock: vi.fn(),
    AdminAccessError,
    ImageIntakeQuotaOverrideError,
  };
});

vi.mock("@/lib/auth/auth-server", () => ({ requireAdmin: requireAdminMock, AdminAccessError }));
vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));
vi.mock("@/lib/data/imageIntake/imageIntakeQuotaMutations", () => ({
  setImageIntakeQuotaOverride: setImageIntakeQuotaOverrideMock,
  ImageIntakeQuotaOverrideError,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { POSTHOG_EVENTS } from "@/lib/constants";
import { setImageIntakeQuotaOverrideAction } from "../setImageIntakeQuotaOverride";

const ADMIN_SESSION = { user: { id: "admin-1" } };
const INPUT = { targetUserId: "user-1", limit: 50, reason: "Beta tester" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN_SESSION);
  getPostHogClientMock.mockReturnValue({ capture: captureMock });
  setImageIntakeQuotaOverrideMock.mockResolvedValue({ targetUserId: "user-1", previousLimit: null, limit: 50 });
});

describe("setImageIntakeQuotaOverrideAction", () => {
  it("refuses a caller who is not an administrator, before touching the account", async () => {
    requireAdminMock.mockRejectedValue(new AdminAccessError());

    await expect(setImageIntakeQuotaOverrideAction(INPUT)).resolves.toEqual({
      success: false,
      error: "unauthorized",
    });
    expect(setImageIntakeQuotaOverrideMock).not.toHaveBeenCalled();
  });

  it("applies the override on behalf of the acting administrator", async () => {
    await expect(setImageIntakeQuotaOverrideAction(INPUT)).resolves.toEqual({ success: true });

    expect(setImageIntakeQuotaOverrideMock).toHaveBeenCalledWith({
      actorId: "admin-1",
      targetUserId: "user-1",
      limit: 50,
      reason: "Beta tester",
    });
  });

  it("reports the change with identifiers and figures only, never the reason", async () => {
    await setImageIntakeQuotaOverrideAction(INPUT);

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "admin-1",
      event: POSTHOG_EVENTS.IMAGE_INTAKE.ADMIN_QUOTA_OVERRIDE_SET,
      properties: { target_user_id: "user-1", previous_limit: null, photo_limit: 50 },
    });
    expect(JSON.stringify(captureMock.mock.calls[0][0])).not.toContain("Beta tester");
  });

  it("rejects a blank reason at the boundary", async () => {
    const result = await setImageIntakeQuotaOverrideAction({ ...INPUT, reason: "  " });

    expect(result.success).toBe(false);
    expect(setImageIntakeQuotaOverrideMock).not.toHaveBeenCalled();
  });

  it("rejects a limit that is not a whole non-negative number", async () => {
    await expect(setImageIntakeQuotaOverrideAction({ ...INPUT, limit: -5 })).resolves.toMatchObject({
      success: false,
    });
    await expect(setImageIntakeQuotaOverrideAction({ ...INPUT, limit: 2.5 })).resolves.toMatchObject({
      success: false,
    });
  });

  it("accepts a null limit as the explicit clear", async () => {
    setImageIntakeQuotaOverrideMock.mockResolvedValue({ targetUserId: "user-1", previousLimit: 50, limit: null });

    await expect(setImageIntakeQuotaOverrideAction({ ...INPUT, limit: null })).resolves.toEqual({ success: true });
  });

  it("surfaces a missing account as an expected outcome, not as a crash report", async () => {
    setImageIntakeQuotaOverrideMock.mockRejectedValue(new ImageIntakeQuotaOverrideError("user-not-found"));

    await expect(setImageIntakeQuotaOverrideAction(INPUT)).resolves.toEqual({
      success: false,
      error: "user-not-found",
    });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure to Sentry and answers with a generic error", async () => {
    setImageIntakeQuotaOverrideMock.mockRejectedValue(new Error("DB_DOWN"));

    await expect(setImageIntakeQuotaOverrideAction(INPUT)).resolves.toEqual({
      success: false,
      error: "overrideFailed",
    });
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});
