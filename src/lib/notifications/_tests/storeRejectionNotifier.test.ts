import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getNotificationPreferencesMock,
  getUserPushSubscriptionsMock,
  hasNotificationBeenDeliveredMock,
  recordNotificationDeliveryMock,
  pruneExpiredPushSubscriptionMock,
  sendPushMessageMock,
  getPostHogClientMock,
  captureMock,
  getTranslationsMock,
} = vi.hoisted(() => ({
  getNotificationPreferencesMock: vi.fn(),
  getUserPushSubscriptionsMock: vi.fn(),
  hasNotificationBeenDeliveredMock: vi.fn(),
  recordNotificationDeliveryMock: vi.fn(),
  pruneExpiredPushSubscriptionMock: vi.fn(),
  sendPushMessageMock: vi.fn(),
  getPostHogClientMock: vi.fn(),
  captureMock: vi.fn(),
  getTranslationsMock: vi.fn(),
}));

vi.mock("@/lib/data/notifications/notificationQueries", () => ({
  getNotificationPreferences: getNotificationPreferencesMock,
  getUserPushSubscriptions: getUserPushSubscriptionsMock,
  hasNotificationBeenDelivered: hasNotificationBeenDeliveredMock,
}));

vi.mock("@/lib/data/notifications/notificationMutations", () => ({
  recordNotificationDelivery: recordNotificationDeliveryMock,
  pruneExpiredPushSubscription: pruneExpiredPushSubscriptionMock,
}));

vi.mock("@/lib/push", () => ({ sendPushMessage: sendPushMessageMock }));

vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));

vi.mock("next-intl/server", () => ({ getTranslations: getTranslationsMock }));

import {
  NotificationSubjectType,
  NotificationType,
  type StoreRemovalReason,
} from "../../../../generated/prisma/client";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { buildStoreRejectionPayload, notifyStoreRejected } from "../storeRejectionNotifier";

const CREATOR_ID = "creator-1";
const STORE_ID = "store-1";
const STORE_NAME = "Panda Store";

const ALL_ENABLED = {
  [NotificationType.PAYMENT_DUE]: true,
  [NotificationType.ARRIVAL_DUE]: true,
  [NotificationType.ARRIVAL_OVERDUE]: true,
  [NotificationType.STORE_REJECTED]: true,
};

const SUBSCRIPTION = { id: "sub-1", endpoint: "https://push.example.com/a", p256dh: "p", auth: "a" };

function input(overrides: { removalReason?: StoreRemovalReason; locale?: string | null } = {}) {
  return {
    creatorUserId: CREATOR_ID,
    storeId: STORE_ID,
    storeName: STORE_NAME,
    removalReason: overrides.removalReason ?? ("DUPLICATE" as StoreRemovalReason),
    locale: "locale" in overrides ? overrides.locale : "en",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getNotificationPreferencesMock.mockResolvedValue({ ...ALL_ENABLED });
  getUserPushSubscriptionsMock.mockResolvedValue([SUBSCRIPTION]);
  hasNotificationBeenDeliveredMock.mockResolvedValue(false);
  recordNotificationDeliveryMock.mockResolvedValue({ recorded: true });
  sendPushMessageMock.mockResolvedValue("SENT");
  getPostHogClientMock.mockReturnValue({ capture: captureMock });
  // Passthrough translator: the payload title becomes the translation key, so copy-variant
  // selection is asserted by the resolved prefix.
  getTranslationsMock.mockResolvedValue((key: string) => key);
});

describe("notifyStoreRejected", () => {
  it("sends nothing when the store-rejected preference is off (BR-09-01)", async () => {
    getNotificationPreferencesMock.mockResolvedValue({ ...ALL_ENABLED, [NotificationType.STORE_REJECTED]: false });

    await notifyStoreRejected(input());

    expect(getUserPushSubscriptionsMock).not.toHaveBeenCalled();
    expect(sendPushMessageMock).not.toHaveBeenCalled();
    expect(recordNotificationDeliveryMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("sends nothing when the creator has no active subscription", async () => {
    getUserPushSubscriptionsMock.mockResolvedValue([]);

    await notifyStoreRejected(input());

    expect(hasNotificationBeenDeliveredMock).not.toHaveBeenCalled();
    expect(sendPushMessageMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("does not re-send when a notice was already delivered that day (dedup)", async () => {
    hasNotificationBeenDeliveredMock.mockResolvedValue(true);

    await notifyStoreRejected(input());

    expect(sendPushMessageMock).not.toHaveBeenCalled();
    expect(recordNotificationDeliveryMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("sends neutral copy and the neutral variant for a non-abuse removal reason", async () => {
    await notifyStoreRejected(input({ removalReason: "DUPLICATE" as StoreRemovalReason }));

    const payload = sendPushMessageMock.mock.calls[0][1];
    expect(payload.title).toBe("storeRejected.title");
    expect(captureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATION_STORE_REJECTED_SENT,
        properties: { variant: "neutral" },
      }),
    );
  });

  it("sends sanction copy and the sanction variant for an abuse removal reason", async () => {
    await notifyStoreRejected(input({ removalReason: "ABUSE" as StoreRemovalReason }));

    const payload = sendPushMessageMock.mock.calls[0][1];
    expect(payload.title).toBe("storeRejectedAbuse.title");
    expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ properties: { variant: "sanction" } }));
  });

  it("resolves copy in the requested locale, falling back to the default locale", async () => {
    await notifyStoreRejected(input({ locale: "en" }));
    expect(getTranslationsMock).toHaveBeenCalledWith({ locale: "en", namespace: "notifications" });

    getTranslationsMock.mockClear();
    await notifyStoreRejected(input({ locale: null }));
    expect(getTranslationsMock).toHaveBeenCalledWith({ locale: "es", namespace: "notifications" });
  });

  it("records the delivery keyed to midnight UTC and emits the send event on success", async () => {
    await notifyStoreRejected(input());

    expect(recordNotificationDeliveryMock).toHaveBeenCalledTimes(1);
    const delivery = recordNotificationDeliveryMock.mock.calls[0][0];
    expect(delivery).toMatchObject({
      userId: CREATOR_ID,
      type: NotificationType.STORE_REJECTED,
      subjectType: NotificationSubjectType.STORE,
      subjectId: STORE_ID,
    });
    const dueDate: Date = delivery.dueDate;
    expect(dueDate.getUTCHours()).toBe(0);
    expect(dueDate.getUTCMinutes()).toBe(0);
    expect(dueDate.getUTCSeconds()).toBe(0);
    expect(dueDate.getUTCMilliseconds()).toBe(0);
    expect(captureMock).toHaveBeenCalledTimes(1);
  });

  it("prunes an expired endpoint and neither records nor emits when nothing was sent", async () => {
    sendPushMessageMock.mockResolvedValue("EXPIRED");

    await notifyStoreRejected(input());

    expect(pruneExpiredPushSubscriptionMock).toHaveBeenCalledWith(SUBSCRIPTION.endpoint);
    expect(recordNotificationDeliveryMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });
});

describe("buildStoreRejectionPayload", () => {
  const interpolatingTranslator = (key: string, values?: Record<string, string>) =>
    values ? `${key}:${values.store ?? ""}` : key;

  it("selects the neutral prefix, deep-links to the store listing, and interpolates the store name", () => {
    const payload = buildStoreRejectionPayload({
      translate: interpolatingTranslator,
      locale: "en",
      storeId: STORE_ID,
      storeName: STORE_NAME,
      sanction: false,
    });

    expect(payload.title).toBe("storeRejected.title");
    expect(payload.body).toBe(`storeRejected.body:${STORE_NAME}`);
    expect(payload.url).toBe(`/en${ROUTES.stores}`);
    expect(payload.tag).toBe(`${NotificationType.STORE_REJECTED}:${STORE_ID}`);
  });

  it("selects the sanction prefix for an abuse removal", () => {
    const payload = buildStoreRejectionPayload({
      translate: interpolatingTranslator,
      locale: "es",
      storeId: STORE_ID,
      storeName: STORE_NAME,
      sanction: true,
    });

    expect(payload.title).toBe("storeRejectedAbuse.title");
    expect(payload.url).toBe(`/es${ROUTES.stores}`);
  });
});
