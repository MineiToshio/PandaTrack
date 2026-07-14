import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getExistingSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeBrowserToPush,
  unsubscribeBrowserFromPush,
} from "../pushSubscription";

const SUBSCRIPTION_JSON = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

function buildBrowserSubscription(overrides?: { unsubscribe?: () => Promise<boolean> }) {
  return {
    endpoint: SUBSCRIPTION_JSON.endpoint,
    toJSON: () => SUBSCRIPTION_JSON,
    unsubscribe: overrides?.unsubscribe ?? vi.fn().mockResolvedValue(true),
  };
}

type PushManagerStub = {
  getSubscription: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};

function installSupportedBrowser(pushManager: PushManagerStub, permission: NotificationPermission = "default") {
  const requestPermission = vi.fn().mockResolvedValue("granted");
  vi.stubGlobal("navigator", {
    serviceWorker: { ready: Promise.resolve({ pushManager }) },
    userAgent: "Test/1.0",
  });
  vi.stubGlobal("window", { PushManager: class {}, Notification: class {} });
  vi.stubGlobal("Notification", { permission, requestPermission });
  // atob is available in Node, but ensure it exists in this scope.
  vi.stubGlobal("atob", (value: string) => Buffer.from(value, "base64").toString("binary"));
  return { requestPermission };
}

// A minimal, valid URL-safe base64 VAPID key (bytes do not need to be a real key for the unit test).
const VAPID_KEY = "BOe-abc_123";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isPushSupported", () => {
  it("returns false when the Push API is missing", () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("window", {});
    expect(isPushSupported()).toBe(false);
  });

  it("returns true when service worker, PushManager, and Notification are present", () => {
    installSupportedBrowser({ getSubscription: vi.fn(), subscribe: vi.fn() });
    expect(isPushSupported()).toBe(true);
  });
});

describe("getNotificationPermission", () => {
  it("reports unsupported when Notification is missing", () => {
    vi.stubGlobal("window", {});
    expect(getNotificationPermission()).toBe("unsupported");
  });

  it("reports the current permission", () => {
    installSupportedBrowser({ getSubscription: vi.fn(), subscribe: vi.fn() }, "granted");
    expect(getNotificationPermission()).toBe("granted");
  });
});

describe("subscribeBrowserToPush", () => {
  it("returns unsupported when the browser lacks push", async () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("window", {});
    const result = await subscribeBrowserToPush(VAPID_KEY);
    expect(result).toEqual({ status: "unsupported" });
  });

  it("returns permission-denied and does not subscribe when permission is refused", async () => {
    const pushManager: PushManagerStub = { getSubscription: vi.fn(), subscribe: vi.fn() };
    const { requestPermission } = installSupportedBrowser(pushManager);
    requestPermission.mockResolvedValue("denied");

    const result = await subscribeBrowserToPush(VAPID_KEY);

    expect(result).toEqual({ status: "permission-denied" });
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("subscribes and returns the serialized payload on grant", async () => {
    const pushManager: PushManagerStub = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(buildBrowserSubscription()),
    };
    installSupportedBrowser(pushManager);

    const result = await subscribeBrowserToPush(VAPID_KEY);

    expect(result).toEqual({
      status: "subscribed",
      subscription: {
        endpoint: SUBSCRIPTION_JSON.endpoint,
        keys: SUBSCRIPTION_JSON.keys,
        userAgent: "Test/1.0",
      },
    });
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
  });

  it("reuses an existing subscription instead of creating a duplicate", async () => {
    const pushManager: PushManagerStub = {
      getSubscription: vi.fn().mockResolvedValue(buildBrowserSubscription()),
      subscribe: vi.fn(),
    };
    installSupportedBrowser(pushManager);

    const result = await subscribeBrowserToPush(VAPID_KEY);

    expect(result.status).toBe("subscribed");
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("maps an unexpected failure to failed", async () => {
    const pushManager: PushManagerStub = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockRejectedValue(new Error("push service down")),
    };
    installSupportedBrowser(pushManager);

    const result = await subscribeBrowserToPush(VAPID_KEY);

    expect(result).toEqual({ status: "failed" });
  });
});

describe("getExistingSubscription", () => {
  it("returns null when there is no live subscription", async () => {
    installSupportedBrowser({ getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() });
    expect(await getExistingSubscription()).toBeNull();
  });

  it("returns the serialized existing subscription", async () => {
    installSupportedBrowser({
      getSubscription: vi.fn().mockResolvedValue(buildBrowserSubscription()),
      subscribe: vi.fn(),
    });
    const result = await getExistingSubscription();
    expect(result).toEqual({
      endpoint: SUBSCRIPTION_JSON.endpoint,
      keys: SUBSCRIPTION_JSON.keys,
      userAgent: "Test/1.0",
    });
  });
});

describe("unsubscribeBrowserFromPush", () => {
  it("returns null when there is no live subscription", async () => {
    installSupportedBrowser({ getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() });
    expect(await unsubscribeBrowserFromPush()).toBeNull();
  });

  it("unsubscribes and returns the removed endpoint", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    installSupportedBrowser({
      getSubscription: vi.fn().mockResolvedValue(buildBrowserSubscription({ unsubscribe })),
      subscribe: vi.fn(),
    });

    const endpoint = await unsubscribeBrowserFromPush();

    expect(endpoint).toBe(SUBSCRIPTION_JSON.endpoint);
    expect(unsubscribe).toHaveBeenCalled();
  });
});
