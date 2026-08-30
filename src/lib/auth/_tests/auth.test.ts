import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  betterAuthMock,
  prismaAdapterMock,
  getAppBaseUrlMock,
  getPublicSiteUrlMock,
  handlePasswordRecoveryRequestMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  betterAuthMock: vi.fn(() => ({ api: {} })),
  prismaAdapterMock: vi.fn(() => "prisma-adapter"),
  getAppBaseUrlMock: vi.fn(() => "https://pandatrack.app"),
  getPublicSiteUrlMock: vi.fn(() => "https://pandatrack.app"),
  handlePasswordRecoveryRequestMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
}));

vi.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}));

vi.mock("better-auth/api", () => ({
  createAuthMiddleware: (callback: unknown) => callback,
}));

vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: prismaAdapterMock,
}));

vi.mock("better-auth/next-js", () => ({
  nextCookies: () => "next-cookies-plugin",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: "prisma-client",
}));

vi.mock("@/lib/app-url", () => ({
  getAppBaseUrl: getAppBaseUrlMock,
  getPublicSiteUrl: getPublicSiteUrlMock,
}));

vi.mock("@/lib/auth/authPasswordRecovery", () => ({
  handlePasswordRecoveryRequest: handlePasswordRecoveryRequestMock,
}));

vi.mock("@/lib/auth/authRedirect", () => ({
  buildVerificationConfirmHref: vi.fn(),
  getLocaleSegment: vi.fn(),
}));

vi.mock("@/lib/auth/authVerificationEmail", () => ({
  buildAuthVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/integrations/kit", () => ({
  syncAuthenticatedUserToKit: vi.fn(),
}));

vi.mock("@/lib/integrations/resend", () => ({
  sendEmailWithResend: vi.fn(),
}));

vi.mock("@/lib/user-settings/usernameGeneration", async () => {
  const { generateUniqueUsernameForNewUserMock } = await import("@/lib/auth/_tests/authUsernameMocks");
  return {
    generateUniqueUsernameForNewUser: generateUniqueUsernameForNewUserMock,
  };
});

describe("auth config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("enables session revocation after password reset", async () => {
    const { generateUniqueUsernameForNewUserMock } = await import("@/lib/auth/_tests/authUsernameMocks");
    generateUniqueUsernameForNewUserMock.mockResolvedValue({ username: "test-user" });
    await import("@/lib/auth/auth");

    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          cookieCache: expect.objectContaining({
            enabled: false,
          }),
        }),
        emailAndPassword: expect.objectContaining({
          resetPasswordTokenExpiresIn: 60 * 60,
          revokeSessionsOnPasswordReset: true,
        }),
      }),
    );
    expect(prismaAdapterMock).toHaveBeenCalledWith("prisma-client", {
      provider: "postgresql",
    });
  });

  it("registers a user create hook for username injection", async () => {
    const { generateUniqueUsernameForNewUserMock } = await import("@/lib/auth/_tests/authUsernameMocks");
    generateUniqueUsernameForNewUserMock.mockResolvedValue({ username: "panda-1234" });

    await import("@/lib/auth/auth");

    const calls = betterAuthMock.mock.calls as unknown[][];
    const lastCall = calls[calls.length - 1];
    const config = lastCall?.[0] as
      | {
          databaseHooks?: {
            user?: {
              create?: {
                before?: unknown;
              };
            };
          };
        }
      | undefined;

    expect(config?.databaseHooks?.user?.create?.before).toEqual(expect.any(Function));
  });

  it("captures a signup verification email failure to Sentry without rethrowing", async () => {
    // better-auth runs this callback through its own `runInBackgroundOrAwait` wrapper, which only
    // `logger.error`s a caught exception and never reports it anywhere else, so this is the ONLY
    // place a Resend outage on signup can ever reach Sentry.
    const { generateUniqueUsernameForNewUserMock } = await import("@/lib/auth/_tests/authUsernameMocks");
    generateUniqueUsernameForNewUserMock.mockResolvedValue({ username: "test-user" });

    const { getLocaleSegment, buildVerificationConfirmHref } = await import("@/lib/auth/authRedirect");
    vi.mocked(getLocaleSegment).mockReturnValue("en");
    vi.mocked(buildVerificationConfirmHref).mockReturnValue("/en/auth/verify-email");

    const { buildAuthVerificationEmail } = await import("@/lib/auth/authVerificationEmail");
    vi.mocked(buildAuthVerificationEmail).mockResolvedValue({
      subject: "Verify your email",
      text: "text body",
      html: "<p>html body</p>",
    });

    const { sendEmailWithResend } = await import("@/lib/integrations/resend");
    const sendError = new Error("Resend outage");
    vi.mocked(sendEmailWithResend).mockRejectedValue(sendError);

    await import("@/lib/auth/auth");

    const calls = betterAuthMock.mock.calls as unknown[][];
    const lastCall = calls[calls.length - 1];
    const config = lastCall?.[0] as
      | {
          emailVerification?: {
            sendVerificationEmail?: (
              params: { user: { email: string }; token: string; url: string },
              request: unknown,
            ) => Promise<void>;
          };
        }
      | undefined;

    const sendVerificationEmail = config?.emailVerification?.sendVerificationEmail;
    expect(sendVerificationEmail).toEqual(expect.any(Function));

    // Must resolve, not reject: an unhandled rejection here would surface as a broken sign-up
    // instead of the "email failed to send, order still went through" outcome this flow requires.
    await expect(
      sendVerificationEmail!(
        {
          user: { email: "user@example.com" },
          token: "token-1",
          url: "https://pandatrack.app/api/auth/verify-email?token=token-1&callbackURL=%2Fen%2Fdashboard",
        },
        {},
      ),
    ).resolves.toBeUndefined();

    expect(captureExceptionMock).toHaveBeenCalledWith(sendError);
  });
});
