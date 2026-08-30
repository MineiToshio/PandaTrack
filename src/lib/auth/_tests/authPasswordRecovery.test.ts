import { POSTHOG_EVENTS } from "@/lib/constants";
import { handlePasswordRecoveryRequest } from "@/lib/auth/authPasswordRecovery";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  captureExceptionMock,
  posthogCaptureMock,
  sendEmailWithResendMock,
  buildAuthPasswordResetEmailMock,
  deletePasswordResetVerificationTokenMock,
  getPasswordRecoveryThrottleMarkerMock,
  upsertPasswordRecoveryThrottleMarkerMock,
} = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  sendEmailWithResendMock: vi.fn(),
  buildAuthPasswordResetEmailMock: vi.fn(),
  deletePasswordResetVerificationTokenMock: vi.fn(),
  getPasswordRecoveryThrottleMarkerMock: vi.fn(),
  upsertPasswordRecoveryThrottleMarkerMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({
    capture: posthogCaptureMock,
  }),
}));

vi.mock("@/lib/integrations/resend", () => ({
  sendEmailWithResend: sendEmailWithResendMock,
}));

vi.mock("@/lib/auth/authPasswordResetEmail", () => ({
  buildAuthPasswordResetEmail: buildAuthPasswordResetEmailMock,
}));

vi.mock("@/lib/auth/authPasswordRecoveryData", () => ({
  deletePasswordResetVerificationToken: deletePasswordResetVerificationTokenMock,
  getPasswordRecoveryThrottleMarker: getPasswordRecoveryThrottleMarkerMock,
  upsertPasswordRecoveryThrottleMarker: upsertPasswordRecoveryThrottleMarkerMock,
}));

describe("authPasswordRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));
    buildAuthPasswordResetEmailMock.mockResolvedValue({
      subject: "Reset password",
      text: "Reset",
      html: "<p>Reset</p>",
    });
    sendEmailWithResendMock.mockResolvedValue(undefined);
    getPasswordRecoveryThrottleMarkerMock.mockResolvedValue(null);
    deletePasswordResetVerificationTokenMock.mockResolvedValue({ count: 1 });
    upsertPasswordRecoveryThrottleMarkerMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefers the locale from the reset URL path", async () => {
    await handlePasswordRecoveryRequest({
      email: "collector@example.com",
      token: "unused-token",
      request: new Request("https://pandatrack.app/api/auth/request-password-reset", {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "test-agent",
          "accept-language": "en-US,en;q=0.9",
        },
      }),
      url: "https://pandatrack.app/en/reset-password?token=abc",
    });

    expect(buildAuthPasswordResetEmailMock).toHaveBeenCalledWith(
      "en",
      "https://pandatrack.app/en/reset-password?token=abc",
    );
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "collector@example.com",
      event: POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_EMAIL_SENT,
      properties: {
        locale: "en",
      },
    });
    expect(upsertPasswordRecoveryThrottleMarkerMock).toHaveBeenCalledWith(
      expect.stringMatching(/^password-recovery-throttle:/),
      {
        stageIndex: 0,
        cooldownMinutes: 2,
        expiresAt: "2026-03-11T12:02:00.000Z",
      },
    );
  });

  it("falls back through callbackURL, cookie, accept-language, and finally the default locale", async () => {
    await handlePasswordRecoveryRequest({
      email: "callback@example.com",
      token: "unused-token",
      request: new Request("https://pandatrack.app/api/auth/request-password-reset", {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "test-agent",
        },
      }),
      url: "https://pandatrack.app/reset-password?callbackURL=%2Fen%2Fdashboard",
    });
    expect(buildAuthPasswordResetEmailMock).toHaveBeenLastCalledWith(
      "en",
      "https://pandatrack.app/reset-password?callbackURL=%2Fen%2Fdashboard",
    );

    await handlePasswordRecoveryRequest({
      email: "cookie@example.com",
      token: "unused-token",
      url: "https://pandatrack.app/reset-password",
      request: new Request("https://pandatrack.app/reset-password", {
        headers: {
          cookie: "NEXT_LOCALE=en",
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "test-agent",
        },
      }),
    });
    expect(buildAuthPasswordResetEmailMock).toHaveBeenLastCalledWith("en", "https://pandatrack.app/reset-password");

    await handlePasswordRecoveryRequest({
      email: "language@example.com",
      token: "unused-token",
      url: "https://pandatrack.app/reset-password",
      request: new Request("https://pandatrack.app/reset-password", {
        headers: {
          "accept-language": "en-US,en;q=0.9",
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "test-agent",
        },
      }),
    });
    expect(buildAuthPasswordResetEmailMock).toHaveBeenLastCalledWith("en", "https://pandatrack.app/reset-password");

    await handlePasswordRecoveryRequest({
      email: "default@example.com",
      token: "unused-token",
      request: new Request("https://pandatrack.app/api/auth/request-password-reset", {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "test-agent",
        },
      }),
      url: "https://pandatrack.app/reset-password",
    });
    expect(buildAuthPasswordResetEmailMock).toHaveBeenLastCalledWith("es", "https://pandatrack.app/reset-password");
  });

  it("captures delivery failures in Sentry, deletes the burned token, and resolves without throwing", async () => {
    // Real contract (better-auth swallows any throw from `sendResetPassword` via
    // `runInBackgroundOrAwait` and always returns `{ status: true }` to the caller), so the only
    // way this failure becomes visible at all is through Sentry. Before the fix, this same
    // scenario threw `PASSWORD_RESET_EMAIL_DELIVERY_FAILED` here (red: `.rejects.toThrow(...)`
    // passed against the old code, proving the promise never resolved) - that error was dead
    // code because better-auth discards it either way.
    const deliveryError = new Error("Resend unavailable");
    sendEmailWithResendMock.mockRejectedValueOnce(deliveryError);

    await expect(
      handlePasswordRecoveryRequest({
        email: "collector@example.com",
        token: "unused-token",
        request: new Request("https://pandatrack.app/api/auth/request-password-reset", {
          headers: {
            "x-forwarded-for": "127.0.0.1",
            "user-agent": "test-agent",
            "accept-language": "en-US,en;q=0.9",
          },
        }),
        url: "https://pandatrack.app/en/reset-password",
      }),
    ).resolves.toBeUndefined();

    expect(captureExceptionMock).toHaveBeenCalledWith(
      deliveryError,
      expect.objectContaining({
        tags: {
          auth_flow: "password_recovery_delivery",
        },
        extra: {
          locale: "en",
        },
      }),
    );
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "collector@example.com",
      event: POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_EMAIL_FAILED,
      properties: {
        locale: "en",
        reason: "Resend unavailable",
      },
    });
    // The token was never delivered, so invalidating it here does not take anything away from
    // the requester; it only prevents a dead token from lingering.
    expect(deletePasswordResetVerificationTokenMock).toHaveBeenCalledWith("unused-token");
    expect(upsertPasswordRecoveryThrottleMarkerMock).not.toHaveBeenCalled();
  });

  it("does not burn the token when only post-send bookkeeping fails after a real delivery", async () => {
    // Regression guard for the ordering bug: bookkeeping (the "email sent" event and the
    // throttle-marker upsert) used to run inside the same try/catch as the send itself, so a
    // failure in either call after a successful send was mistaken for a delivery failure and
    // deleted a token that had already reached the requester's inbox.
    const bookkeepingError = new Error("throttle store unavailable");
    upsertPasswordRecoveryThrottleMarkerMock.mockRejectedValueOnce(bookkeepingError);

    await expect(
      handlePasswordRecoveryRequest({
        email: "collector@example.com",
        token: "unused-token",
        request: new Request("https://pandatrack.app/api/auth/request-password-reset", {
          headers: {
            "x-forwarded-for": "127.0.0.1",
            "user-agent": "test-agent",
            "accept-language": "en-US,en;q=0.9",
          },
        }),
        url: "https://pandatrack.app/en/reset-password",
      }),
    ).resolves.toBeUndefined();

    expect(sendEmailWithResendMock).toHaveBeenCalled();
    expect(captureExceptionMock).toHaveBeenCalledWith(
      bookkeepingError,
      expect.objectContaining({
        tags: {
          auth_flow: "password_recovery_bookkeeping",
        },
      }),
    );
    expect(deletePasswordResetVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("suppresses repeated recovery requests during the cooldown window and escalates the wait time", async () => {
    getPasswordRecoveryThrottleMarkerMock.mockResolvedValueOnce({
      expiresAt: new Date("2026-03-11T12:10:00.000Z"),
      value: JSON.stringify({
        stageIndex: 0,
        expiresAt: "2026-03-11T12:10:00.000Z",
      }),
    });

    await handlePasswordRecoveryRequest({
      email: "collector@example.com",
      token: "unused-token",
      request: new Request("https://pandatrack.app/api/auth/request-password-reset", {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "test-agent",
        },
      }),
      url: "https://pandatrack.app/en/reset-password?token=abc",
    });

    expect(buildAuthPasswordResetEmailMock).not.toHaveBeenCalled();
    expect(sendEmailWithResendMock).not.toHaveBeenCalled();
    expect(deletePasswordResetVerificationTokenMock).toHaveBeenCalledWith("unused-token");
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "collector@example.com",
      event: POSTHOG_EVENTS.AUTH.FORGOT_PASSWORD_FAILED,
      properties: {
        reason: "rate_limited",
        cooldown_minutes: 5,
      },
    });
    expect(upsertPasswordRecoveryThrottleMarkerMock).toHaveBeenCalledWith(
      expect.stringMatching(/^password-recovery-throttle:/),
      {
        stageIndex: 1,
        cooldownMinutes: 5,
        expiresAt: "2026-03-11T12:05:00.000Z",
      },
    );
  });
});
