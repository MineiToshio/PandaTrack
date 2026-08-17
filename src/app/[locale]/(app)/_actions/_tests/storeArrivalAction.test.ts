import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, createDeliveryMock, preferencesMock, posthogCaptureMock, revalidateMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  createDeliveryMock: vi.fn(),
  preferencesMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

// Cache revalidation is a Next request-scoped API; the unit under test only needs it to be
// called, and calling it for real here throws outside a request.
vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({
  revalidateCollectionSurfaces: revalidateMock,
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({ createDelivery: createDeliveryMock }));

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

import { storeArrivalAction, type StoreArrivalActionInput } from "../storeArrivalAction";
import { addUtcDays, utcMidnightToday } from "@/test/domainDateFixtures";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };
const VALID_STORE_ID = "clh1234567890abcdefghijk";
const PRODUCT_A = "clh0000000000abcdefghijk";
const PRODUCT_B = "clh1111111111abcdefghijk";
const RECEIVED_DATE = new Date("2026-05-02T00:00:00.000Z");

function buildInput(overrides: Partial<StoreArrivalActionInput> = {}): StoreArrivalActionInput {
  return {
    storeId: VALID_STORE_ID,
    productIds: [PRODUCT_A, PRODUCT_B],
    receivedDate: RECEIVED_DATE,
    shippedDate: null,
    cost: 0,
    currencyCode: "USD",
    exchangeRate: null,
    ...overrides,
  };
}

describe("storeArrivalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    preferencesMock.mockResolvedValue({ baseCurrencyCode: "USD" });
    createDeliveryMock.mockResolvedValue({ ok: true, deliveryId: "delivery-1", productCount: 2, orderCount: 2 });
  });

  it("rejects an unauthenticated caller before touching the data layer", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("writes a single already-received delivery for the whole selection", async () => {
    const result = await storeArrivalAction(buildInput());

    expect(createDeliveryMock).toHaveBeenCalledTimes(1);
    expect(createDeliveryMock).toHaveBeenCalledWith("user-1", {
      storeId: VALID_STORE_ID,
      deliveryDate: RECEIVED_DATE,
      receivedDate: RECEIVED_DATE,
      cost: 0,
      currencyCode: "USD",
      exchangeRate: null,
      productIds: [PRODUCT_A, PRODUCT_B],
    });
    expect(result).toEqual({ ok: true, deliveryId: "delivery-1", productCount: 2, orderCount: 2 });
  });

  it("returns the server's own counts, so the client never has to infer how many orders it hit", async () => {
    createDeliveryMock.mockResolvedValue({ ok: true, deliveryId: "delivery-9", productCount: 5, orderCount: 3 });

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({ ok: true, deliveryId: "delivery-9", productCount: 5, orderCount: 3 });
  });

  it("uses the supplied dispatch date when the collector knows it", async () => {
    const shippedDate = new Date("2026-04-20T00:00:00.000Z");

    await storeArrivalAction(buildInput({ shippedDate }));

    expect(createDeliveryMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ deliveryDate: shippedDate, receivedDate: RECEIVED_DATE }),
    );
  });

  it("refuses an invalid store id", async () => {
    const result = await storeArrivalAction(buildInput({ storeId: "not-a-cuid" }));

    expect(result).toEqual({ ok: false, error: "INVALID_STORE_ID" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses an empty selection", async () => {
    const result = await storeArrivalAction(buildInput({ productIds: [] }));

    expect(result).toEqual({ ok: false, error: "NO_PRODUCTS_SELECTED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses a future arrival date", async () => {
    const future = addUtcDays(utcMidnightToday(), 1);

    const result = await storeArrivalAction(buildInput({ receivedDate: future }));

    expect(result).toEqual({ ok: false, error: "RECEIVED_DATE_IN_FUTURE" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("refuses a dispatch date later than the arrival date", async () => {
    const result = await storeArrivalAction(buildInput({ shippedDate: new Date("2026-05-03T00:00:00.000Z") }));

    expect(result).toEqual({ ok: false, error: "RECEIVED_BEFORE_SHIPPED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("requires a rate when the cost currency differs from the collector base", async () => {
    const result = await storeArrivalAction(buildInput({ currencyCode: "JPY", cost: 1500 }));

    expect(result).toEqual({ ok: false, error: "EXCHANGE_RATE_REQUIRED" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  /**
   * Ownership and store scope are never re-checked here: `createDelivery` re-reads every product
   * inside its transaction, so the only correct behaviour for this action is to relay the refusal
   * untouched. A second copy of the rule up here would be the thing that drifts.
   */
  it("relays a foreign-store refusal from the data layer untouched", async () => {
    createDeliveryMock.mockResolvedValue({ ok: false, error: "PRODUCTS_FROM_DIFFERENT_STORE" });

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "PRODUCTS_FROM_DIFFERENT_STORE", ineligibleProductIds: undefined });
  });

  it("relays a cancelled-order refusal from the data layer", async () => {
    createDeliveryMock.mockResolvedValue({ ok: false, error: "ORDER_CANCELLED" });

    const result = await storeArrivalAction(buildInput());

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: "ORDER_CANCELLED" });
  });

  it("propagates the ineligible product ids so the client can flag exactly those rows", async () => {
    createDeliveryMock.mockResolvedValue({
      ok: false,
      error: "PRODUCT_NOT_ELIGIBLE",
      ineligibleProductIds: [PRODUCT_B],
    });

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({
      ok: false,
      error: "PRODUCT_NOT_ELIGIBLE",
      ineligibleProductIds: [PRODUCT_B],
    });
  });

  it("does not revalidate or report a refused write", async () => {
    createDeliveryMock.mockResolvedValue({ ok: false, error: "PRODUCT_NOT_ELIGIBLE" });

    await storeArrivalAction(buildInput());

    expect(revalidateMock).not.toHaveBeenCalled();
    expect(posthogCaptureMock).not.toHaveBeenCalled();
  });

  it("invalidates the cached collection surfaces after a successful write", async () => {
    await storeArrivalAction(buildInput());

    expect(revalidateMock).toHaveBeenCalledTimes(1);
  });

  it("captures the funnel event with the store, the counts and the backdating flag", async () => {
    await storeArrivalAction(buildInput());

    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.STORE_ARRIVAL_LOGGED,
      properties: {
        deliveryId: "delivery-1",
        store_id: VALID_STORE_ID,
        product_count: 2,
        order_count: 2,
        had_shipped_date: false,
        backdated: true,
      },
    });
  });

  it("reports a server error without leaking the exception", async () => {
    createDeliveryMock.mockRejectedValue(new Error("boom"));

    const result = await storeArrivalAction(buildInput());

    expect(result).toEqual({ ok: false, error: "server_error" });
  });
});
