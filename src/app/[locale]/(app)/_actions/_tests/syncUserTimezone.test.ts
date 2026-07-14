import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncUserTimezoneAction } from "@/app/[locale]/(app)/_actions/syncUserTimezone";

const { getSessionMock, updateUserTimezoneMock, captureExceptionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  updateUserTimezoneMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/data/auth/userMutations", () => ({
  updateUserTimezone: updateUserTimezoneMock,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

describe("syncUserTimezoneAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    updateUserTimezoneMock.mockResolvedValue(undefined);
  });

  it("returns unauthorized and writes nothing without a session", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(syncUserTimezoneAction("America/Lima")).resolves.toEqual({ ok: false, error: "unauthorized" });

    expect(updateUserTimezoneMock).not.toHaveBeenCalled();
  });

  it("persists a valid zone against the session user", async () => {
    await expect(syncUserTimezoneAction("Europe/Madrid")).resolves.toEqual({ ok: true });

    expect(updateUserTimezoneMock).toHaveBeenCalledTimes(1);
    expect(updateUserTimezoneMock).toHaveBeenCalledWith("user-1", "Europe/Madrid");
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid zone with a validation error and writes nothing", async () => {
    for (const value of ["Middle/Earth", "", 'America/Lima\'; DROP TABLE "user";--']) {
      await expect(syncUserTimezoneAction(value)).resolves.toEqual({ ok: false, error: "validation" });
    }

    expect(updateUserTimezoneMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("captures an unexpected persistence failure once and returns generic", async () => {
    const persistenceError = new Error("database unavailable");
    updateUserTimezoneMock.mockRejectedValueOnce(persistenceError);

    await expect(syncUserTimezoneAction("Asia/Tokyo")).resolves.toEqual({ ok: false, error: "generic" });

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(persistenceError, {
      extra: { action: "syncUserTimezoneAction", userId: "user-1" },
    });
  });
});
