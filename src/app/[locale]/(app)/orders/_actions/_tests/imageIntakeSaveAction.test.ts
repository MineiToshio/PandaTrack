import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getPostHogClientMock,
  captureMock,
  shutdownMock,
  findOrderIdByNoteMarkerMock,
  createOrderMock,
  addOrderPaymentMock,
  createDeliveryMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getPostHogClientMock: vi.fn(),
  captureMock: vi.fn(),
  shutdownMock: vi.fn(),
  findOrderIdByNoteMarkerMock: vi.fn(),
  createOrderMock: vi.fn(),
  addOrderPaymentMock: vi.fn(),
  createDeliveryMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));
vi.mock("@/lib/data/orders/orderQueries", () => ({ findOrderIdByNoteMarker: findOrderIdByNoteMarkerMock }));
vi.mock("@/lib/data/orders/orderMutations", () => ({ createOrder: createOrderMock }));
vi.mock("@/lib/data/orders/orderPaymentMutations", () => ({ addOrderPayment: addOrderPaymentMock }));
// Doubled only so the suite can prove it is never reached: a draft's delivery block is an expected
// arrival window plus a shipping cost, and a delivery is a shipment that already went out.
vi.mock("@/lib/data/deliveries/deliveryMutations", () => ({ createDelivery: createDeliveryMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { saveOrderFromDraftAction } from "../imageIntakeSaveAction";

const USER_SESSION = { user: { id: "user-1" } };
const STORE_ID = "clh1234567890abcdefghijkl";
const ORDER_ID = "clo1234567890abcdefghijkl";

function field<T>(value: T | null, source: "read" | "assumed" | null) {
  return { value, source };
}

function buildDraft(overrides: Record<string, unknown> = {}) {
  return {
    store: { matchedStoreId: STORE_ID, name: field("Pop Dealer", "read"), phone: field(null, null), candidates: [] },
    currency: field("PEN", "read"),
    orderDate: field("2026-07-20", "read"),
    totalCost: field(15000, "read"),
    groups: [
      {
        sourcePhrase: "el pack chase de Gojo",
        reason: "split" as const,
        doubtful: false,
        priceSplit: "explicit-unit" as const,
        products: [
          { name: "Gojo", unitPrice: 9000 },
          { name: "Gojo (chase)", unitPrice: 6000 },
        ],
      },
    ],
    payments: [],
    delivery: null,
    warnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getPostHogClientMock.mockReturnValue({ capture: captureMock, shutdown: shutdownMock });
  getSessionMock.mockResolvedValue(USER_SESSION);
  findOrderIdByNoteMarkerMock.mockResolvedValue(null);
  createOrderMock.mockResolvedValue({ ok: true, orderId: ORDER_ID, humanReadableId: "PT-000001" });
  addOrderPaymentMock.mockResolvedValue({ ok: true, paymentId: "pay-1" });
});

describe("saveOrderFromDraftAction", () => {
  it("refuses an unauthenticated caller before writing anything", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await saveOrderFromDraftAction(buildDraft());

    expect(result).toEqual({ ok: false, code: "unauthorized" });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("rejects a payload that does not re-parse against the draft contract", async () => {
    const result = await saveOrderFromDraftAction({ store: { matchedStoreId: STORE_ID }, injected: true });

    expect(result).toEqual({ ok: false, code: "invalid-draft" });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("requires a store before it will write an order", async () => {
    const base = buildDraft();
    const draft = { ...base, store: { ...base.store, matchedStoreId: null } };

    const result = await saveOrderFromDraftAction(draft);

    expect(result).toEqual({ ok: false, code: "store-required" });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("requires a total before it will write an order", async () => {
    const result = await saveOrderFromDraftAction(buildDraft({ totalCost: field(null, null) }));

    expect(result).toEqual({ ok: false, code: "total-required" });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("writes the order with one item per confirmed product and an idempotency marker on the note", async () => {
    const result = await saveOrderFromDraftAction(buildDraft());

    expect(result).toEqual({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 0,
      paymentsSkipped: 0,
      skippedBreakdownIndexes: [],
      breakdownDropped: 0,
    });
    const [, input] = createOrderMock.mock.calls[0];
    expect(input.items).toHaveLength(2);
    expect(input.items[0]).toMatchObject({ name: "Gojo", quantity: 1, position: 1 });
    expect(input.note).toMatch(/^\[image-intake:[0-9a-f]{16}\]$/);
  });

  it("carries the extracted arrival window onto the order, and creates no delivery from it", async () => {
    const result = await saveOrderFromDraftAction(
      buildDraft({
        delivery: {
          expectedFrom: field("2026-08-01", "read"),
          expectedTo: field("2026-08-15", "read"),
          cost: field(2500, "read"),
        },
      }),
    );

    expect(result).toMatchObject({ ok: true });
    const [, input] = createOrderMock.mock.calls[0];
    expect(input.expectedDeliveryFrom.toISOString()).toContain("2026-08-01");
    expect(input.expectedDeliveryTo.toISOString()).toContain("2026-08-15");
    expect(createDeliveryMock).not.toHaveBeenCalled();
  });

  it("returns the existing order instead of writing a second one for the same confirmed draft", async () => {
    findOrderIdByNoteMarkerMock.mockResolvedValue("order-existing");

    const result = await saveOrderFromDraftAction(buildDraft());

    expect(result).toEqual({
      ok: true,
      orderId: "order-existing",
      paymentsRecorded: 0,
      paymentsSkipped: 0,
      skippedBreakdownIndexes: [],
      breakdownDropped: 0,
    });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("derives the same marker for the same draft and a different one for a different draft", async () => {
    await saveOrderFromDraftAction(buildDraft());
    await saveOrderFromDraftAction(buildDraft());
    await saveOrderFromDraftAction(buildDraft({ totalCost: field(16000, "read") }));

    const [first, second, third] = findOrderIdByNoteMarkerMock.mock.calls.map((call) => call[1]);
    expect(first).toBe(second);
    expect(third).not.toBe(first);
  });

  it("keeps one marker across a retry the collector corrected, so an edited retry is not a second order", async () => {
    const saveToken = "0f9c1d2e-3a4b-5c6d-7e8f-90a1b2c3d4e5";

    // The first attempt is the one that may have written the order while reporting failure. The
    // second is the collector fixing a price and pressing save again — the same order, corrected.
    await saveOrderFromDraftAction(buildDraft(), null, saveToken);
    await saveOrderFromDraftAction(buildDraft({ totalCost: field(16000, "read") }), null, saveToken);

    const [first, second] = findOrderIdByNoteMarkerMock.mock.calls.map((call) => call[1]);
    expect(first).toBe(second);
    expect(first).toMatch(/^\[image-intake:[0-9a-f]{16}\]$/);
  });

  it("gives two different drafts two different markers even under the token, since each mints its own", async () => {
    await saveOrderFromDraftAction(buildDraft(), null, "0f9c1d2e-3a4b-5c6d-7e8f-90a1b2c3d4e5");
    await saveOrderFromDraftAction(buildDraft(), null, "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d");

    const [first, second] = findOrderIdByNoteMarkerMock.mock.calls.map((call) => call[1]);
    expect(first).not.toBe(second);
  });

  it("falls back to the draft signature when the token is missing or malformed, rather than trusting it", async () => {
    await saveOrderFromDraftAction(buildDraft());
    await saveOrderFromDraftAction(buildDraft(), null, "not a token");
    await saveOrderFromDraftAction(buildDraft(), null, 42);

    const markers = findOrderIdByNoteMarkerMock.mock.calls.map((call) => call[1]);
    expect(new Set(markers).size).toBe(1);
  });

  it("records the draft payments and counts the ones the order domain refuses", async () => {
    addOrderPaymentMock
      .mockResolvedValueOnce({ ok: true, paymentId: "pay-1" })
      .mockResolvedValueOnce({ ok: false, error: "EXCEEDS_BALANCE" });

    const result = await saveOrderFromDraftAction(
      buildDraft({
        payments: [
          { amount: field(5000, "read"), paidAt: field("2026-07-21", "read") },
          { amount: field(999999, "read"), paidAt: field("2026-07-22", "read") },
        ],
      }),
    );

    expect(result).toEqual({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 1,
      paymentsSkipped: 1,
      skippedBreakdownIndexes: [],
      breakdownDropped: 0,
    });
  });

  it("keeps the created order when a payment cannot even be validated", async () => {
    const result = await saveOrderFromDraftAction(
      buildDraft({ payments: [{ amount: field(null, null), paidAt: field(null, null) }] }),
    );

    expect(result).toEqual({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 0,
      paymentsSkipped: 1,
      skippedBreakdownIndexes: [],
      breakdownDropped: 0,
    });
    expect(addOrderPaymentMock).not.toHaveBeenCalled();
  });

  it("maps a missing store from the mutation to its own code", async () => {
    createOrderMock.mockResolvedValue({ ok: false, error: "STORE_NOT_FOUND" });

    const result = await saveOrderFromDraftAction(buildDraft());

    expect(result).toEqual({ ok: false, code: "store-not-found" });
  });

  it("reports an unexpected failure to Sentry and returns a generic code", async () => {
    createOrderMock.mockRejectedValue(new Error("connection lost"));

    const result = await saveOrderFromDraftAction(buildDraft());

    expect(result).toEqual({ ok: false, code: "server-error" });
    expect(captureExceptionMock).toHaveBeenCalled();
  });

  it("stores the exchange rate the review screen confirmed, so the order counts toward base totals", async () => {
    const result = await saveOrderFromDraftAction(buildDraft(), 3.812345);

    expect(result).toMatchObject({ ok: true });
    const [, input] = createOrderMock.mock.calls[0];
    // A stored rate is what keeps the order out of the FX-pending bucket the dashboard excludes.
    expect(input.exchangeRate).toBe(3.812345);
  });

  it("saves without a rate when the collector left the field empty", async () => {
    const result = await saveOrderFromDraftAction(buildDraft(), null);

    expect(result).toMatchObject({ ok: true });
    const [, input] = createOrderMock.mock.calls[0];
    expect(input.exchangeRate).toBeNull();
  });

  it("refuses a rate the order schema would reject rather than writing a corrupt one", async () => {
    // Seven decimals: past the precision `exchangeRateSchema` allows.
    const result = await saveOrderFromDraftAction(buildDraft(), 3.8123456);

    expect(result).toEqual({ ok: false, code: "invalid-draft" });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("never attaches extracted content to the confirmation analytics event", async () => {
    await saveOrderFromDraftAction(buildDraft());

    const serialized = JSON.stringify(captureMock.mock.calls);
    expect(serialized).not.toContain("Gojo");
    expect(serialized).not.toContain("pack chase");
  });
});
