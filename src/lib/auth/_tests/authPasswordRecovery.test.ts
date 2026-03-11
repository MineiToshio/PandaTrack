import { POSTHOG_EVENTS } from "@/lib/constants";
import { handlePasswordRecoveryRequest } from "@/lib/auth/authPasswordRecovery";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureExceptionMock, posthogCaptureMock, sendEmailWithResendMock, buildAuthPasswordResetEmailMock } =
  vi.hoisted(() => ({
    captureExceptionMock: vi.fn(),
    posthogCaptureMock: vi.fn(),
    sendEmailWithResendMock: vi.fn(),
    buildAuthPasswordResetEmailMock: vi.fn(),
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

describe("authPasswordRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildAuthPasswordResetEmailMock.mockResolvedValue({
      subject: "Reset password",
      text: "Reset",
      html: "<p>Reset</p>",
    });
    sendEmailWithResendMock.mockResolvedValue(undefined);
  });

  it("prefers the locale from the reset URL path", async () => {
    await handlePasswordRecoveryRequest({
      email: "collector@example.com",
      token: "unused-token",
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
  });

  it("falls back through callbackURL, cookie, accept-language, and finally the default locale", async () => {
    await handlePasswordRecoveryRequest({
      email: "callback@example.com",
      token: "unused-token",
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
        },
      }),
    });
    expect(buildAuthPasswordResetEmailMock).toHaveBeenLastCalledWith("en", "https://pandatrack.app/reset-password");

    await handlePasswordRecoveryRequest({
      email: "default@example.com",
      token: "unused-token",
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
  });
});
