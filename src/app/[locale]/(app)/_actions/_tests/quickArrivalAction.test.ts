import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, createDeliveryMock, getDeliverySourceOrderMock, preferencesMock, posthogCaptureMock } =
  vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    createDeliveryMock: vi.fn(),
    getDeliverySourceOrderMock: vi.fn(),
    preferencesMock: vi.fn(),
    posthogCaptureMock: vi.fn(),
  }));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({ createDelivery: createDeliveryMock }));

vi.mock("@/lib/data/deliveries/deliveryQueries", () => ({ getDeliverySourceOrder: getDeliverySourceOrderMock }));

vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getCollectorPreferencesSnapshot: preferencesMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
  captureException: vi.fn(),
}));

import { quickArrivalAction, type QuickArrivalActionInput } from "../quickArrivalAction";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };
const VALID_ORDER_ID = "clh1234567890abcdefghijk";
const VALID_PRODUCT_ID = "clh0000000000abcdefghijk";
const RECEIVED_DATE = new Date("2026-05-02T00:00:00.000Z");

function buildInput(overrides: Partial<QuickArrivalActionInput> = {}): QuickArrivalActionInput {
  return {
    orderId: VALID_ORDER_ID,
    productIds: [VALID_PRODUCT_ID],
    receivedDate: RECEIVED_DATE,
    shippedDate: null,
    cost: 0,
    currencyCode: "USD",
    exchangeRate: null,
    ...overrides,
  };
}

describe("quickArrivalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getDeliverySourceOrderMock.mockResolvedValue({
      orderId: VALID_ORDER_ID,
      orderHumanReadableId: "PED-001",
      storeId: "store-1",
      storeName: "AmiAmi",
      status: "OPEN",
    });
    preferencesMock.mockResolvedValue({ baseCurrencyCode: "USD" });
    createDeliveryMock.mockResolvedValue({ ok: true, deliveryId: "delivery-1", productCount: 1, orderCount: 1 });
  });

  it("rejects an unauthenticated caller before touching the data layer", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(getDeliverySourceOrderMock).not.toHaveBeenCalled();
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("creates a delivery already received, with the store resolved from the owned order", async () => {
    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: true, deliveryId: "delivery-1" });
    expect(createDeliveryMock).toHaveBeenCalledWith("user-1", {
      storeId: "store-1",
      deliveryDate: RECEIVED_DATE,
      receivedDate: RECEIVED_DATE,
      cost: 0,
      currencyCode: "USD",
      exchangeRate: null,
      productIds: [VALID_PRODUCT_ID],
    });
  });

  it("uses the supplied dispatch date when the collector knows it", async () => {
    const shippedDate = new Date("2026-04-20T00:00:00.000Z");

    await quickArrivalAction(buildInput({ shippedDate }));

    expect(createDeliveryMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ deliveryDate: shippedDate, receivedDate: RECEIVED_DATE }),
    );
  });

  it("refuses a dispatch date later than the arrival date", async () => {
    const result = await quickArrivalAction(buildInput({ shippedDate: new Date("2026-05-03T00:00:00.000Z") }));

    expect(result).toEqual({ ok: false, error: "RECEIVED_BEFORE_SHIPPED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses a future arrival date", async () => {
    const future = new Date(Date.now() + 86_400_000);

    const result = await quickArrivalAction(buildInput({ receivedDate: future }));

    expect(result).toEqual({ ok: false, error: "RECEIVED_DATE_IN_FUTURE" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses an order that is not the caller's", async () => {
    getDeliverySourceOrderMock.mockResolvedValue(null);

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "ORDER_NOT_FOUND" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses a cancelled order", async () => {
    getDeliverySourceOrderMock.mockResolvedValue({
      orderId: VALID_ORDER_ID,
      orderHumanReadableId: "PED-001",
      storeId: "store-1",
      storeName: "AmiAmi",
      status: "CANCELLED",
    });

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "ORDER_CANCELLED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("requires a rate when the cost currency differs from the collector base", async () => {
    const result = await quickArrivalAction(buildInput({ currencyCode: "JPY", cost: 1500 }));

    expect(result).toEqual({ ok: false, error: "EXCHANGE_RATE_REQUIRED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("accepts a foreign currency when the collector has no base currency set", async () => {
    preferencesMock.mockResolvedValue({ baseCurrencyCode: null });

    const result = await quickArrivalAction(buildInput({ currencyCode: "JPY", cost: 1500 }));

    expect(result).toEqual({ ok: true, deliveryId: "delivery-1" });
  });

  it("surfaces a data-layer refusal unchanged", async () => {
    createDeliveryMock.mockResolvedValue({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });
  });

  it("captures the funnel event with the backdating flag", async () => {
    await quickArrivalAction(buildInput());

    expect(posthogCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-1",
        event: POSTHOG_EVENTS.DELIVERY.QUICK_ARRIVAL_LOGGED,
        properties: expect.objectContaining({ deliveryId: "delivery-1", product_count: 1, backdated: true }),
      }),
    );
  });

  it("reports a server error without leaking the exception", async () => {
    createDeliveryMock.mockRejectedValue(new Error("boom"));

    const result = await quickArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});
