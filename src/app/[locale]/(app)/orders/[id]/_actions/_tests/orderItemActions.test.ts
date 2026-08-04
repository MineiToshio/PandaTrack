import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, setOrderItemArrivedAtStoreMock, posthogCaptureMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  setOrderItemArrivedAtStoreMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
}));

// Cache revalidation is a Next request-scoped API; the unit under test only needs it to be
// called, and calling it for real here throws outside a request.
vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({
  revalidateCollectionSurfaces: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/orders/orderMutations", () => ({
  setOrderItemArrivedAtStore: setOrderItemArrivedAtStoreMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { setOrderItemArrivedAction } from "../orderItemActions";

const VALID_ORDER_ID = "clh1234567890abcdefghijk";
const VALID_ITEM_ID = "clh0000000000abcdefghijk";
const AUTHENTICATED_SESSION = { user: { id: "user-1" } };

describe("setOrderItemArrivedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await setOrderItemArrivedAction(VALID_ORDER_ID, VALID_ITEM_ID, true);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(setOrderItemArrivedAtStoreMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid order/item id pair", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await setOrderItemArrivedAction("not-a-cuid", VALID_ITEM_ID, true);

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(setOrderItemArrivedAtStoreMock).not.toHaveBeenCalled();
  });

  it("marks the item arrived at store and tracks the event", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    setOrderItemArrivedAtStoreMock.mockResolvedValue({ ok: true, deliveryState: "ARRIVED_AT_STORE" });

    const result = await setOrderItemArrivedAction(VALID_ORDER_ID, VALID_ITEM_ID, true);

    expect(result).toEqual({ ok: true, arrived: true });
    expect(setOrderItemArrivedAtStoreMock).toHaveBeenCalledWith(VALID_ITEM_ID, "user-1", true);
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.ORDER.ITEM_MARKED_ARRIVED,
      properties: { orderId: VALID_ORDER_ID, itemId: VALID_ITEM_ID },
    });
  });

  it("reverts the item to pending and tracks the reverted event", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    setOrderItemArrivedAtStoreMock.mockResolvedValue({ ok: true, deliveryState: "NONE" });

    const result = await setOrderItemArrivedAction(VALID_ORDER_ID, VALID_ITEM_ID, false);

    expect(result).toEqual({ ok: true, arrived: false });
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.ORDER.ITEM_REVERTED_PENDING,
      properties: { orderId: VALID_ORDER_ID, itemId: VALID_ITEM_ID },
    });
  });

  it("maps a data-layer failure to its error code (e.g. item linked to a live delivery)", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    setOrderItemArrivedAtStoreMock.mockResolvedValue({ ok: false, error: "ITEM_HAS_LIVE_DELIVERY" });

    const result = await setOrderItemArrivedAction(VALID_ORDER_ID, VALID_ITEM_ID, true);

    expect(result).toEqual({ ok: false, error: "ITEM_HAS_LIVE_DELIVERY" });
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    setOrderItemArrivedAtStoreMock.mockRejectedValue(new Error("db down"));

    const result = await setOrderItemArrivedAction(VALID_ORDER_ID, VALID_ITEM_ID, true);

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});
