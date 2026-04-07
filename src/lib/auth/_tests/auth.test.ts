import { beforeEach, describe, expect, it, vi } from "vitest";

const { betterAuthMock, prismaAdapterMock, getAppBaseUrlMock, handlePasswordRecoveryRequestMock } = vi.hoisted(() => ({
  betterAuthMock: vi.fn(() => ({ api: {} })),
  prismaAdapterMock: vi.fn(() => "prisma-adapter"),
  getAppBaseUrlMock: vi.fn(() => "https://pandatrack.app"),
  handlePasswordRecoveryRequestMock: vi.fn(),
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
});
