import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, cancelOrderMock, deleteOrderMock, reactivateOrderMock, posthogCaptureMock, redirectMock } =
  vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    cancelOrderMock: vi.fn(),
    deleteOrderMock: vi.fn(),
    reactivateOrderMock: vi.fn(),
    posthogCaptureMock: vi.fn(),
    redirectMock: vi.fn(),
  }));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/orders/orderMutations", () => ({
  cancelOrder: cancelOrderMock,
  deleteOrder: deleteOrderMock,
  reactivateOrder: reactivateOrderMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error("NEXT_REDIRECT");
  },
}));

import { cancelOrderAction, deleteOrderAction, reactivateOrderAction } from "../orderLifecycleActions";

const VALID_ORDER_ID = "clh1234567890abcdefghijk";
const AUTHENTICATED_SESSION = { user: { id: "user-1" } };

describe("cancelOrderAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await cancelOrderAction(VALID_ORDER_ID);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(cancelOrderMock).not.toHaveBeenCalled();
  });

  it("rejects an order id that fails validation", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await cancelOrderAction("not-a-cuid");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(cancelOrderMock).not.toHaveBeenCalled();
  });

  it("cancels the order and tracks the event on the happy path", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    cancelOrderMock.mockResolvedValue({ ok: true });

    const result = await cancelOrderAction(VALID_ORDER_ID, "  Changed my mind  ");

    expect(result).toEqual({ ok: true });
    expect(cancelOrderMock).toHaveBeenCalledWith(VALID_ORDER_ID, "user-1", "Changed my mind", "keep");
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.ORDER.CANCELLED,
      properties: { orderId: VALID_ORDER_ID, hasReason: true, paymentsChoice: "keep" },
    });
  });

  it("defaults to keeping payments and passes null when the reason is blank", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    cancelOrderMock.mockResolvedValue({ ok: true });

    await cancelOrderAction(VALID_ORDER_ID, "   ");

    expect(cancelOrderMock).toHaveBeenCalledWith(VALID_ORDER_ID, "user-1", null, "keep");
  });

  it("forwards the remove choice and records it on the tracked event", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    cancelOrderMock.mockResolvedValue({ ok: true });

    const result = await cancelOrderAction(VALID_ORDER_ID, null, "remove");

    expect(result).toEqual({ ok: true });
    expect(cancelOrderMock).toHaveBeenCalledWith(VALID_ORDER_ID, "user-1", null, "remove");
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.ORDER.CANCELLED,
      properties: { orderId: VALID_ORDER_ID, hasReason: false, paymentsChoice: "remove" },
    });
  });

  it("rejects an invalid payments choice via schema validation", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    // @ts-expect-error deliberately passing an invalid choice to assert the boundary rejects it
    const result = await cancelOrderAction(VALID_ORDER_ID, null, "transfer");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(cancelOrderMock).not.toHaveBeenCalled();
  });

  it("maps a data-layer failure to its error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    cancelOrderMock.mockResolvedValue({ ok: false, error: "HAS_LIVE_DELIVERY_LINKS" });

    const result = await cancelOrderAction(VALID_ORDER_ID);

    expect(result).toEqual({ ok: false, error: "HAS_LIVE_DELIVERY_LINKS" });
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    cancelOrderMock.mockRejectedValue(new Error("db down"));

    const result = await cancelOrderAction(VALID_ORDER_ID);

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});

describe("deleteOrderAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await deleteOrderAction(VALID_ORDER_ID, "en");

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(deleteOrderMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid order id", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await deleteOrderAction("not-a-cuid", "en");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(deleteOrderMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale before it ever reaches redirect()", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await deleteOrderAction(VALID_ORDER_ID, "fr");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(deleteOrderMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("deletes the order, tracks the event, and redirects to the orders list", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    deleteOrderMock.mockResolvedValue({ ok: true });

    await expect(deleteOrderAction(VALID_ORDER_ID, "en")).rejects.toThrow("NEXT_REDIRECT");

    expect(deleteOrderMock).toHaveBeenCalledWith(VALID_ORDER_ID, "user-1");
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.ORDER.DELETED,
      properties: { orderId: VALID_ORDER_ID },
    });
    expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("/en"));
  });

  it("maps a data-layer failure to its error code without redirecting", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    deleteOrderMock.mockResolvedValue({ ok: false, error: "HAS_LIVE_DELIVERY_LINKS" });

    const result = await deleteOrderAction(VALID_ORDER_ID, "en");

    expect(result).toEqual({ ok: false, error: "HAS_LIVE_DELIVERY_LINKS" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    deleteOrderMock.mockRejectedValue(new Error("db down"));

    const result = await deleteOrderAction(VALID_ORDER_ID, "en");

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});

describe("reactivateOrderAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await reactivateOrderAction(VALID_ORDER_ID);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(reactivateOrderMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid order id", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await reactivateOrderAction("not-a-cuid");

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("reactivates the order and tracks the event on the happy path", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    reactivateOrderMock.mockResolvedValue({ ok: true });

    const result = await reactivateOrderAction(VALID_ORDER_ID);

    expect(result).toEqual({ ok: true });
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.ORDER.REACTIVATED,
      properties: { orderId: VALID_ORDER_ID },
    });
  });

  it("maps a data-layer failure to its error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    reactivateOrderMock.mockResolvedValue({ ok: false, error: "ORDER_NOT_CANCELLED" });

    const result = await reactivateOrderAction(VALID_ORDER_ID);

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_CANCELLED" });
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    reactivateOrderMock.mockRejectedValue(new Error("db down"));

    const result = await reactivateOrderAction(VALID_ORDER_ID);

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});
