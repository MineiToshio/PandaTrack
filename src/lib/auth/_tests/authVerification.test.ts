import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  getVerificationSnapshot,
  maybeSendDaySixVerificationReminder,
  sendVerificationEmail,
} from "@/lib/auth/authVerification";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  captureExceptionMock,
  posthogCaptureMock,
  sendVerificationEmailApiMock,
  userFindUniqueMock,
  verificationFindFirstMock,
  verificationCreateMock,
} = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  sendVerificationEmailApiMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  verificationFindFirstMock: vi.fn(),
  verificationCreateMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({
    capture: posthogCaptureMock,
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      sendVerificationEmail: sendVerificationEmailApiMock,
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
    verification: {
      findFirst: verificationFindFirstMock,
      create: verificationCreateMock,
    },
  },
}));

describe("authVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "verification-marker-id"),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("getVerificationSnapshot", () => {
    it("returns not_applicable for users without a credential account", async () => {
      userFindUniqueMock.mockResolvedValueOnce({
        id: "user-social",
        email: "collector@example.com",
        createdAt: new Date("2026-03-10T10:00:00.000Z"),
        emailVerified: false,
        accounts: [{ providerId: "google" }],
      });

      await expect(getVerificationSnapshot("user-social")).resolves.toEqual({
        userId: "user-social",
        email: "collector@example.com",
        createdAt: new Date("2026-03-10T10:00:00.000Z"),
        emailVerified: false,
        hasCredentialAccount: false,
        state: "not_applicable",
      });
    });

    it("returns grace for recent credential users and blocked after the 7-day window", async () => {
      userFindUniqueMock
        .mockResolvedValueOnce({
          id: "user-grace",
          email: "grace@example.com",
          createdAt: new Date("2026-03-05T12:00:00.000Z"),
          emailVerified: false,
          accounts: [{ providerId: "credential" }],
        })
        .mockResolvedValueOnce({
          id: "user-blocked",
          email: "blocked@example.com",
          createdAt: new Date("2026-03-03T12:00:00.000Z"),
          emailVerified: false,
          accounts: [{ providerId: "credential" }],
        });

      await expect(getVerificationSnapshot("user-grace")).resolves.toMatchObject({
        userId: "user-grace",
        state: "grace",
        hasCredentialAccount: true,
      });

      await expect(getVerificationSnapshot("user-blocked")).resolves.toMatchObject({
        userId: "user-blocked",
        state: "blocked",
        hasCredentialAccount: true,
      });
    });
  });

  describe("sendVerificationEmail", () => {
    it("returns a stable error payload and reports unexpected failures", async () => {
      const sendError = new Error("provider failed");
      sendVerificationEmailApiMock.mockRejectedValueOnce(sendError);

      await expect(sendVerificationEmail("collector@example.com", "/en/dashboard", new Headers())).resolves.toEqual({
        ok: false,
        error: "provider failed",
      });

      expect(captureExceptionMock).toHaveBeenCalledWith(sendError);
    });
  });

  describe("maybeSendDaySixVerificationReminder", () => {
    const graceSnapshot = {
      userId: "user-grace",
      email: "grace@example.com",
      createdAt: new Date("2026-03-05T00:00:00.000Z"),
      emailVerified: false,
      hasCredentialAccount: true,
      state: "grace" as const,
    };

    it("does not send before the reminder window or when an existing marker is present", async () => {
      vi.setSystemTime(new Date("2026-03-10T00:00:00.000Z"));

      await expect(maybeSendDaySixVerificationReminder(graceSnapshot, "/en/dashboard", new Headers())).resolves.toEqual(
        { sent: false },
      );

      vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));
      verificationFindFirstMock.mockResolvedValueOnce({ id: "existing-marker" });

      await expect(maybeSendDaySixVerificationReminder(graceSnapshot, "/en/dashboard", new Headers())).resolves.toEqual(
        { sent: false },
      );

      expect(sendVerificationEmailApiMock).not.toHaveBeenCalled();
    });

    it("sends once during the day-six window, persists the marker, and tracks success", async () => {
      verificationFindFirstMock.mockResolvedValueOnce(null);
      sendVerificationEmailApiMock.mockResolvedValueOnce(undefined);
      verificationCreateMock.mockResolvedValueOnce({ id: "created-marker" });

      await expect(maybeSendDaySixVerificationReminder(graceSnapshot, "/en/dashboard", new Headers())).resolves.toEqual(
        { sent: true },
      );

      expect(sendVerificationEmailApiMock).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: {
          email: "grace@example.com",
          callbackURL: "/en/dashboard",
        },
      });
      expect(verificationCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "verification-marker-id",
          identifier: "verification-day6-reminder:user-grace",
          value: "sent",
        }),
      });
      expect(posthogCaptureMock).toHaveBeenCalledWith({
        distinctId: "grace@example.com",
        event: POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_SENT,
        properties: { source: "day6_reminder" },
      });
    });

    it("tracks failures without creating the reminder marker when sending fails", async () => {
      verificationFindFirstMock.mockResolvedValueOnce(null);
      sendVerificationEmailApiMock.mockRejectedValueOnce(new Error("mail provider down"));

      await expect(maybeSendDaySixVerificationReminder(graceSnapshot, "/en/dashboard", new Headers())).resolves.toEqual(
        {
          sent: false,
          error: "mail provider down",
        },
      );

      expect(verificationCreateMock).not.toHaveBeenCalled();
      expect(posthogCaptureMock).toHaveBeenCalledWith({
        distinctId: "grace@example.com",
        event: POSTHOG_EVENTS.AUTH.VERIFY_EMAIL_FAILED,
        properties: { reason: "day6_reminder_send_failed" },
      });
    });
  });
});
