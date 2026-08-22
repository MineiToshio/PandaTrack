import { POSTHOG_EVENTS } from "@/lib/constants";
import { addUtcDays, utcMidnightToday } from "@/test/domainDateFixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  markDeliveryDeliveredMock,
  reopenDeliveryMock,
  cancelDeliveryMock,
  deleteDeliveryMock,
  posthogCaptureMock,
  redirectMock,
  runOrderCloseMoneyTransactionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  markDeliveryDeliveredMock: vi.fn(),
  reopenDeliveryMock: vi.fn(),
  cancelDeliveryMock: vi.fn(),
  deleteDeliveryMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  redirectMock: vi.fn(),
  runOrderCloseMoneyTransactionMock: vi.fn(),
}));

// Cache revalidation is a Next request-scoped API; the unit under test only needs it to be
// called, and calling it for real here throws outside a request.
vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({
  revalidateCollectionSurfaces: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({
  markDeliveryDelivered: markDeliveryDeliveredMock,
  reopenDelivery: reopenDeliveryMock,
  cancelDelivery: cancelDeliveryMock,
  deleteDelivery: deleteDeliveryMock,
}));

vi.mock("@/lib/data/orders/storePaymentMutations", () => ({
  runOrderCloseMoneyTransaction: runOrderCloseMoneyTransactionMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error("NEXT_REDIRECT");
  },
}));

import {
  cancelDeliveryAction,
  deleteDeliveryAction,
  markDeliveredAction,
  reopenDeliveryAction,
} from "../deliveryLifecycleActions";

const VALID_DELIVERY_ID = "clh1234567890abcdefghijk";
const AUTHENTICATED_SESSION = { user: { id: "user-1" } };
const PAST_DATE = new Date("2026-01-01T00:00:00Z");

describe("markDeliveredAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runOrderCloseMoneyTransactionMock.mockResolvedValue([]);
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await markDeliveredAction(VALID_DELIVERY_ID, PAST_DATE);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(markDeliveryDeliveredMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid delivery id", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await markDeliveredAction("not-a-cuid", PAST_DATE);

    expect(result.ok).toBe(false);
    expect(markDeliveryDeliveredMock).not.toHaveBeenCalled();
  });

  it("rejects a receivedDate in the future", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    const futureDate = addUtcDays(utcMidnightToday(), 1);

    const result = await markDeliveredAction(VALID_DELIVERY_ID, futureDate);

    expect(result).toEqual({ ok: false, error: "RECEIVED_DATE_IN_FUTURE" });
    expect(markDeliveryDeliveredMock).not.toHaveBeenCalled();
  });

  it("rejects a receivedDate that did not go through toDomainDate", async () => {
    // The regression: `MarkDeliveredModal` used to hand the picker's LOCAL-midnight `Date` straight
    // to this action, and a `Date` crosses the Server Action boundary as its exact instant, so the
    // row landed at 05:00Z from Lima instead of 00:00Z. Two `delivery.receivedDate` rows in the
    // collection were written that way before the schema started refusing.
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    const localMidnightInLima = new Date("2026-01-01T05:00:00.000Z");

    const result = await markDeliveredAction(VALID_DELIVERY_ID, localMidnightInLima);

    expect(result).toEqual({ ok: false, error: "DATE_NOT_UTC_MIDNIGHT" });
    expect(markDeliveryDeliveredMock).not.toHaveBeenCalled();
  });

  it("marks the delivery delivered and tracks the event", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    markDeliveryDeliveredMock.mockResolvedValue({ ok: true, productCount: 3, closedOrders: [] });

    const result = await markDeliveredAction(VALID_DELIVERY_ID, PAST_DATE);

    expect(result).toEqual({ ok: true, consumedUnassignedMinor: 0, moneyTransactionPending: false });
    expect(markDeliveryDeliveredMock).toHaveBeenCalledWith(VALID_DELIVERY_ID, "user-1", PAST_DATE);
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.MARKED_DELIVERED,
      properties: { deliveryId: VALID_DELIVERY_ID, productCount: 3 },
    });
  });

  it("maps a data-layer failure to its error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    markDeliveryDeliveredMock.mockResolvedValue({ ok: false, error: "DELIVERY_NOT_FOUND" });

    const result = await markDeliveredAction(VALID_DELIVERY_ID, PAST_DATE);

    expect(result).toEqual({ ok: false, error: "DELIVERY_NOT_FOUND" });
    expect(runOrderCloseMoneyTransactionMock).not.toHaveBeenCalled();
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    markDeliveryDeliveredMock.mockRejectedValue(new Error("db down"));

    const result = await markDeliveredAction(VALID_DELIVERY_ID, PAST_DATE);

    expect(result).toEqual({ ok: false, error: "server_error" });
  });

  describe("order-close consumption (WO-08, FR-08-46)", () => {
    const CLOSED_ORDER = { orderId: "order-1", storeId: "store-1", currencyCode: "PEN" };

    it("calls the money transaction only AFTER the delivery transaction resolved ok, consumption-only", async () => {
      markDeliveryDeliveredMock.mockResolvedValue({ ok: true, productCount: 2, closedOrders: [CLOSED_ORDER] });
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: "order-1", status: "settled", consumedMinor: 1500, settledAmountMinor: null },
      ]);
      getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

      const result = await markDeliveredAction(VALID_DELIVERY_ID, PAST_DATE);

      expect(markDeliveryDeliveredMock).toHaveBeenCalledTimes(1);
      expect(runOrderCloseMoneyTransactionMock).toHaveBeenCalledWith({
        userId: "user-1",
        deliveryId: VALID_DELIVERY_ID,
        closedOrders: [{ orderId: "order-1", closed: true }],
      });
      expect(result).toEqual({ ok: true, consumedUnassignedMinor: 1500, moneyTransactionPending: false });
    });

    it("never enables a settlement half: this launcher renders no checkbox", async () => {
      markDeliveryDeliveredMock.mockResolvedValue({ ok: true, productCount: 1, closedOrders: [CLOSED_ORDER] });
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: "order-1", status: "settled", consumedMinor: 0, settledAmountMinor: null },
      ]);
      getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

      await markDeliveredAction(VALID_DELIVERY_ID, PAST_DATE);

      const call = runOrderCloseMoneyTransactionMock.mock.calls[0][0];
      expect(call.closedOrders[0]).not.toHaveProperty("settlement");
    });

    it("reports consumed_unassigned_minor on the analytics event only when it moved money", async () => {
      markDeliveryDeliveredMock.mockResolvedValue({ ok: true, productCount: 1, closedOrders: [CLOSED_ORDER] });
      runOrderCloseMoneyTransactionMock.mockResolvedValue([
        { orderId: "order-1", status: "settled", consumedMinor: 2000, settledAmountMinor: null },
      ]);
      getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

      await markDeliveredAction(VALID_DELIVERY_ID, PAST_DATE);

      expect(posthogCaptureMock).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ consumed_unassigned_minor: 2000 }),
        }),
      );
    });

    it("never turns the delivery already committed into a failure when the money transaction throws", async () => {
      markDeliveryDeliveredMock.mockResolvedValue({ ok: true, productCount: 1, closedOrders: [CLOSED_ORDER] });
      runOrderCloseMoneyTransactionMock.mockRejectedValue(new Error("db down"));
      getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

      const result = await markDeliveredAction(VALID_DELIVERY_ID, PAST_DATE);

      expect(result).toEqual({ ok: true, consumedUnassignedMinor: 0, moneyTransactionPending: true });
    });
  });
});

describe("reopenDeliveryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await reopenDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(reopenDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid delivery id", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await reopenDeliveryAction("not-a-cuid");

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("reopens the delivery and tracks the event", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    reopenDeliveryMock.mockResolvedValue({
      ok: true,
      productCount: 2,
      revertedSettlements: { totalAmountMinor: 0, payments: [] },
    });

    const result = await reopenDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({
      ok: true,
      revertedSettlements: { totalAmountMinor: 0, payments: [] },
    });
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.REOPENED,
      properties: { deliveryId: VALID_DELIVERY_ID, productCount: 2 },
    });
  });

  it("adds settlement_reverted_amount_minor to the analytics event when a settlement was deleted", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    reopenDeliveryMock.mockResolvedValue({
      ok: true,
      productCount: 2,
      revertedSettlements: { totalAmountMinor: 5000, payments: [{ id: "payment-1" }] },
    });

    await reopenDeliveryAction(VALID_DELIVERY_ID);

    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.REOPENED,
      properties: { deliveryId: VALID_DELIVERY_ID, productCount: 2, settlement_reverted_amount_minor: 5000 },
    });
  });

  it("adds consumption_survived_amount_minor to the analytics event and surfaces it in the result when consumption survives the reopen", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    reopenDeliveryMock.mockResolvedValue({
      ok: true,
      productCount: 2,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 1200,
        survivingConsumedAllocations: [{ amountMinor: 1200, currencyCode: "USD" }],
      },
    });

    const result = await reopenDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({
      ok: true,
      revertedSettlements: {
        totalAmountMinor: 0,
        payments: [],
        survivingConsumedMinor: 1200,
        survivingConsumedAllocations: [{ amountMinor: 1200, currencyCode: "USD" }],
      },
    });
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.REOPENED,
      properties: { deliveryId: VALID_DELIVERY_ID, productCount: 2, consumption_survived_amount_minor: 1200 },
    });
  });

  it("maps a data-layer failure to its error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    reopenDeliveryMock.mockResolvedValue({ ok: false, error: "DELIVERY_NOT_FOUND" });

    const result = await reopenDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({ ok: false, error: "DELIVERY_NOT_FOUND" });
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    reopenDeliveryMock.mockRejectedValue(new Error("db down"));

    const result = await reopenDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});

describe("cancelDeliveryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await cancelDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(cancelDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid delivery id", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await cancelDeliveryAction("not-a-cuid");

    expect(result).toEqual({ ok: false, error: "validation" });
  });

  it("cancels the delivery and tracks the event", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    cancelDeliveryMock.mockResolvedValue({ ok: true, productCount: 1 });

    const result = await cancelDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({ ok: true });
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.CANCELLED,
      properties: { deliveryId: VALID_DELIVERY_ID, productCount: 1 },
    });
  });

  it("maps a data-layer failure to its error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    cancelDeliveryMock.mockResolvedValue({ ok: false, error: "DELIVERY_NOT_FOUND" });

    const result = await cancelDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({ ok: false, error: "DELIVERY_NOT_FOUND" });
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    cancelDeliveryMock.mockRejectedValue(new Error("db down"));

    const result = await cancelDeliveryAction(VALID_DELIVERY_ID);

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});

describe("deleteDeliveryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await deleteDeliveryAction(VALID_DELIVERY_ID, "en");

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(deleteDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid delivery id", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await deleteDeliveryAction("not-a-cuid", "en");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(deleteDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale before it ever reaches redirect()", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await deleteDeliveryAction(VALID_DELIVERY_ID, "fr");

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(deleteDeliveryMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("deletes the delivery, tracks the event, and redirects to the deliveries list", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    deleteDeliveryMock.mockResolvedValue({ ok: true, productCount: 4 });

    await expect(deleteDeliveryAction(VALID_DELIVERY_ID, "en")).rejects.toThrow("NEXT_REDIRECT");

    expect(deleteDeliveryMock).toHaveBeenCalledWith(VALID_DELIVERY_ID, "user-1");
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.DELETED,
      properties: { deliveryId: VALID_DELIVERY_ID, productCount: 4 },
    });
    expect(redirectMock).toHaveBeenCalledWith(expect.stringContaining("/en"));
  });

  it("maps a data-layer failure to its error code without redirecting", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    deleteDeliveryMock.mockResolvedValue({ ok: false, error: "DELIVERY_NOT_FOUND" });

    const result = await deleteDeliveryAction(VALID_DELIVERY_ID, "en");

    expect(result).toEqual({ ok: false, error: "DELIVERY_NOT_FOUND" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    deleteDeliveryMock.mockRejectedValue(new Error("db down"));

    const result = await deleteDeliveryAction(VALID_DELIVERY_ID, "en");

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});
