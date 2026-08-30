import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  headersMock,
  getAccountCapabilitiesForUserMock,
  assertEmailChangeCooldownAllowsMock,
  recordSuccessfulEmailChangeMock,
  findUserIdByEmailExcludingMock,
  applyEmailChangeTransactionMock,
  buildAuthEmailChangeSecurityEmailMock,
  sendEmailWithResendMock,
  verifyPasswordMock,
  changePasswordMock,
  setPasswordMock,
  sendVerificationEmailMock,
  revalidatePathMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  headersMock: vi.fn(),
  getAccountCapabilitiesForUserMock: vi.fn(),
  assertEmailChangeCooldownAllowsMock: vi.fn(),
  recordSuccessfulEmailChangeMock: vi.fn(),
  findUserIdByEmailExcludingMock: vi.fn(),
  applyEmailChangeTransactionMock: vi.fn(),
  buildAuthEmailChangeSecurityEmailMock: vi.fn(),
  sendEmailWithResendMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  changePasswordMock: vi.fn(),
  setPasswordMock: vi.fn(),
  sendVerificationEmailMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      verifyPassword: verifyPasswordMock,
      changePassword: changePasswordMock,
      setPassword: setPasswordMock,
      sendVerificationEmail: sendVerificationEmailMock,
    },
  },
}));

vi.mock("@/lib/auth/accountCapabilities", () => ({
  getAccountCapabilitiesForUser: getAccountCapabilitiesForUserMock,
}));

vi.mock("@/lib/auth/emailChangeRateLimit", () => ({
  assertEmailChangeCooldownAllows: assertEmailChangeCooldownAllowsMock,
  recordSuccessfulEmailChange: recordSuccessfulEmailChangeMock,
}));

vi.mock("@/lib/auth/authEmailChangeSecurityEmail", () => ({
  buildAuthEmailChangeSecurityEmail: buildAuthEmailChangeSecurityEmailMock,
}));

vi.mock("@/lib/integrations/resend", () => ({
  sendEmailWithResend: sendEmailWithResendMock,
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/data/auth/userQueries", () => ({
  findUserIdByEmailExcluding: findUserIdByEmailExcludingMock,
}));

vi.mock("@/lib/data/auth/userMutations", () => ({
  applyEmailChangeTransaction: applyEmailChangeTransactionMock,
}));

import {
  submitChangePasswordAction,
  submitEmailChangeAction,
  submitSetPasswordAction,
} from "../accountCredentialsActions";

const AUTHENTICATED_SESSION = { user: { id: "user-1", email: "current@example.com" } };
const CAPABILITIES_CAN_CHANGE_EMAIL = {
  hasGoogleAccount: false,
  hasCredentialAccount: true,
  canChangeEmail: true,
  canChangePassword: true,
  canSetPassword: false,
};

describe("submitEmailChangeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
    assertEmailChangeCooldownAllowsMock.mockResolvedValue({ ok: true });
    findUserIdByEmailExcludingMock.mockResolvedValue(null);
    verifyPasswordMock.mockResolvedValue({});
    applyEmailChangeTransactionMock.mockResolvedValue(undefined);
    buildAuthEmailChangeSecurityEmailMock.mockResolvedValue({ subject: "s", text: "t", html: "<p>h</p>" });
    sendEmailWithResendMock.mockResolvedValue(undefined);
    sendVerificationEmailMock.mockResolvedValue({});
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "new@example.com",
      currentPassword: "secret123",
    });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(getAccountCapabilitiesForUserMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email before touching the account capabilities or password", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "not-an-email",
      currentPassword: "secret123",
    });

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(getAccountCapabilitiesForUserMock).not.toHaveBeenCalled();
  });

  it("blocks the change for accounts that are Google-only (cannot change email)", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue({
      hasGoogleAccount: true,
      hasCredentialAccount: false,
      canChangeEmail: false,
      canChangePassword: false,
      canSetPassword: true,
    });

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "new@example.com",
      currentPassword: "secret123",
    });

    expect(result).toEqual({ ok: false, error: "notAllowed" });
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("rejects re-submitting the current email as the new email", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "CURRENT@example.com",
      currentPassword: "secret123",
    });

    expect(result).toEqual({ ok: false, error: "sameEmail" });
    expect(applyEmailChangeTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects when the cooldown has not elapsed since the last change", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);
    assertEmailChangeCooldownAllowsMock.mockResolvedValue({ ok: false, retryAfterIso: "2026-08-01T00:00:00.000Z" });

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "new@example.com",
      currentPassword: "secret123",
    });

    expect(result).toEqual({ ok: false, error: "rateLimited", retryAfterIso: "2026-08-01T00:00:00.000Z" });
    expect(applyEmailChangeTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects when the new email is already taken by another account", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);
    findUserIdByEmailExcludingMock.mockResolvedValue({ id: "someone-else" });

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "new@example.com",
      currentPassword: "secret123",
    });

    expect(result).toEqual({ ok: false, error: "emailTaken" });
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("maps an invalid current password from Better Auth without leaking the raw error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);
    verifyPasswordMock.mockRejectedValue(new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD" }));

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "new@example.com",
      currentPassword: "wrong-password",
    });

    expect(result).toEqual({ ok: false, error: "invalidPassword" });
    expect(applyEmailChangeTransactionMock).not.toHaveBeenCalled();
  });

  it("changes the email, sends the security notice, and revalidates settings on success", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "new@example.com",
      currentPassword: "secret123",
    });

    expect(result).toEqual({ ok: true });
    expect(applyEmailChangeTransactionMock).toHaveBeenCalledWith("user-1", "new@example.com", expect.any(Date));
    expect(recordSuccessfulEmailChangeMock).toHaveBeenCalledWith("user-1", expect.any(Date));
    expect(sendEmailWithResendMock).toHaveBeenCalledWith(expect.objectContaining({ to: "current@example.com" }));
    expect(sendVerificationEmailMock).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("does not fail the whole flow when the security notice email fails to send", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);
    sendEmailWithResendMock.mockRejectedValue(new Error("resend down"));

    const result = await submitEmailChangeAction({
      locale: "en",
      newEmail: "new@example.com",
      currentPassword: "secret123",
    });

    expect(result).toEqual({ ok: true });
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});

describe("submitChangePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
    changePasswordMock.mockResolvedValue({});
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await submitChangePasswordAction({
      locale: "en",
      currentPassword: "old-secret",
      newPassword: "new-secret1",
    });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("rejects a new password shorter than the minimum length", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await submitChangePasswordAction({
      locale: "en",
      currentPassword: "old-secret",
      newPassword: "short",
    });

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("blocks password changes for accounts without a credential provider", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue({
      hasGoogleAccount: true,
      hasCredentialAccount: false,
      canChangeEmail: false,
      canChangePassword: false,
      canSetPassword: true,
    });

    const result = await submitChangePasswordAction({
      locale: "en",
      currentPassword: "old-secret",
      newPassword: "new-secret1",
    });

    expect(result).toEqual({ ok: false, error: "notAllowed" });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("changes the password and revalidates settings on success", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);

    const result = await submitChangePasswordAction({
      locale: "en",
      currentPassword: "old-secret",
      newPassword: "new-secret1",
    });

    expect(result).toEqual({ ok: true });
    expect(changePasswordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { currentPassword: "old-secret", newPassword: "new-secret1", revokeOtherSessions: true },
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("maps an invalid current password from Better Auth", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);
    changePasswordMock.mockRejectedValue(new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD" }));

    const result = await submitChangePasswordAction({
      locale: "en",
      currentPassword: "wrong",
      newPassword: "new-secret1",
    });

    expect(result).toEqual({ ok: false, error: "invalidPassword" });
  });

  it("reports an unmapped Better Auth error as generic and captures it in Sentry", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);
    changePasswordMock.mockRejectedValue(new APIError("BAD_REQUEST", { code: "SOMETHING_ELSE" }));

    const result = await submitChangePasswordAction({
      locale: "en",
      currentPassword: "wrong",
      newPassword: "new-secret1",
    });

    expect(result).toEqual({ ok: false, error: "generic" });
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});

describe("submitSetPasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
    setPasswordMock.mockResolvedValue({});
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await submitSetPasswordAction({ locale: "en", newPassword: "new-secret1" });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(setPasswordMock).not.toHaveBeenCalled();
  });

  it("blocks setting a password for accounts that already have credentials", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue(CAPABILITIES_CAN_CHANGE_EMAIL);

    const result = await submitSetPasswordAction({ locale: "en", newPassword: "new-secret1" });

    expect(result).toEqual({ ok: false, error: "notAllowed" });
    expect(setPasswordMock).not.toHaveBeenCalled();
  });

  it("sets the password and revalidates settings on success", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getAccountCapabilitiesForUserMock.mockResolvedValue({
      hasGoogleAccount: true,
      hasCredentialAccount: false,
      canChangeEmail: false,
      canChangePassword: false,
      canSetPassword: true,
    });

    const result = await submitSetPasswordAction({ locale: "en", newPassword: "new-secret1" });

    expect(result).toEqual({ ok: true });
    expect(setPasswordMock).toHaveBeenCalledWith(expect.objectContaining({ body: { newPassword: "new-secret1" } }));
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});
