import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, createDeliveryMock, posthogCaptureMock, getUserCurrencyContextMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  createDeliveryMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  getUserCurrencyContextMock: vi.fn(),
}));

// Cache revalidation is a Next request-scoped API; the unit under test only needs it to be
// called, and calling it for real here throws outside a request.
vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({
  revalidateCollectionSurfaces: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({
  createDelivery: createDeliveryMock,
}));

vi.mock("@/lib/data/user-settings/userSettingsQueries", () => ({
  getUserCurrencyContext: getUserCurrencyContextMock,
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
  captureException: vi.fn(),
}));

import { createDeliveryAction } from "../createDeliveryAction";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };
const VALID_STORE_ID = "clh1234567890abcdefghijk";
const VALID_PRODUCT_ID = "clh0000000000abcdefghijk";

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("storeId", VALID_STORE_ID);
  formData.set("deliveryDate", "2026-01-01");
  formData.set("cost", "19.99");
  formData.set("currencyCode", "USD");
  formData.set("productIds", JSON.stringify([VALID_PRODUCT_ID]));
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

describe("createDeliveryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserCurrencyContextMock.mockResolvedValue({ baseCurrencyCode: "USD" });
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await createDeliveryAction(null, buildFormData());

    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed decimal cost instead of silently truncating it", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    // parseDecimalToMinorUnits rejects thousands separators; a naive parseFloat would have
    // silently read this as 1 instead of failing, which is the bug this parser guards against.
    const result = await createDeliveryAction(null, buildFormData({ cost: "1,000" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("validation");
      expect(result.fieldErrors?.cost).toBeDefined();
    }
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects a cost with more than two decimal digits", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await createDeliveryAction(null, buildFormData({ cost: "19.999" }));

    expect(result.success).toBe(false);
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("requires an exchange rate when the currency differs from the user's base currency", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    getUserCurrencyContextMock.mockResolvedValue({ baseCurrencyCode: "USD" });

    const result = await createDeliveryAction(null, buildFormData({ currencyCode: "EUR" }));

    expect(result).toEqual({
      success: false,
      error: "validation",
      fieldErrors: { exchangeRate: ["EXCHANGE_RATE_REQUIRED"] },
    });
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("creates the delivery and tracks the event on the happy path", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    createDeliveryMock.mockResolvedValue({
      ok: true,
      deliveryId: "delivery-1",
      productCount: 1,
      orderCount: 1,
    });

    const result = await createDeliveryAction(null, buildFormData());

    expect(result).toEqual({ success: true, deliveryId: "delivery-1" });
    expect(createDeliveryMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ storeId: VALID_STORE_ID, cost: 1999, currencyCode: "USD" }),
    );
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.CREATED,
      properties: {
        deliveryId: "delivery-1",
        product_count: 1,
        order_count: 1,
        entry_point: "standalone",
      },
    });
  });

  it("maps a data-layer failure to its error code and surfaces ineligible product ids", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    createDeliveryMock.mockResolvedValue({
      ok: false,
      error: "PRODUCTS_NOT_ELIGIBLE",
      ineligibleProductIds: [VALID_PRODUCT_ID],
    });

    const result = await createDeliveryAction(null, buildFormData());

    expect(result).toEqual({
      success: false,
      error: "PRODUCTS_NOT_ELIGIBLE",
      ineligibleProductIds: [VALID_PRODUCT_ID],
    });
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    createDeliveryMock.mockRejectedValue(new Error("db down"));

    const result = await createDeliveryAction(null, buildFormData());

    expect(result).toEqual({ success: false, error: "server_error" });
  });
});
