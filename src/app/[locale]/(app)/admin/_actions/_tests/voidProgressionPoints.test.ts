import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  getPostHogClientMock,
  captureMock,
  voidUserProgressionPointsMock,
  captureExceptionMock,
  AdminAccessError,
} = vi.hoisted(() => {
  class AdminAccessError extends Error {
    constructor() {
      super("admin access required");
      this.name = "AdminAccessError";
    }
  }
  return {
    requireAdminMock: vi.fn(),
    getPostHogClientMock: vi.fn(),
    captureMock: vi.fn(),
    voidUserProgressionPointsMock: vi.fn(),
    captureExceptionMock: vi.fn(),
    AdminAccessError,
  };
});

vi.mock("@/lib/auth/auth-server", () => ({ requireAdmin: requireAdminMock, AdminAccessError }));
vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));
vi.mock("@/lib/data/progression/progressionMutations", () => ({
  voidUserProgressionPoints: voidUserProgressionPointsMock,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { POSTHOG_EVENTS } from "@/lib/constants";
import { voidProgressionPointsAction } from "../voidProgressionPoints";

const ADMIN_SESSION = { user: { id: "admin-1" } };
const INPUT = { targetUserId: "user-1", reason: "Points farmed through a self-created store" };
const VOID_RESULT = { ok: true, voidedEntryCount: 3, maturedPoints: 0, highestRankIndex: 4 };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN_SESSION);
  getPostHogClientMock.mockReturnValue({ capture: captureMock });
  voidUserProgressionPointsMock.mockResolvedValue(VOID_RESULT);
});

describe("voidProgressionPointsAction", () => {
  it("refuses a caller who is not an administrator, before touching the ledger", async () => {
    requireAdminMock.mockRejectedValue(new AdminAccessError());

    await expect(voidProgressionPointsAction(INPUT)).resolves.toEqual({ success: false, error: "unauthorized" });
    expect(voidUserProgressionPointsMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("refuses a blank reason at the boundary, so no transaction is ever opened", async () => {
    const result = await voidProgressionPointsAction({ targetUserId: "user-1", reason: "   " });

    expect(result.success).toBe(false);
    expect(voidUserProgressionPointsMock).not.toHaveBeenCalled();
  });

  it("refuses a missing target the same way", async () => {
    const result = await voidProgressionPointsAction({ targetUserId: "", reason: "A perfectly good reason" });

    expect(result.success).toBe(false);
    expect(voidUserProgressionPointsMock).not.toHaveBeenCalled();
  });

  it("voids on behalf of the acting administrator, taking the actor from the session", async () => {
    await expect(voidProgressionPointsAction(INPUT)).resolves.toEqual({
      success: true,
      voidedEntryCount: 3,
      maturedPoints: 0,
      highestRankIndex: 4,
    });

    expect(voidUserProgressionPointsMock).toHaveBeenCalledWith({
      actorId: "admin-1",
      targetUserId: "user-1",
      reason: INPUT.reason,
    });
  });

  it("never lets the payload dictate who the actor is", async () => {
    await voidProgressionPointsAction({ ...INPUT, actorId: "someone-else" });

    expect(voidUserProgressionPointsMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-1" }));
  });

  it("reports identifiers and counts to analytics, never the reason", async () => {
    await voidProgressionPointsAction(INPUT);

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "admin-1",
      event: POSTHOG_EVENTS.ADMIN.PROGRESSION_POINTS_VOIDED,
      properties: { target_user_id: "user-1", voided_entry_count: 3, matured_points: 0 },
    });
    expect(JSON.stringify(captureMock.mock.calls)).not.toContain(INPUT.reason);
  });

  it.each(["VOID_REASON_REQUIRED", "USER_NOT_FOUND", "AUDIT_WRITE_FAILED"])(
    "maps the %s refusal to an error rather than a success",
    async (error) => {
      voidUserProgressionPointsMock.mockResolvedValue({ ok: false, error });

      await expect(voidProgressionPointsAction(INPUT)).resolves.toEqual({ success: false, error });
      // A rolled-back void is not a void: nothing may be reported as having happened.
      expect(captureMock).not.toHaveBeenCalled();
    },
  );

  it("reports an unexpected failure through Sentry without leaking the payload", async () => {
    voidUserProgressionPointsMock.mockRejectedValue(new Error("connection lost"));

    await expect(voidProgressionPointsAction(INPUT)).resolves.toEqual({ success: false, error: "voidFailed" });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(captureExceptionMock.mock.calls)).not.toContain(INPUT.reason);
  });
});
