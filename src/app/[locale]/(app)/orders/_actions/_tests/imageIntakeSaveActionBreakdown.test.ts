import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  getPostHogClientMock,
  captureMock,
  shutdownMock,
  findOrderIdByNoteMarkerMock,
  listOrderItemPositionsMock,
  createOrderMock,
  addOrderPaymentMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getPostHogClientMock: vi.fn(),
  captureMock: vi.fn(),
  shutdownMock: vi.fn(),
  findOrderIdByNoteMarkerMock: vi.fn(),
  listOrderItemPositionsMock: vi.fn(),
  createOrderMock: vi.fn(),
  addOrderPaymentMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-server", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/analytics/posthog-server", () => ({ getPostHogClient: getPostHogClientMock }));
vi.mock("@/lib/data/orders/orderQueries", () => ({
  findOrderIdByNoteMarker: findOrderIdByNoteMarkerMock,
  listOrderItemPositions: listOrderItemPositionsMock,
}));
vi.mock("@/lib/data/orders/orderMutations", () => ({ createOrder: createOrderMock }));
vi.mock("@/lib/data/orders/orderPaymentMutations", () => ({ addOrderPayment: addOrderPaymentMock }));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { saveOrderFromDraftAction } from "../imageIntakeSaveAction";

const USER_SESSION = { user: { id: "user-1" } };
const STORE_ID = "clh1234567890abcdefghijkl";
const ORDER_ID = "clo1234567890abcdefghijkl";
const SAVE_TOKEN = "0f9a1b2c3d4e5f60";

/** Item ids in the shape `orderPaymentCreateSchema` demands of an allocation: real cuids. */
const ITEM_ID_BY_POSITION: Record<number, string> = {
  1: "citem0000000000000000000a",
  2: "citem0000000000000000000b",
  3: "citem0000000000000000000c",
};

function field<T>(value: T | null, source: "read" | "assumed" | null = value === null ? null : "read") {
  return { value, source };
}

/** Two groups, three products, so a position can be wrong without being off by one. */
function buildDraft(payments: { amount: number | null; paidAt: string | null }[] = []) {
  return {
    store: { matchedStoreId: STORE_ID, name: field("Pop Dealer"), phone: field(null), candidates: [] },
    currency: field("PEN"),
    orderDate: field("2026-07-20"),
    totalCost: field(15000),
    groups: [
      {
        sourcePhrase: "el pack de Gojo",
        reason: "split" as const,
        doubtful: false,
        priceSplit: "explicit-unit" as const,
        products: [
          { name: "Gojo", unitPrice: 5000 },
          { name: "Gojo (chase)", unitPrice: 6000 },
        ],
      },
      {
        sourcePhrase: "el llavero",
        reason: "split" as const,
        doubtful: false,
        priceSplit: "explicit-unit" as const,
        products: [{ name: "Llavero", unitPrice: 4000 }],
      },
    ],
    payments: payments.map((payment) => ({ amount: field(payment.amount), paidAt: field(payment.paidAt) })),
    delivery: null,
    warnings: [],
  };
}

/** The rows the read returns, deliberately NOT in position order (see the T3 case below). */
function shuffledItemRows() {
  return [
    { id: ITEM_ID_BY_POSITION[3], position: 3 },
    { id: ITEM_ID_BY_POSITION[1], position: 1 },
    { id: ITEM_ID_BY_POSITION[2], position: 2 },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  getPostHogClientMock.mockReturnValue({ capture: captureMock, shutdown: shutdownMock });
  getSessionMock.mockResolvedValue(USER_SESSION);
  findOrderIdByNoteMarkerMock.mockResolvedValue(null);
  listOrderItemPositionsMock.mockResolvedValue(shuffledItemRows());
  createOrderMock.mockResolvedValue({ ok: true, orderId: ORDER_ID, humanReadableId: "PT-000001" });
  addOrderPaymentMock.mockResolvedValue({ ok: true, paymentId: "pay-1" });
});

describe("saveOrderFromDraftAction · the breakdown reaches the write path", () => {
  it("resolves each line's position against the item that carries it, in any read order (T3, T5)", async () => {
    const result = await saveOrderFromDraftAction(
      buildDraft([{ amount: 8000, paidAt: "2026-07-21" }]),
      null,
      SAVE_TOKEN,
      [
        {
          paymentIndex: 0,
          lines: [
            { position: 1, amountMinor: 2000 },
            { position: 3, amountMinor: 3000 },
          ],
        },
      ],
    );

    expect(result).toMatchObject({ ok: true, paymentsRecorded: 1, skippedBreakdownIndexes: [], breakdownDropped: 0 });
    expect(addOrderPaymentMock).toHaveBeenCalledTimes(1);
    expect(addOrderPaymentMock.mock.calls[0][0].allocations).toEqual([
      { orderItemId: ITEM_ID_BY_POSITION[1], amountMinor: 2000 },
      { orderItemId: ITEM_ID_BY_POSITION[3], amountMinor: 3000 },
    ]);
  });

  it("only sends the lines of the row they were declared on", async () => {
    await saveOrderFromDraftAction(
      buildDraft([
        { amount: 5000, paidAt: "2026-07-21" },
        { amount: 4000, paidAt: "2026-07-22" },
      ]),
      null,
      SAVE_TOKEN,
      [{ paymentIndex: 1, lines: [{ position: 2, amountMinor: 4000 }] }],
    );

    expect(addOrderPaymentMock).toHaveBeenCalledTimes(2);
    expect(addOrderPaymentMock.mock.calls[0][0].allocations).toBeUndefined();
    expect(addOrderPaymentMock.mock.calls[1][0].allocations).toEqual([
      { orderItemId: ITEM_ID_BY_POSITION[2], amountMinor: 4000 },
    ]);
  });

  it("writes the payment without its breakdown when a position no longer resolves", async () => {
    listOrderItemPositionsMock.mockResolvedValue([{ id: ITEM_ID_BY_POSITION[1], position: 1 }]);

    const result = await saveOrderFromDraftAction(
      buildDraft([{ amount: 8000, paidAt: "2026-07-21" }]),
      null,
      SAVE_TOKEN,
      [
        {
          paymentIndex: 0,
          lines: [
            { position: 1, amountMinor: 2000 },
            { position: 3, amountMinor: 3000 },
          ],
        },
      ],
    );

    expect(result).toMatchObject({ ok: true, paymentsRecorded: 1, breakdownDropped: 1, skippedBreakdownIndexes: [] });
    expect(addOrderPaymentMock.mock.calls[0][0].allocations).toBeUndefined();
  });

  it("never reads the items when nothing was declared, and sends no allocations (T14)", async () => {
    await saveOrderFromDraftAction(buildDraft([{ amount: 8000, paidAt: "2026-07-21" }]), null, SAVE_TOKEN, undefined);

    expect(listOrderItemPositionsMock).not.toHaveBeenCalled();
    expect(addOrderPaymentMock.mock.calls[0][0].allocations).toBeUndefined();
  });

  it("refuses a malformed payload before writing anything", async () => {
    const result = await saveOrderFromDraftAction(
      buildDraft([{ amount: 8000, paidAt: "2026-07-21" }]),
      null,
      SAVE_TOKEN,
      [{ paymentIndex: 0, lines: [{ position: 1, amountMinor: 0 }] }],
    );

    expect(result).toEqual({ ok: false, code: "invalid-draft" });
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("names the row whose breakdown the order domain refused (T13, server half)", async () => {
    addOrderPaymentMock
      .mockResolvedValueOnce({ ok: true, paymentId: "pay-1" })
      .mockResolvedValueOnce({ ok: false, error: "EXCEEDS_BALANCE" });

    const result = await saveOrderFromDraftAction(
      buildDraft([
        { amount: 5000, paidAt: "2026-07-21" },
        { amount: 4000, paidAt: "2026-07-22" },
      ]),
      null,
      SAVE_TOKEN,
      [{ paymentIndex: 1, lines: [{ position: 2, amountMinor: 4000 }] }],
    );

    expect(result).toMatchObject({ ok: true, paymentsRecorded: 1, paymentsSkipped: 1, skippedBreakdownIndexes: [1] });
  });

  it("counts the breakdown on the save event", async () => {
    await saveOrderFromDraftAction(buildDraft([{ amount: 8000, paidAt: "2026-07-21" }]), null, SAVE_TOKEN, [
      {
        paymentIndex: 0,
        lines: [
          { position: 1, amountMinor: 2000 },
          { position: 3, amountMinor: 3000 },
        ],
      },
    ]);

    expect(captureMock.mock.calls[0][0].properties).toMatchObject({ breakdown_payments: 1, breakdown_lines: 2 });
  });
});

describe("saveOrderFromDraftAction · the retry is not mute (T6)", () => {
  it("names every row that carried a breakdown when the same token resolves to an existing order", async () => {
    const draft = buildDraft([
      { amount: 5000, paidAt: "2026-07-21" },
      { amount: 4000, paidAt: "2026-07-22" },
    ]);
    const breakdown = [{ paymentIndex: 1, lines: [{ position: 2, amountMinor: 4000 }] }];

    // First attempt: the order and row 0 are written, then row 1 throws.
    addOrderPaymentMock
      .mockResolvedValueOnce({ ok: true, paymentId: "pay-1" })
      .mockRejectedValueOnce(new Error("connection lost"));
    const first = await saveOrderFromDraftAction(draft, null, SAVE_TOKEN, breakdown);
    expect(first).toEqual({ ok: false, code: "server-error" });

    // The collector presses save again, with the same token, so the marker resolves.
    findOrderIdByNoteMarkerMock.mockResolvedValue(ORDER_ID);
    const second = await saveOrderFromDraftAction(draft, null, SAVE_TOKEN, breakdown);

    expect(second).toEqual({
      ok: true,
      orderId: ORDER_ID,
      paymentsRecorded: 0,
      paymentsSkipped: 0,
      skippedBreakdownIndexes: [1],
      breakdownDropped: 0,
    });
  });

  it("reports nothing to redo when the retried save carried no breakdown at all", async () => {
    findOrderIdByNoteMarkerMock.mockResolvedValue(ORDER_ID);

    const result = await saveOrderFromDraftAction(
      buildDraft([{ amount: 5000, paidAt: "2026-07-21" }]),
      null,
      SAVE_TOKEN,
    );

    expect(result).toMatchObject({ ok: true, skippedBreakdownIndexes: [] });
  });
});
