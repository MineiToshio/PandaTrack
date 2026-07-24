import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  getModerationStoreBySlugMock,
  approveStoreMock,
  removeStoreMock,
  notifyStoreRejectedMock,
  getPostHogClientMock,
  captureMock,
  revalidatePathMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getModerationStoreBySlugMock: vi.fn(),
  approveStoreMock: vi.fn(),
  removeStoreMock: vi.fn(),
  notifyStoreRejectedMock: vi.fn(),
  getPostHogClientMock: vi.fn(),
  captureMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({
  requireAdmin: requireAdminMock,
  AdminAccessError: class AdminAccessError extends Error {},
}));

vi.mock("@/lib/data/stores/storeModerationMutations", () => ({
  approveStore: approveStoreMock,
  removeStore: removeStoreMock,
  flagStore: vi.fn(),
  unflagStore: vi.fn(),
  getModerationStoreBySlug: getModerationStoreBySlugMock,
  StoreModerationError: class StoreModerationError extends Error {},
}));

vi.mock("@/lib/notifications/storeRejectionNotifier", () => ({ notifyStoreRejected: notifyStoreRejectedMock }));

vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { approveStoreAction, removeStoreAction } from "../moderateStore";

const SESSION = { user: { id: "admin-1" } };
const STORE_ROW = { id: "store-1", slug: "panda-store", status: "APPROVED" as const };

const REMOVE_RESULT = {
  id: "store-1",
  slug: "panda-store",
  status: "REJECTED" as const,
  previousStatus: "APPROVED" as const,
  createdByUserId: "creator-1",
  name: "Panda Store",
};

const APPROVE_RESULT = {
  id: "store-1",
  slug: "panda-store",
  status: "APPROVED" as const,
  previousStatus: "PENDING" as const,
  createdByUserId: "creator-1",
  name: "Panda Store",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(SESSION);
  getModerationStoreBySlugMock.mockResolvedValue(STORE_ROW);
  approveStoreMock.mockResolvedValue(APPROVE_RESULT);
  removeStoreMock.mockResolvedValue(REMOVE_RESULT);
  notifyStoreRejectedMock.mockResolvedValue(undefined);
  getPostHogClientMock.mockReturnValue({ capture: captureMock });
});

describe("removeStoreAction", () => {
  it("notifies the store creator after a successful removal", async () => {
    const result = await removeStoreAction({ slug: "panda-store", locale: "en", removalReason: "ABUSE" });

    expect(result).toEqual({ success: true });
    expect(notifyStoreRejectedMock).toHaveBeenCalledWith({
      creatorUserId: "creator-1",
      storeId: "store-1",
      storeName: "Panda Store",
      removalReason: "ABUSE",
      locale: "en",
    });
  });

  it("still returns moderation success when the notifier throws, capturing it once", async () => {
    notifyStoreRejectedMock.mockRejectedValue(new Error("push down"));

    const result = await removeStoreAction({ slug: "panda-store", locale: "en", removalReason: "DUPLICATE" });

    expect(result).toEqual({ success: true });
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});

describe("approveStoreAction", () => {
  it("does not notify the creator on approval (AC-09-15)", async () => {
    const result = await approveStoreAction({ slug: "panda-store", locale: "en" });

    expect(result).toEqual({ success: true });
    expect(notifyStoreRejectedMock).not.toHaveBeenCalled();
  });
});
