import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendPushMessage, type PushMessagePayload, type PushSubscriptionTarget } from "../webPush";

const { setVapidDetailsMock, sendNotificationMock } = vi.hoisted(() => ({
  setVapidDetailsMock: vi.fn(),
  sendNotificationMock: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));

const subscription: PushSubscriptionTarget = {
  endpoint: "https://push.example.com/endpoint-1",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

const payload: PushMessagePayload = {
  title: "Payment due soon",
  body: "A payment is coming up",
  url: "/orders/order-1",
  tag: "payment-due-order-1",
};

function pushErrorWithStatus(statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error("push failed"), { statusCode });
}

describe("sendPushMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-key";
    process.env.VAPID_PRIVATE_KEY = "private-key";
    process.env.VAPID_SUBJECT = "mailto:test@pandatrack.app";
  });

  it("returns SENT when the push service accepts the message", async () => {
    sendNotificationMock.mockResolvedValueOnce(undefined);

    const result = await sendPushMessage(subscription, payload);

    expect(result).toBe("SENT");
    expect(sendNotificationMock).toHaveBeenCalledOnce();
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: subscription.endpoint }),
      JSON.stringify(payload),
    );
  });

  it("returns EXPIRED on a 410 Gone", async () => {
    sendNotificationMock.mockRejectedValueOnce(pushErrorWithStatus(410));

    const result = await sendPushMessage(subscription, payload);

    expect(result).toBe("EXPIRED");
  });

  it("returns EXPIRED on a 404 Not Found", async () => {
    sendNotificationMock.mockRejectedValueOnce(pushErrorWithStatus(404));

    const result = await sendPushMessage(subscription, payload);

    expect(result).toBe("EXPIRED");
  });

  it("returns TRANSIENT_FAILURE on a generic push error", async () => {
    sendNotificationMock.mockRejectedValueOnce(pushErrorWithStatus(500));

    const result = await sendPushMessage(subscription, payload);

    expect(result).toBe("TRANSIENT_FAILURE");
  });

  it("returns TRANSIENT_FAILURE when the error carries no status code", async () => {
    sendNotificationMock.mockRejectedValueOnce(new Error("network down"));

    const result = await sendPushMessage(subscription, payload);

    expect(result).toBe("TRANSIENT_FAILURE");
  });

  it("never throws even when the transport rejects", async () => {
    sendNotificationMock.mockRejectedValueOnce(pushErrorWithStatus(429));

    await expect(sendPushMessage(subscription, payload)).resolves.toBe("TRANSIENT_FAILURE");
  });
});
