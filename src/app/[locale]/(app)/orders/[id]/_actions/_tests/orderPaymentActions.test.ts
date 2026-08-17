import { beforeEach, describe, expect, it, vi } from "vitest";
import { utcMidnightToday } from "@/test/domainDateFixtures";

const { getSessionMock, addOrderPaymentMock, deleteOrderPaymentMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  addOrderPaymentMock: vi.fn(),
  deleteOrderPaymentMock: vi.fn(),
}));

vi.mock("@/lib/cache/revalidateCollectionSurfaces", () => ({ revalidateCollectionSurfaces: vi.fn() }));
vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/orders/orderPaymentMutations", () => ({
  addOrderPayment: addOrderPaymentMock,
  deleteOrderPayment: deleteOrderPaymentMock,
}));
vi.mock("@/lib/analytics/posthog-server", () => ({
  getPostHogClient: () => ({ capture: vi.fn(), shutdown: vi.fn() }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { addPaymentAction } from "../orderPaymentActions";

const VALID_ORDER_ID = "clh1234567890abcdefghijk";
const VALID_ITEM_ID = "clh1234567890abcdefghijl";
const PAYMENT_DATE = utcMidnightToday();

describe("addPaymentAction with a product breakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    addOrderPaymentMock.mockResolvedValue({
      ok: true,
      paymentId: "payment-1",
      paidAmount: 4500,
      remainingAmount: 0,
      paymentPercentage: 100,
      payments: [],
    });
  });

  it("hands the product lines to the mutation untouched", async () => {
    const allocations = [{ orderItemId: VALID_ITEM_ID, amountMinor: 2250 }];

    const result = await addPaymentAction(VALID_ORDER_ID, 4500, PAYMENT_DATE, allocations);

    expect(result).toMatchObject({ ok: true });
    expect(addOrderPaymentMock).toHaveBeenCalledWith(expect.objectContaining({ allocations }));
  });

  it("records a payment with no breakdown exactly as before", async () => {
    await addPaymentAction(VALID_ORDER_ID, 4500, PAYMENT_DATE);

    expect(addOrderPaymentMock).toHaveBeenCalledWith(expect.objectContaining({ allocations: undefined }));
  });

  it("refuses a zero-amount line before it can reach the mutation", async () => {
    const result = await addPaymentAction(VALID_ORDER_ID, 4500, PAYMENT_DATE, [
      { orderItemId: VALID_ITEM_ID, amountMinor: 0 },
    ]);

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(addOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("refuses a line naming something that is not a product id", async () => {
    const result = await addPaymentAction(VALID_ORDER_ID, 4500, PAYMENT_DATE, [
      { orderItemId: "not-an-id", amountMinor: 2250 },
    ]);

    expect(result).toEqual({ ok: false, error: "validation" });
    expect(addOrderPaymentMock).not.toHaveBeenCalled();
  });
});
