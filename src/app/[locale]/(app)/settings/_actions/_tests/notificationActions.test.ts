import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  upsertPushSubscriptionMock,
  removePushSubscriptionMock,
  pruneExpiredPushSubscriptionMock,
  setNotificationPreferenceMock,
  getUserPushSubscriptionsMock,
  sendPushMessageMock,
  getPostHogClientMock,
  captureMock,
  captureExceptionMock,
  getTranslationsMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  upsertPushSubscriptionMock: vi.fn(),
  removePushSubscriptionMock: vi.fn(),
  pruneExpiredPushSubscriptionMock: vi.fn(),
  setNotificationPreferenceMock: vi.fn(),
  getUserPushSubscriptionsMock: vi.fn(),
  sendPushMessageMock: vi.fn(),
  getPostHogClientMock: vi.fn(),
  captureMock: vi.fn(),
  captureExceptionMock: vi.fn(),
  getTranslationsMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/notifications/notificationMutations", () => ({
  upsertPushSubscription: upsertPushSubscriptionMock,
  removePushSubscription: removePushSubscriptionMock,
  pruneExpiredPushSubscription: pruneExpiredPushSubscriptionMock,
  setNotificationPreference: setNotificationPreferenceMock,
}));

vi.mock("@/lib/data/notifications/notificationQueries", () => ({
  getUserPushSubscriptions: getUserPushSubscriptionsMock,
}));

vi.mock("@/lib/push", () => ({ sendPushMessage: sendPushMessageMock }));

vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));

vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

vi.mock("next-intl/server", () => ({ getTranslations: getTranslationsMock }));

import {
  sendTestNotificationAction,
  setNotificationPreferenceAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "../notificationActions";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };

const VALID_SUBSCRIPTION = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
  userAgent: "Test/1.0",
};

beforeEach(() => {
  vi.clearAllMocks();
  getPostHogClientMock.mockReturnValue({ capture: captureMock });
  getTranslationsMock.mockResolvedValue((key: string) => key);
});

describe("subscribeToPushAction", () => {
  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await subscribeToPushAction(VALID_SUBSCRIPTION);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(upsertPushSubscriptionMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed payload with SUBSCRIPTION_INVALID", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await subscribeToPushAction({
      endpoint: "not-a-url",
      keys: { p256dh: "", auth: "" },
    });

    expect(result).toEqual({ ok: false, error: "SUBSCRIPTION_INVALID" });
    expect(upsertPushSubscriptionMock).not.toHaveBeenCalled();
  });

  it("upserts the subscription for the session user", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    upsertPushSubscriptionMock.mockResolvedValue(undefined);

    const result = await subscribeToPushAction(VALID_SUBSCRIPTION);

    expect(result).toEqual({ ok: true });
    expect(upsertPushSubscriptionMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ endpoint: VALID_SUBSCRIPTION.endpoint }),
    );
  });

  it("captures an unexpected error and returns generic", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    upsertPushSubscriptionMock.mockRejectedValue(new Error("db down"));

    const result = await subscribeToPushAction(VALID_SUBSCRIPTION);

    expect(result).toEqual({ ok: false, error: "generic" });
    expect(captureExceptionMock).toHaveBeenCalled();
  });
});

describe("unsubscribeFromPushAction", () => {
  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await unsubscribeFromPushAction(VALID_SUBSCRIPTION.endpoint);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("returns SUBSCRIPTION_NOT_FOUND when the endpoint is not on file", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getUserPushSubscriptionsMock.mockResolvedValue([{ endpoint: "https://push.example.com/other" }]);

    const result = await unsubscribeFromPushAction(VALID_SUBSCRIPTION.endpoint);

    expect(result).toEqual({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" });
    expect(removePushSubscriptionMock).not.toHaveBeenCalled();
  });

  it("removes an owned endpoint", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getUserPushSubscriptionsMock.mockResolvedValue([{ endpoint: VALID_SUBSCRIPTION.endpoint }]);
    removePushSubscriptionMock.mockResolvedValue(undefined);

    const result = await unsubscribeFromPushAction(VALID_SUBSCRIPTION.endpoint);

    expect(result).toEqual({ ok: true });
    expect(removePushSubscriptionMock).toHaveBeenCalledWith("user-1", VALID_SUBSCRIPTION.endpoint);
  });
});

describe("setNotificationPreferenceAction", () => {
  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await setNotificationPreferenceAction({ type: "PAYMENT_DUE", enabled: false });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects an invalid reminder type", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await setNotificationPreferenceAction({
      type: "NOPE",
      enabled: true,
    } as unknown as Parameters<typeof setNotificationPreferenceAction>[0]);

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(setNotificationPreferenceMock).not.toHaveBeenCalled();
  });

  it("persists a valid per-type preference", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    setNotificationPreferenceMock.mockResolvedValue(undefined);

    const result = await setNotificationPreferenceAction({ type: "ARRIVAL_OVERDUE", enabled: false });

    expect(result).toEqual({ ok: true });
    expect(setNotificationPreferenceMock).toHaveBeenCalledWith("user-1", "ARRIVAL_OVERDUE", false);
  });
});

describe("sendTestNotificationAction", () => {
  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await sendTestNotificationAction("en");

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("returns SUBSCRIPTION_NOT_FOUND when the collector has no subscriptions", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getUserPushSubscriptionsMock.mockResolvedValue([]);

    const result = await sendTestNotificationAction("en");

    expect(result).toEqual({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" });
    expect(sendPushMessageMock).not.toHaveBeenCalled();
  });

  it("classifies results, prunes expired endpoints, and captures the analytics event", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getUserPushSubscriptionsMock.mockResolvedValue([
      { endpoint: "https://push.example.com/sent", p256dh: "a", auth: "b" },
      { endpoint: "https://push.example.com/expired", p256dh: "c", auth: "d" },
      { endpoint: "https://push.example.com/failed", p256dh: "e", auth: "f" },
    ]);
    sendPushMessageMock
      .mockResolvedValueOnce("SENT")
      .mockResolvedValueOnce("EXPIRED")
      .mockResolvedValueOnce("TRANSIENT_FAILURE");

    const result = await sendTestNotificationAction("en");

    expect(result).toEqual({ ok: true, sent: 1, expired: 1, failed: 1 });
    expect(pruneExpiredPushSubscriptionMock).toHaveBeenCalledWith("https://push.example.com/expired");
    expect(pruneExpiredPushSubscriptionMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-1",
        event: "notification_test_sent",
        properties: { sent: 1, expired: 1, failed: 1 },
      }),
    );
  });

  it("falls back to the default locale for an unknown locale", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getUserPushSubscriptionsMock.mockResolvedValue([
      { endpoint: "https://push.example.com/x", p256dh: "a", auth: "b" },
    ]);
    sendPushMessageMock.mockResolvedValue("SENT");

    await sendTestNotificationAction("fr");

    expect(getTranslationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "es", namespace: "notifications" }),
    );
  });
});
