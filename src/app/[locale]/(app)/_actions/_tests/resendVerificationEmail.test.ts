import {
  resendVerificationEmail,
  type ResendVerificationEmailResult,
} from "@/app/[locale]/(app)/_actions/resendVerificationEmail";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  headersMock,
  getSessionMock,
  getVerificationSnapshotMock,
  sendVerificationEmailMock,
  resolveAuthCallbackURLMock,
} = vi.hoisted(() => ({
  headersMock: vi.fn(),
  getSessionMock: vi.fn(),
  getVerificationSnapshotMock: vi.fn(),
  sendVerificationEmailMock: vi.fn(),
  resolveAuthCallbackURLMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("@/lib/auth/auth-server", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/auth/authRedirect", () => ({
  resolveAuthCallbackURL: resolveAuthCallbackURLMock,
}));

vi.mock("@/lib/auth/authVerification", () => ({
  getVerificationSnapshot: getVerificationSnapshotMock,
  sendVerificationEmail: sendVerificationEmailMock,
}));

describe("resendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers({ "x-test": "true" }));
    resolveAuthCallbackURLMock.mockReturnValue("/en/dashboard");
  });

  it("returns unauthenticated when no session is available", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const expectedResult = {
      success: false,
      reason: "unauthenticated",
    } satisfies ResendVerificationEmailResult;

    await expect(resendVerificationEmail({ locale: "en" })).resolves.toEqual(expectedResult);

    expect(getVerificationSnapshotMock).not.toHaveBeenCalled();
  });

  it("returns not_required when the user is already verified or verification does not apply", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    getVerificationSnapshotMock.mockResolvedValueOnce({
      state: "verified",
      email: "verified@example.com",
    });
    const expectedResult = {
      success: false,
      reason: "not_required",
    } satisfies ResendVerificationEmailResult;

    await expect(resendVerificationEmail({ locale: "en", returnTo: "/dashboard" })).resolves.toEqual(expectedResult);

    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("returns send_failed when the provider call fails", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-2" } });
    getVerificationSnapshotMock.mockResolvedValueOnce({
      state: "grace",
      email: "grace@example.com",
    });
    sendVerificationEmailMock.mockResolvedValueOnce({
      ok: false,
      error: "provider_failed",
    });
    const expectedResult = {
      success: false,
      reason: "send_failed",
    } satisfies ResendVerificationEmailResult;

    await expect(resendVerificationEmail({ locale: "en", returnTo: "/payments" })).resolves.toEqual(expectedResult);
  });

  it("sends the verification email with the resolved callback and request headers", async () => {
    const requestHeaders = new Headers({ "x-test": "true" });
    getSessionMock.mockResolvedValue({ user: { id: "user-3" } });
    getVerificationSnapshotMock.mockResolvedValueOnce({
      state: "blocked",
      email: "blocked@example.com",
    });
    headersMock.mockResolvedValueOnce(requestHeaders);
    sendVerificationEmailMock.mockResolvedValueOnce({ ok: true });
    const expectedResult = { success: true } satisfies ResendVerificationEmailResult;

    await expect(resendVerificationEmail({ locale: "en", returnTo: "/shipments" })).resolves.toEqual(expectedResult);

    expect(resolveAuthCallbackURLMock).toHaveBeenCalledWith("en", "/shipments");
    expect(sendVerificationEmailMock).toHaveBeenCalledWith("blocked@example.com", "/en/dashboard", requestHeaders);
  });
});
