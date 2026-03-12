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

  it("captures delivery failures, emits the failure event, and throws the stable auth error", async () => {
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
    ).rejects.toThrow("PASSWORD_RESET_EMAIL_DELIVERY_FAILED");

    expect(captureExceptionMock).toHaveBeenCalledWith(
      deliveryError,
      expect.objectContaining({
        tags: {
          auth_flow: "password_recovery",
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
    expect(deletePasswordResetVerificationTokenMock).toHaveBeenCalledWith("unused-token");
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
