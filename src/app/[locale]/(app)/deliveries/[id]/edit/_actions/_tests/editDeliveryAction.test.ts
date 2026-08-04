import { POSTHOG_EVENTS } from "@/lib/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, editDeliveryMock, posthogCaptureMock, userFindUniqueMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  editDeliveryMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

// Cache revalidation is a Next request-scoped API; the unit under test only needs it to be
// called, and calling it for real here throws outside a request.
vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({
  revalidateCollectionSurfaces: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));

vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({
  editDelivery: editDeliveryMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: userFindUniqueMock } },
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCaptureMock, shutdown: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  withScope: (callback: (scope: unknown) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() }),
  captureException: vi.fn(),
}));

import { editDeliveryAction } from "../editDeliveryAction";

const AUTHENTICATED_SESSION = { user: { id: "user-1" } };
const VALID_DELIVERY_ID = "clh1234567890abcdefghijk";
const VALID_PRODUCT_ID = "clh0000000000abcdefghijk";

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("deliveryId", VALID_DELIVERY_ID);
  formData.set("deliveryDate", "2026-01-01");
  formData.set("cost", "19.99");
  formData.set("currencyCode", "USD");
  formData.set("productIds", JSON.stringify([VALID_PRODUCT_ID]));
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

describe("editDeliveryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUniqueMock.mockResolvedValue({ baseCurrencyCode: "USD" });
  });

  it("rejects when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await editDeliveryAction(null, buildFormData());

    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(editDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed decimal cost instead of silently truncating it", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await editDeliveryAction(null, buildFormData({ cost: "1,000" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("validation");
      expect(result.fieldErrors?.cost).toBeDefined();
    }
    expect(editDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects a cost with more than two decimal digits", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await editDeliveryAction(null, buildFormData({ cost: "19.999" }));

    expect(result.success).toBe(false);
    expect(editDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid delivery id", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);

    const result = await editDeliveryAction(null, buildFormData({ deliveryId: "not-a-cuid" }));

    expect(result.success).toBe(false);
    expect(editDeliveryMock).not.toHaveBeenCalled();
  });

  it("requires an exchange rate when the currency differs from the user's base currency", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    userFindUniqueMock.mockResolvedValue({ baseCurrencyCode: "USD" });

    const result = await editDeliveryAction(null, buildFormData({ currencyCode: "EUR" }));

    expect(result).toEqual({
      success: false,
      error: "validation",
      fieldErrors: { exchangeRate: ["EXCHANGE_RATE_REQUIRED"] },
    });
    expect(editDeliveryMock).not.toHaveBeenCalled();
  });

  it("edits the delivery and tracks the event on the happy path", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    editDeliveryMock.mockResolvedValue({ ok: true, productCount: 2, addedCount: 1, removedCount: 0 });

    const result = await editDeliveryAction(null, buildFormData());

    expect(result).toEqual({ success: true, deliveryId: VALID_DELIVERY_ID });
    expect(editDeliveryMock).toHaveBeenCalledWith(
      VALID_DELIVERY_ID,
      "user-1",
      expect.objectContaining({ cost: 1999, currencyCode: "USD", productIds: [VALID_PRODUCT_ID] }),
    );
    expect(posthogCaptureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: POSTHOG_EVENTS.DELIVERY.EDITED,
      properties: { deliveryId: VALID_DELIVERY_ID, product_count: 2, added_count: 1, removed_count: 0 },
    });
  });

  it("maps a data-layer failure to its error code", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    editDeliveryMock.mockResolvedValue({ ok: false, error: "DELIVERY_NOT_FOUND" });

    const result = await editDeliveryAction(null, buildFormData());

    expect(result).toEqual({ success: false, error: "DELIVERY_NOT_FOUND" });
  });

  it("reports an unexpected error to Sentry and returns server_error", async () => {
    getSessionMock.mockResolvedValue(AUTHENTICATED_SESSION);
    editDeliveryMock.mockRejectedValue(new Error("db down"));

    const result = await editDeliveryAction(null, buildFormData());

    expect(result).toEqual({ success: false, error: "server_error" });
  });
});
