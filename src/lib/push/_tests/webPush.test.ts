import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendPushMessage, type PushMessagePayload, type PushSubscriptionTarget } from "../webPush";

const { setVapidDetailsMock, sendNotificationMock, captureExceptionMock } = vi.hoisted(() => ({
  setVapidDetailsMock: vi.fn(),
  sendNotificationMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

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

  /**
   * A push service that answers and refuses is one subscription having a bad minute, and a batch
   * runs this once per subscriber: reporting each would turn a single provider outage into a flood
   * of identical Sentry events.
   */
  it("does not report a refusal that carries a status code", async () => {
    sendNotificationMock.mockRejectedValueOnce(pushErrorWithStatus(503));

    await sendPushMessage(subscription, payload);

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  /**
   * No status code means nothing answered in a way this code understands, which is the shape of a
   * defect here rather than a bad minute upstream.
   */
  it("reports a failure that carries no status code, without the subscriber's endpoint", async () => {
    const error = new Error("unexpected shape");
    sendNotificationMock.mockRejectedValueOnce(error);

    await sendPushMessage(subscription, payload);

    expect(captureExceptionMock).toHaveBeenCalledExactlyOnceWith(error, {
      tags: { feature: "push", action: "sendPushMessage" },
    });
    // The endpoint is the address of a user's device and must never travel with the report.
    expect(JSON.stringify(captureExceptionMock.mock.calls[0])).not.toContain(subscription.endpoint);
  });
});

/**
 * Missing VAPID keys are the one failure that belongs to EVERY subscription at once. Swallowing it
 * as `TRANSIENT_FAILURE` let push delivery stop product-wide while looking exactly like a push
 * service having a bad minute: nothing in Sentry, and only a counter moving in the dispatch summary.
 *
 * Isolated in its own describe with `resetModules` because `ensureVapidConfigured` memoises success
 * in a module-level flag, so a fresh module instance is the only way to observe the unconfigured
 * path after another test has configured it.
 */
describe("sendPushMessage without VAPID configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  it("throws instead of reporting a per-subscription transient failure", async () => {
    const { sendPushMessage: freshSendPushMessage } = await import("../webPush");

    await expect(freshSendPushMessage(subscription, payload)).rejects.toThrow(/VAPID/i);
    // The send is never attempted: there is no key to sign it with.
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});
