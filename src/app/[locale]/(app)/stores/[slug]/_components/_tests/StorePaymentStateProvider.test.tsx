import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/contexts/ToastContext";
import type { CreateStorePaymentActionResult } from "@/app/[locale]/(app)/_actions/storePaymentActions";
import type {
  StoreDebtRow,
  StorePaymentAllocationLine,
  StorePaymentListRow,
} from "@/lib/data/orders/storePaymentQueries";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";
import StorePaymentStateProvider, { useStorePaymentState } from "../StorePaymentStateProvider";
import StorePaymentsSection from "../StorePaymentsSection";

/** Set by `DeleteProbe` on every render, so a test can invoke the context's delete directly. */
const capturedDelete: { handler: ((paymentId: string) => Promise<{ ok: boolean; error?: string }>) | null } = {
  handler: null,
};

/** Set by `DeleteProbe` too: the live debt rows and the "load all" opener, for direct assertions. */
const capturedState: {
  debts: StoreDebtRow[];
  loadAll: (() => Promise<void>) | null;
  payments: StorePaymentListRow[];
  applyAdjustmentDeltas:
    ((input: { currencyCode: string; openGroupWriteOffMinor: number; totalWriteOffMinor: number }) => void) | null;
} = { debts: [], loadAll: null, payments: [], applyAdjustmentDeltas: null };

const {
  capturedSubmitRef,
  sheetOrdersRef,
  createStorePaymentActionMock,
  deleteStorePaymentActionMock,
  listAllStorePaymentsActionMock,
  invalidateMock,
  throwingTranslationKey,
} = vi.hoisted(() => ({
  capturedSubmitRef: { current: null as ((input: unknown) => Promise<unknown> | void) | null },
  /** The sheet's cached order list, which the provider reads to label and classify a fresh row. */
  sheetOrdersRef: { current: [] as AssignableOrder[] },
  createStorePaymentActionMock: vi.fn(),
  deleteStorePaymentActionMock: vi.fn(),
  listAllStorePaymentsActionMock: vi.fn(),
  // Hoisted so it is the SAME spy across renders — an inline `vi.fn()` in the hook mock would be
  // a fresh one each time and could never be asserted on.
  invalidateMock: vi.fn(),
  /** Makes one translation lookup blow up, standing in for any bug inside a settle handler. */
  throwingTranslationKey: { current: null as string | null },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, vars?: Record<string, unknown>) => {
      if (key === throwingTranslationKey.current) throw new Error(`translation blew up: ${key}`);
      return vars ? `${namespace}.${key}:${JSON.stringify(vars)}` : `${namespace}.${key}`;
    };
    t.has = () => true;
    return t;
  },
}));

vi.mock("@/components/modules/StorePaymentSheet", () => ({
  useStorePaymentSheetOrders: () => ({
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    retry: vi.fn(),
    invalidate: invalidateMock,
    orders: sheetOrdersRef.current,
    isLoading: false,
    hasError: false,
    isStale: false,
    isRefreshing: false,
  }),
  StorePaymentSheet: (props: { onSubmit: (input: unknown) => void }) => {
    capturedSubmitRef.current = props.onSubmit;
    return null;
  },
}));

vi.mock("@/app/[locale]/(app)/_actions/storePaymentActions", () => ({
  createStorePaymentAction: (...args: unknown[]) => createStorePaymentActionMock(...args),
  deleteStorePaymentAction: (...args: unknown[]) => deleteStorePaymentActionMock(...args),
  listAllStorePaymentsAction: (...args: unknown[]) => listAllStorePaymentsActionMock(...args),
}));

// `StorePaymentsSection` (rendered below) now also reads `StoreReconciliationProvider`'s own
// context for the "Ajustes de cuadre" history block (WO-11). This suite is about the PAYMENTS
// coordinator, not the reconciliation one, so it stands in with an empty, inert history — the
// reconciliation provider's own behaviour is covered by `StoreReconciliationProvider.test.tsx`.
vi.mock("../StoreReconciliationProvider", () => ({
  useStoreReconciliationState: () => ({ adjustments: [], deleteAdjustment: vi.fn() }),
}));

/** Reaches the context's own `deleteStorePayment` without going through the payments card's UI. */
function DeleteProbe() {
  const state = useStorePaymentState();
  useEffect(() => {
    capturedDelete.handler = state.deleteStorePayment;
    capturedState.debts = state.storeDebtByCurrency;
    capturedState.loadAll = state.loadAllStorePayments;
    capturedState.payments = state.storePayments;
    capturedState.applyAdjustmentDeltas = state.applyAdjustmentDeltas;
  });
  return null;
}

/** One allocation line in the shape `getStorePaymentsForStore` actually emits. */
function allocationLine(overrides: Partial<StorePaymentAllocationLine> = {}): StorePaymentAllocationLine {
  const line = {
    orderId: "order-1",
    orderHumanReadableId: "ORD-20260105-01",
    orderCancelled: false,
    orderActive: true,
    orderItemId: null,
    orderItemName: null,
    amountMinor: 1000,
    settlesTarget: false,
    ...overrides,
  };
  // A cancelled order is never active, so `orderCancelled: true` alone must not leave a fixture
  // claiming both. Pass `orderActive` explicitly for the third case: delivered, and not cancelled.
  return { ...line, orderActive: overrides.orderActive ?? !line.orderCancelled };
}

/** One payment row in the shape `getStorePaymentsForStore` actually emits. */
function paymentRow(overrides: Partial<StorePaymentListRow> = {}): StorePaymentListRow {
  const allocations = overrides.allocations ?? [allocationLine()];
  return {
    id: "payment-1",
    amount: 1000,
    currencyCode: "PEN",
    paymentDate: new Date("2026-01-05T00:00:00.000Z"),
    note: "Deposit",
    allocatedTotal: allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0),
    claimingOrdersCount: new Set(allocations.map((allocation) => allocation.orderId)).size,
    ...overrides,
    allocations,
  };
}

/** A pending, externally-resolvable stand-in for the server round trip, so the test can assert
    what the DOM shows *before* the promise settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderStorePayments(
  storePayments: StorePaymentListRow[] = [],
  debts?: StoreDebtRow[],
  /** Defaults to "the list is complete"; pass a bigger number to surface the "see all" control. */
  totalCount: number = storePayments.length,
) {
  return render(
    <ToastProvider>
      <StorePaymentStateProvider
        storeId="store-1"
        storeName="Akiba Books"
        storeDebtByCurrency={
          debts ?? [
            {
              storeId: "store-1",
              currencyCode: "PEN",
              committedMinor: 5000,
              paidMinor: 0,
              debtMinor: 5000,
              lostMinor: 0,
              activeCommittedMinor: 5000,
              activePaidMinor: 0,
              openOrderDebtMinor: 5000,
              unrecordedPaymentsMinor: 0,
              unassignedMinor: 0,
            },
          ]
        }
        storePayments={storePayments}
        storePaymentsTotalCount={totalCount}
        locale="es"
      >
        <StorePaymentsSection locale="es" />
        <DeleteProbe />
      </StorePaymentStateProvider>
    </ToastProvider>,
  );
}

const SUBMIT_INPUT = {
  amount: 1000,
  paymentDate: new Date("2026-01-05T00:00:00.000Z"),
  currencyCode: "PEN",
  note: "Deposit",
  allocations: [],
};

describe("StorePaymentStateProvider - registering a payment", () => {
  it("adds the new payment row to the payments card immediately, before the server responds", () => {
    const pending = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pending.promise);

    renderStorePayments();

    // Nothing paid yet: the card renders nothing.
    expect(screen.queryByText(/Deposit/)).not.toBeInTheDocument();

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });

    // The row appears synchronously, in parallel with the still-pending server call, not after it.
    expect(screen.getByText('stores.redesign.detail.payments.noteLabel:{"note":"Deposit"}')).toBeInTheDocument();
    expect(createStorePaymentActionMock).toHaveBeenCalledTimes(1);
  });

  it("does not offer to delete a row the server has not answered for yet", async () => {
    // Deleting a `temp-*` row sends an id the server has never seen: it answers NOT_FOUND, the
    // collector gets an error toast for a payment that WAS recorded, and if the create resolves in
    // between they briefly see the same payment twice. The figures converge on their own; what
    // does not is what the row told them.
    const pending = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pending.promise);
    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });

    expect(screen.getByRole("button", { name: /payments\.deleteAria/ })).toBeDisabled();

    await act(async () => {
      pending.resolve({
        ok: true,
        paymentId: "payment-real-1",
        currencyCode: "PEN",
        affectedOrders: [],
        payment: paymentRow({ id: "payment-real-1", allocations: [] }),
      });
      await pending.promise;
    });

    // Back the moment the row is the server's.
    expect(screen.getByRole("button", { name: /payments\.deleteAria/ })).toBeEnabled();
  });

  it("reconciles the optimistic row with the server's canonical payment on success", async () => {
    const pending = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pending.promise);

    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });
    expect(screen.getByText('stores.redesign.detail.payments.noteLabel:{"note":"Deposit"}')).toBeInTheDocument();

    await act(async () => {
      pending.resolve({
        ok: true,
        paymentId: "payment-real-1",
        currencyCode: "PEN",
        affectedOrders: [],
        payment: {
          id: "payment-real-1",
          amount: 1000,
          currencyCode: "PEN",
          paymentDate: SUBMIT_INPUT.paymentDate,
          note: "Deposit",
          allocatedTotal: 0,
          claimingOrdersCount: 0,
          allocations: [],
        },
      });
      await pending.promise;
    });

    // Still exactly one row: the temp row was replaced, not duplicated.
    expect(screen.getAllByText('stores.redesign.detail.payments.noteLabel:{"note":"Deposit"}')).toHaveLength(1);
  });

  it("removes the optimistic row and restores the previous state when the server call fails", async () => {
    const pending = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pending.promise);

    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });
    expect(screen.getByText('stores.redesign.detail.payments.noteLabel:{"note":"Deposit"}')).toBeInTheDocument();

    await act(async () => {
      pending.resolve({ ok: false, error: "STORE_DEBT_EXCEEDED" });
      await pending.promise;
    });

    await waitFor(() => {
      expect(
        screen.queryByText('stores.redesign.detail.payments.noteLabel:{"note":"Deposit"}'),
      ).not.toBeInTheDocument();
    });
  });

  it("forwards the sheet's parked amount to the action (WO-09)", () => {
    // `StorePaymentSheetSubmitInput.parkedAmountMinor` is the "no sé todavía" slice the sheet's own
    // equality gate already validated against `amount`. The server's `requireFullAllocation` check
    // re-derives `allocationTotal + parkedAmountMinor` and refuses `ALLOCATION_SUM_BELOW_PAYMENT`
    // when it falls short of `amount` — so a coordinator that drops this field on the way to
    // `createStorePaymentAction` breaks every draft that parks money, even though the sheet itself
    // did everything right.
    createStorePaymentActionMock.mockReturnValueOnce(deferred<CreateStorePaymentActionResult>().promise);
    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.({
        ...SUBMIT_INPUT,
        amount: 1000,
        allocations: [{ orderId: "order-1", amountMinor: 400 }],
        declarePaidItemIds: [],
        parkedAmountMinor: 600,
      });
    });

    expect(createStorePaymentActionMock).toHaveBeenCalledWith(expect.objectContaining({ parkedAmountMinor: 600 }));
  });

  it("tells the sheet a rejected action was UNANSWERED, not a verdict it can act on (GRAVE 1)", async () => {
    // This coordinator absorbs the rejection into a RESOLVED outcome on purpose (see the test
    // below), so what the sheet actually receives from a dropped connection is an `{ ok: false }`
    // indistinguishable from a refusal the server described — unless it carries this flag. Without
    // it the sheet shuts the CTA on the one case whose right answer is an identical resend.
    createStorePaymentActionMock.mockReturnValueOnce(Promise.reject(new Error("network down")));
    renderStorePayments();

    let outcome: Promise<unknown> | undefined;
    act(() => {
      outcome = capturedSubmitRef.current?.({
        ...SUBMIT_INPUT,
        allocations: [{ orderId: "order-1", amountMinor: 1000 }],
      }) as Promise<unknown>;
    });

    await expect(outcome).resolves.toEqual({ ok: false, error: "server_error", unanswered: true });
  });

  it("does not undo a payment the server committed when the success handler itself throws (MENOR 6)", async () => {
    // A `catch` chained AFTER the success handler also catches whatever that handler throws, and
    // treats it as a failed payment: the row vanishes and an error toast claims nothing was
    // recorded, while the server holds a committed payment. The rollback belongs to the action's
    // OWN rejection, so it is the second argument of `then` and never sees this.
    const pending = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pending.promise);
    renderStorePayments();

    let outcome: Promise<unknown> | undefined;
    act(() => {
      outcome = capturedSubmitRef.current?.({
        ...SUBMIT_INPUT,
        allocations: [{ orderId: "order-1", amountMinor: 1000 }],
      }) as Promise<unknown>;
    });
    expect(screen.getByText('stores.redesign.detail.payments.noteLabel:{"note":"Deposit"}')).toBeInTheDocument();
    // Observed now, not after the fact: the handler has to be attached before the rejection or it
    // counts as an unhandled one.
    const settled = (outcome as Promise<unknown>).then(
      (value) => value,
      (error: unknown) => error,
    );

    throwingTranslationKey.current = "toastSuccess";
    try {
      await act(async () => {
        pending.resolve({
          ok: true,
          paymentId: "payment-real-1",
          currencyCode: "PEN",
          affectedOrders: [],
          payment: {
            id: "payment-real-1",
            amount: 1000,
            currencyCode: "PEN",
            paymentDate: SUBMIT_INPUT.paymentDate,
            note: "Deposit",
            allocatedTotal: 1000,
            claimingOrdersCount: 1,
            allocations: [allocationLine()],
          },
        });
        await pending.promise;
      });

      await expect(settled).resolves.toEqual(expect.objectContaining({ message: expect.stringMatching(/blew up/) }));
      expect(screen.getByText('stores.redesign.detail.payments.noteLabel:{"note":"Deposit"}')).toBeInTheDocument();
    } finally {
      throwingTranslationKey.current = null;
    }
  });
});

describe("StorePaymentStateProvider - retiring the sheet's cached order list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates it once the create resolves, refusal included", async () => {
    const pending = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pending.promise);
    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });
    // Not before the server answers: until then the cached payload is still the truth.
    expect(invalidateMock).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve({ ok: false, error: "STORE_DEBT_EXCEEDED" });
      await pending.promise;
    });

    expect(invalidateMock).toHaveBeenCalledTimes(1);
  });

  it("invalidates it after a delete too, since the debt just grew back", async () => {
    deleteStorePaymentActionMock.mockResolvedValueOnce({ ok: true });
    renderStorePayments([paymentRow()]);

    await act(async () => {
      await capturedDelete.handler?.("payment-1");
    });

    expect(deleteStorePaymentActionMock).toHaveBeenCalledWith("payment-1");
    expect(invalidateMock).toHaveBeenCalledTimes(1);
  });

  it("rolls the delete back and still invalidates when the action REJECTS", async () => {
    deleteStorePaymentActionMock.mockRejectedValueOnce(new Error("network down"));
    renderStorePayments([paymentRow()]);

    let result: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      result = await capturedDelete.handler?.("payment-1");
    });

    expect(result).toEqual({ ok: false, error: "server_error" });
    expect(invalidateMock).toHaveBeenCalledTimes(1);
    // The optimistic removal is undone: the row is back on the card.
    expect(screen.getByText('stores.redesign.detail.payments.noteLabel:{"note":"Deposit"}')).toBeInTheDocument();
  });
});

describe("StorePaymentStateProvider - the optimistic patch tells the truth about the money", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `vi.clearAllMocks` does not touch this: a stale order list would silently change what the
    // next test's fresh row is classified as.
    sheetOrdersRef.current = [];
  });

  const DEBT_WITH_LOST: StoreDebtRow[] = [
    // Baúl Jare, as production computes it: 250.00 committed, 410.00 handed over, 160.00 of it
    // still declared against a cancelled order, so `paidMinor` is 250.00 and the debt is zero.
    {
      storeId: "store-1",
      currencyCode: "PEN",
      committedMinor: 25000,
      paidMinor: 25000,
      debtMinor: 0,
      lostMinor: 16000,
      // The store's remaining standing order, the one the bar measures.
      activeCommittedMinor: 25000,
      activePaidMinor: 25000,
      openOrderDebtMinor: 0,
      unrecordedPaymentsMinor: 0,
      unassignedMinor: 0,
    },
  ];

  it("patches paidMinor alongside debtMinor when a payment is registered", () => {
    createStorePaymentActionMock.mockReturnValueOnce(deferred<CreateStorePaymentActionResult>().promise);
    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });

    // Both halves of the pair the progress block prints move together. Patching only `debtMinor`
    // leaves the bar contradicting the sentence right under it.
    expect(capturedState.debts).toEqual([
      {
        storeId: "store-1",
        currencyCode: "PEN",
        committedMinor: 5000,
        paidMinor: 1000,
        debtMinor: 4000,
        lostMinor: 0,
        activeCommittedMinor: 5000,
        // `SUBMIT_INPUT` declares nothing, so this is money on account: it pays down the store's
        // debt and belongs to no order, which is exactly what the bar must NOT count.
        activePaidMinor: 0,
        // Unchanged: nothing is declared against any order, so no active order's own open balance
        // moved (FIX A).
        openOrderDebtMinor: 5000,
        unrecordedPaymentsMinor: 0,
        // FIX A: the whole 1000 is parked (amount - Σ allocations = 1000 - 0), so it must be the
        // figure `resolveUnassignedMoneyLine` reads the instant the payment lands, not after the
        // next full page load.
        unassignedMinor: 1000,
      },
    ]);
  });

  it("does not move the figures when deleting a payment sunk in a cancelled order", async () => {
    deleteStorePaymentActionMock.mockResolvedValueOnce({ ok: true });
    renderStorePayments(
      [
        paymentRow({
          id: "payment-lost",
          amount: 16000,
          allocations: [allocationLine({ amountMinor: 16000, orderCancelled: true })],
        }),
      ],
      DEBT_WITH_LOST,
    );

    await act(async () => {
      await capturedDelete.handler?.("payment-lost");
    });

    // Server-side, deleting this payment drops 160.00 from the payments sum AND 160.00 from the
    // lost sum, so `paidMinor` and `debtMinor` do not budge. Subtracting the full amount locally
    // would swing the block from "Al día · 100%" to "Falta 160.00 · 36%" over a no-op.
    //
    // `lostMinor` DOES budge, and that is the whole point: the deleted row was the only thing
    // carrying those 160.00, on screen and in the data. Leaving it at 16000 leaves the block
    // saying 160.00 was sunk in a cancelled order after the payment that sank it is gone.
    expect(capturedState.debts).toEqual([
      {
        storeId: "store-1",
        currencyCode: "PEN",
        committedMinor: 25000,
        paidMinor: 25000,
        debtMinor: 0,
        lostMinor: 0,
        activeCommittedMinor: 25000,
        activePaidMinor: 25000,
        openOrderDebtMinor: 0,
        unrecordedPaymentsMinor: 0,
        unassignedMinor: 0,
      },
    ]);
  });

  it("moves the figures by the live part only when a payment is partly sunk", async () => {
    deleteStorePaymentActionMock.mockResolvedValueOnce({ ok: true });
    renderStorePayments(
      [
        paymentRow({
          id: "payment-mixed",
          amount: 5000,
          allocations: [
            allocationLine({ amountMinor: 2000, orderCancelled: true }),
            allocationLine({ orderId: "order-2", orderHumanReadableId: "ORD-20260105-02", amountMinor: 3000 }),
          ],
        }),
      ],
      DEBT_WITH_LOST,
    );

    await act(async () => {
      await capturedDelete.handler?.("payment-mixed");
    });

    // The bar moves by the live 30.00 only; the sunk 20.00 comes off `lostMinor` instead, so the
    // block and the payments list keep adding up to the same money.
    //
    // FIX A: `openOrderDebtMinor` moves by the same 30.00 the bar does (deleting a payment restores
    // the order's own open balance), and `unassignedMinor` does not move: `allocatedTotal` (5000)
    // equals `amount` (5000), so nothing about this payment was ever parked.
    expect(capturedState.debts[0]).toMatchObject({
      paidMinor: 25000 - 3000,
      debtMinor: 3000,
      lostMinor: 16000 - 2000,
      openOrderDebtMinor: 0 + 3000,
      unassignedMinor: 0,
    });
  });

  /** One row of the sheet's cached order list, which is where `orderActive` comes from on a create. */
  function sheetOrder(overrides: Partial<AssignableOrder> = {}): AssignableOrder {
    return {
      orderId: "order-1",
      humanReadableId: "ORD-20260105-01",
      orderDate: new Date("2026-01-05T00:00:00.000Z"),
      currencyCode: "PEN",
      isActive: true,
      totalCost: 5000,
      allocatedAmountMinor: 0,
      assignableMinor: 5000,
      restCeilingMinor: 5000,
      items: [],
      ...overrides,
    };
  }

  it("advances the bar by what a new payment declares against an order still in flight", () => {
    sheetOrdersRef.current = [sheetOrder()];
    createStorePaymentActionMock.mockReturnValueOnce(deferred<CreateStorePaymentActionResult>().promise);
    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.({
        ...SUBMIT_INPUT,
        allocations: [{ orderId: "order-1", orderItemId: null, amountMinor: 1000 }],
      });
    });

    // FIX A: `openOrderDebtMinor` moves by the same active-allocation delta as `activePaidMinor` (it
    // reads the same order's own open balance), and `unassignedMinor` does NOT move: the whole 1000
    // was declared against an order, so nothing about it is parked.
    expect(capturedState.debts[0]).toMatchObject({
      paidMinor: 1000,
      debtMinor: 4000,
      activePaidMinor: 1000,
      openOrderDebtMinor: 4000,
      unassignedMinor: 0,
    });
  });

  it("leaves the bar still when the payment settles an order that has already been delivered", () => {
    // The case the sheet exists for and the debt guard has to allow: an order delivered without
    // being fully paid. The money is real and the store's debt drops, but the order left the bar's
    // denominator when it was delivered, so advancing the bar would be counting it twice over.
    sheetOrdersRef.current = [sheetOrder({ isActive: false })];
    createStorePaymentActionMock.mockReturnValueOnce(deferred<CreateStorePaymentActionResult>().promise);
    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.({
        ...SUBMIT_INPUT,
        allocations: [{ orderId: "order-1", orderItemId: null, amountMinor: 1000 }],
      });
    });

    // FIX A: the order is not active, so its own open balance does not move either (`activePaidDelta`
    // is 0), and the money is still fully declared, so nothing is parked.
    expect(capturedState.debts[0]).toMatchObject({
      paidMinor: 1000,
      debtMinor: 4000,
      activePaidMinor: 0,
      openOrderDebtMinor: 5000,
      unassignedMinor: 0,
    });
  });

  it("takes the bar back down by the active slice only when a payment is deleted", async () => {
    deleteStorePaymentActionMock.mockResolvedValueOnce({ ok: true });
    renderStorePayments(
      [
        paymentRow({
          id: "payment-split",
          amount: 5000,
          allocations: [
            allocationLine({ amountMinor: 3000, orderActive: true }),
            // Same store, same payment, but an order that has already been delivered.
            allocationLine({
              orderId: "order-2",
              orderHumanReadableId: "ORD-20260105-02",
              amountMinor: 2000,
              orderActive: false,
            }),
          ],
        }),
      ],
      DEBT_WITH_LOST,
    );

    await act(async () => {
      await capturedDelete.handler?.("payment-split");
    });

    // All 50.00 leaves the store's debt; only the 30.00 that was riding on a live order leaves the
    // bar. Subtracting the whole amount would drop the bar for money the bar never counted.
    //
    // FIX A: `openOrderDebtMinor` moves by that same 30.00 (the live order's own open balance grows
    // back), and `unassignedMinor` does not move (`allocatedTotal` 5000 equals `amount` 5000).
    expect(capturedState.debts[0]).toMatchObject({
      paidMinor: 25000 - 5000,
      debtMinor: 5000,
      activePaidMinor: 25000 - 3000,
      openOrderDebtMinor: 0 + 3000,
      unassignedMinor: 0,
    });
  });

  it("takes the bar back down again when a create carrying declarations is refused", async () => {
    // The three other create-failure tests all submit `allocations: []`, so the rollback's
    // `-activePaidDelta` is only ever `-0` in them and the branch that matters here is never run.
    sheetOrdersRef.current = [sheetOrder()];
    const pending = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pending.promise);
    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.({
        ...SUBMIT_INPUT,
        allocations: [{ orderId: "order-1", orderItemId: null, amountMinor: 1000 }],
      });
    });
    expect(capturedState.debts[0]).toMatchObject({
      paidMinor: 1000,
      debtMinor: 4000,
      activePaidMinor: 1000,
      openOrderDebtMinor: 4000,
      unassignedMinor: 0,
    });

    await act(async () => {
      pending.resolve({ ok: false, error: "EXCEEDS_BALANCE", orderId: "order-1" });
      await pending.promise;
    });

    // Every figure back where it started. Undoing `paidMinor`/`debtMinor` but not the bar's own
    // number leaves the block showing progress against a payment the server refused.
    expect(capturedState.debts[0]).toMatchObject({
      paidMinor: 0,
      debtMinor: 5000,
      activePaidMinor: 0,
      openOrderDebtMinor: 5000,
      unassignedMinor: 0,
    });
  });

  it("corrects the bar when the server says the order finished between opening the sheet and submitting", async () => {
    // The sheet's cached list still calls `order-1` active; the server reads its status inside the
    // transaction and answers `orderActive: false` (another tab, or "Ya me llegó", completed it).
    // Left unreconciled the bar stays 10.00 too high for the whole session: the row below is
    // replaced by the server's, so a later delete subtracts 0 and the surplus never comes off.
    sheetOrdersRef.current = [sheetOrder()];
    const pending = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pending.promise);
    renderStorePayments();

    act(() => {
      capturedSubmitRef.current?.({
        ...SUBMIT_INPUT,
        allocations: [{ orderId: "order-1", orderItemId: null, amountMinor: 1000 }],
      });
    });
    expect(capturedState.debts[0]).toMatchObject({ activePaidMinor: 1000, openOrderDebtMinor: 4000 });

    await act(async () => {
      pending.resolve({
        ok: true,
        paymentId: "payment-real-1",
        currencyCode: "PEN",
        affectedOrders: [],
        payment: paymentRow({
          id: "payment-real-1",
          amount: 1000,
          allocations: [allocationLine({ amountMinor: 1000, orderActive: false })],
        }),
      });
      await pending.promise;
    });

    // The debt still moved by the whole payment: the money is real either way. Only the bar's
    // share was wrong, and `openOrderDebtMinor` follows the same correction (FIX A): the order was
    // never really active, so its own open balance never actually dropped.
    expect(capturedState.debts[0]).toMatchObject({
      paidMinor: 1000,
      debtMinor: 4000,
      activePaidMinor: 0,
      openOrderDebtMinor: 5000,
    });
  });

  it("restores the bar's own figure when the delete fails", async () => {
    deleteStorePaymentActionMock.mockResolvedValueOnce({ ok: false, error: "server_error" });
    renderStorePayments(
      [paymentRow({ id: "payment-live", amount: 3000, allocations: [allocationLine({ amountMinor: 3000 })] })],
      DEBT_WITH_LOST,
    );

    await act(async () => {
      await capturedDelete.handler?.("payment-live");
    });

    expect(capturedState.debts).toEqual(DEBT_WITH_LOST);
  });

  it("restores lostMinor too when the delete fails", async () => {
    deleteStorePaymentActionMock.mockResolvedValueOnce({ ok: false, error: "server_error" });
    renderStorePayments(
      [
        paymentRow({
          id: "payment-lost",
          amount: 16000,
          allocations: [allocationLine({ amountMinor: 16000, orderCancelled: true })],
        }),
      ],
      DEBT_WITH_LOST,
    );

    await act(async () => {
      await capturedDelete.handler?.("payment-lost");
    });

    // The row is back on the card, so the figure it carries has to be back too: a rollback that
    // undoes only half the patch is the same contradiction the patch itself exists to avoid.
    expect(capturedState.debts).toEqual(DEBT_WITH_LOST);
  });
});

describe("StorePaymentStateProvider - loading every payment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps rows the server answer predates: an in-flight create is not dropped", async () => {
    createStorePaymentActionMock.mockReturnValueOnce(deferred<CreateStorePaymentActionResult>().promise);
    listAllStorePaymentsActionMock.mockResolvedValueOnce({
      ok: true,
      payments: [paymentRow({ id: "payment-1", note: "Older" })],
    });
    renderStorePayments([paymentRow({ id: "payment-1", note: "Older" })]);

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });
    await act(async () => {
      await capturedState.loadAll?.();
    });

    expect(capturedState.payments.map((payment) => payment.id)).toEqual([expect.stringMatching(/^temp-/), "payment-1"]);
  });

  it("does not resurrect a row whose delete is still in flight", async () => {
    const pendingDelete = deferred<{ ok: boolean }>();
    deleteStorePaymentActionMock.mockReturnValueOnce(pendingDelete.promise);
    listAllStorePaymentsActionMock.mockResolvedValueOnce({
      ok: true,
      payments: [paymentRow({ id: "payment-1" }), paymentRow({ id: "payment-2", note: "Second" })],
    });
    renderStorePayments([paymentRow({ id: "payment-1" })]);

    let deletion: Promise<unknown> | undefined;
    act(() => {
      deletion = capturedDelete.handler?.("payment-1");
    });
    await act(async () => {
      await capturedState.loadAll?.();
    });

    // The server answer still lists `payment-1` because it was computed before the delete landed.
    // Merging it back would put a row the collector watched disappear straight back on screen.
    expect(capturedState.payments.map((payment) => payment.id)).toEqual(["payment-2"]);

    await act(async () => {
      pendingDelete.resolve({ ok: true });
      await deletion;
    });
    expect(capturedState.payments.map((payment) => payment.id)).toEqual(["payment-2"]);
  });

  it("does not resurrect a deleted row when the DELETE answers before the load-all answer", async () => {
    // The other ordering, and the real one: the list query is issued first but the delete commits
    // and answers first, so by the time the (stale) list lands the delete is no longer "in flight".
    // Clearing the guard set on success is what lets that stale answer put the row back.
    const pendingLoadAll = deferred<{ ok: boolean; payments: StorePaymentListRow[] }>();
    deleteStorePaymentActionMock.mockResolvedValueOnce({ ok: true });
    listAllStorePaymentsActionMock.mockReturnValueOnce(pendingLoadAll.promise);
    renderStorePayments([paymentRow({ id: "payment-1" })]);

    let loading: Promise<unknown> | undefined;
    act(() => {
      loading = capturedState.loadAll?.();
    });
    await act(async () => {
      await capturedDelete.handler?.("payment-1");
    });
    expect(capturedState.payments.map((payment) => payment.id)).toEqual([]);

    await act(async () => {
      pendingLoadAll.resolve({
        ok: true,
        payments: [paymentRow({ id: "payment-1" }), paymentRow({ id: "payment-2", note: "Second" })],
      });
      await loading;
    });

    expect(capturedState.payments.map((payment) => payment.id)).toEqual(["payment-2"]);
  });

  it("moves focus to the first revealed row instead of dropping it on <body>", async () => {
    // The button that had focus unmounts the moment the list is complete, so if nothing catches
    // the focus it lands on <body> and a keyboard user restarts from the top of the document.
    //
    // This has to run against the REAL provider, not a stubbed `loadAllStorePayments`: the bug is
    // entirely about WHEN the rows exist. `await loadAllStorePayments()` resumes in a microtask
    // while React commits the new rows later, so a focus call written in the click handler reads
    // the pre-load list and silently no-ops.
    //
    // The click is deliberately NOT wrapped in `act`. Inside an act scope React flushes its work
    // queue on the same microtask ladder the handler resumes on, so the rows happen to be in the
    // DOM by then and the broken version passes. A bare DOM click plus `waitFor` reproduces the
    // real scheduling, and is the difference between a test that fixes this and one that watches
    // it: with the focus call back in the handler this assertion reads BODY.
    listAllStorePaymentsActionMock.mockResolvedValueOnce({
      ok: true,
      payments: [
        paymentRow({ id: "payment-1" }),
        paymentRow({ id: "payment-2", note: "Second", paymentDate: new Date("2026-01-04T00:00:00.000Z") }),
      ],
    });
    renderStorePayments([paymentRow({ id: "payment-1" })], undefined, 2);

    screen.getByRole("button", { name: 'stores.redesign.detail.payments.seeAll:{"count":2}' }).click();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("listitem")[1]));
  });

  it("catches the focus the vanishing control drops when the fetch reveals nothing", async () => {
    // The badge and the list can drift: it says 2, another session already deleted one, so
    // "see all" fetches and lands the single row that is already on screen. Nothing is revealed,
    // and because the total is now derived from the list, that same answer completes it — so the
    // button unmounts in this commit and takes the focus it was holding with it. There is no
    // revealed row to aim at; the end of the list is where the collector was headed.
    //
    // This is the defect that blocked deriving the count at all. jsdom's `.click()` does not move
    // focus, so the press has to be focused explicitly for this to be the keyboard case.
    listAllStorePaymentsActionMock.mockResolvedValueOnce({ ok: true, payments: [paymentRow({ id: "payment-1" })] });
    renderStorePayments([paymentRow({ id: "payment-1" })], undefined, 2);

    const seeAll = screen.getByRole("button", { name: 'stores.redesign.detail.payments.seeAll:{"count":2}' });
    seeAll.focus();
    expect(document.activeElement).toBe(seeAll);
    seeAll.click();

    await waitFor(() => expect(screen.queryByText(/payments\.seeAll/)).not.toBeInTheDocument());
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("listitem")[0]));
  });

  it("leaves focus alone when the press never held it, instead of scrolling a mouse user to the last row", async () => {
    // Not every browser focuses a button on a mouse press (Safari does not), so "focus is on
    // <body> after the load" is not by itself proof that anything was dropped. Answering it by
    // focusing the last row would scroll a collector who is only clicking down the page.
    listAllStorePaymentsActionMock.mockResolvedValueOnce({ ok: true, payments: [paymentRow({ id: "payment-1" })] });
    renderStorePayments([paymentRow({ id: "payment-1" })], undefined, 2);

    // `.click()` in jsdom dispatches without focusing, which is exactly the Safari-mouse shape.
    screen.getByRole("button", { name: 'stores.redesign.detail.payments.seeAll:{"count":2}' }).click();

    await waitFor(() => expect(screen.queryByText(/payments\.seeAll/)).not.toBeInTheDocument());
    expect(document.activeElement).toBe(document.body);
  });

  it("retires a focus request that revealed nothing, instead of firing it on an unrelated insert later", async () => {
    // Leaving the request armed is not harmless: the effect re-runs on the next row insert from
    // ANY source, so registering a payment minutes later used to yank focus out of whatever the
    // collector was doing and into the list.
    createStorePaymentActionMock.mockReturnValueOnce(new Promise(() => {}));
    listAllStorePaymentsActionMock.mockResolvedValueOnce({ ok: true, payments: [paymentRow({ id: "payment-1" })] });
    renderStorePayments([paymentRow({ id: "payment-1" })], undefined, 2);

    const seeAll = screen.getByRole("button", { name: 'stores.redesign.detail.payments.seeAll:{"count":2}' });
    seeAll.focus();
    seeAll.click();

    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("listitem")[0]));
    const caughtRow = screen.getAllByRole("listitem")[0];

    // A brand-new payment arrives much later. It inserts a row, which is exactly the state change
    // the stale request was waiting for.
    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(document.activeElement).toBe(caughtRow);
  });

  it("does not label the completed list with a total smaller than the rows in it", async () => {
    // The page rendered a cap of 1 over a total of 2; between that render and this fetch another
    // session recorded a third payment. The count the page shipped with is patched by ±1 per
    // create/delete and knows nothing about that, so a card still trusting it labels three rows
    // "2" and the sr-only status reads "showing 3 of 2" — a total below the list it is the total of.
    listAllStorePaymentsActionMock.mockResolvedValueOnce({
      ok: true,
      payments: [
        paymentRow({ id: "payment-1" }),
        paymentRow({ id: "payment-2", note: "Second", paymentDate: new Date("2026-01-04T00:00:00.000Z") }),
        paymentRow({ id: "payment-3", note: "Third", paymentDate: new Date("2026-01-03T00:00:00.000Z") }),
      ],
    });
    renderStorePayments([paymentRow({ id: "payment-1" })], undefined, 2);

    await act(async () => {
      await capturedState.loadAll?.();
    });

    expect(capturedState.payments).toHaveLength(3);
    expect(screen.getByText('stores.redesign.detail.payments.loadedStatus:{"shown":3,"total":3}')).toBeInTheDocument();
  });

  it("settles a stale-HIGH total down to the rows the completed fetch actually returned", async () => {
    // The other direction, and the one that used to be left wrong on purpose: the page rendered a
    // total of 2, another session deleted one, and the fetch brings back the single row already on
    // screen. The badge stayed at 2 because lowering it unmounts the "Ver los N pagos" button in
    // the same commit the collector's focus is on it. Now that `StorePaymentsSection` catches that
    // focus, the count can say what the list says: one payment, and no control offering more.
    listAllStorePaymentsActionMock.mockResolvedValueOnce({ ok: true, payments: [paymentRow({ id: "payment-1" })] });
    renderStorePayments([paymentRow({ id: "payment-1" })], undefined, 2);

    await act(async () => {
      await capturedState.loadAll?.();
    });

    expect(capturedState.payments).toHaveLength(1);
    expect(screen.getByText('stores.redesign.detail.payments.loadedStatus:{"shown":1,"total":1}')).toBeInTheDocument();
    expect(screen.queryByText(/payments\.seeAll/)).not.toBeInTheDocument();
  });

  it("keeps counting from the list after load-all, so a later create and delete stay in step", async () => {
    // Once the count is derived it must STAY derived: the ±1 the create and delete paths apply to
    // the page's own figure is now irrelevant, and a card that fell back to it would drift again
    // on the first row the collector adds after pressing "see all".
    createStorePaymentActionMock.mockReturnValueOnce(new Promise(() => {}));
    listAllStorePaymentsActionMock.mockResolvedValueOnce({ ok: true, payments: [paymentRow({ id: "payment-1" })] });
    renderStorePayments([paymentRow({ id: "payment-1" })], undefined, 2);

    await act(async () => {
      await capturedState.loadAll?.();
    });
    expect(screen.getByText('stores.redesign.detail.payments.loadedStatus:{"shown":1,"total":1}')).toBeInTheDocument();

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(screen.getByText('stores.redesign.detail.payments.loadedStatus:{"shown":2,"total":2}')).toBeInTheDocument();
    // And still no "see all": two rows out of two is a complete list.
    expect(screen.queryByText(/payments\.seeAll/)).not.toBeInTheDocument();
  });

  it("does not let a failed create's rollback discard the rows load-all just fetched", async () => {
    const pendingCreate = deferred<CreateStorePaymentActionResult>();
    createStorePaymentActionMock.mockReturnValueOnce(pendingCreate.promise);
    listAllStorePaymentsActionMock.mockResolvedValueOnce({
      ok: true,
      payments: [paymentRow({ id: "payment-1" }), paymentRow({ id: "payment-2", note: "Second" })],
    });
    renderStorePayments([paymentRow({ id: "payment-1" })]);

    act(() => {
      capturedSubmitRef.current?.(SUBMIT_INPUT);
    });
    await act(async () => {
      await capturedState.loadAll?.();
    });
    expect(capturedState.payments).toHaveLength(3);

    await act(async () => {
      pendingCreate.resolve({ ok: false, error: "STORE_DEBT_EXCEEDED" });
      await pendingCreate.promise;
    });

    // A snapshot rollback would restore the single row captured at submit time and silently throw
    // away everything load-all brought in. Undoing only its own row is what keeps both writers safe.
    expect(capturedState.payments.map((payment) => payment.id)).toEqual(["payment-1", "payment-2"]);
    expect(capturedState.debts[0]).toMatchObject({ paidMinor: 0, debtMinor: 5000 });
  });
});

describe("StorePaymentStateProvider - applyAdjustmentDeltas (FIX 1, WO-11 review)", () => {
  it("subtracts openGroupWriteOffMinor from openOrderDebtMinor and totalWriteOffMinor from debtMinor", () => {
    renderStorePayments();

    act(() => {
      capturedState.applyAdjustmentDeltas?.({
        currencyCode: "PEN",
        openGroupWriteOffMinor: 1800,
        totalWriteOffMinor: 2500,
      });
    });

    // Fixture starts at debtMinor 5000 / openOrderDebtMinor 5000 (see `renderStorePayments`'s own
    // default). Only these two fields move; nothing else this provider tracks (`paidMinor`,
    // `activePaidMinor`, `unassignedMinor`, ...) is a reconciliation adjustment's to touch.
    expect(capturedState.debts[0]).toMatchObject({
      debtMinor: 5000 - 2500,
      openOrderDebtMinor: 5000 - 1800,
      paidMinor: 0,
      activePaidMinor: 0,
      unassignedMinor: 0,
    });
  });

  it("reverts the patch when called again with the same magnitude negated", () => {
    renderStorePayments();

    act(() => {
      capturedState.applyAdjustmentDeltas?.({
        currencyCode: "PEN",
        openGroupWriteOffMinor: 1800,
        totalWriteOffMinor: 2500,
      });
    });
    act(() => {
      capturedState.applyAdjustmentDeltas?.({
        currencyCode: "PEN",
        openGroupWriteOffMinor: -1800,
        totalWriteOffMinor: -2500,
      });
    });

    // Back to the untouched fixture: this IS the whole rollback mechanism (no separate "undo" path).
    expect(capturedState.debts[0]).toMatchObject({ debtMinor: 5000, openOrderDebtMinor: 5000 });
  });

  it("leaves a different currency's row untouched", () => {
    renderStorePayments(
      [],
      [
        {
          storeId: "store-1",
          currencyCode: "PEN",
          committedMinor: 5000,
          paidMinor: 0,
          debtMinor: 5000,
          lostMinor: 0,
          activeCommittedMinor: 5000,
          activePaidMinor: 0,
          openOrderDebtMinor: 5000,
          unrecordedPaymentsMinor: 0,
          unassignedMinor: 0,
        },
        {
          storeId: "store-1",
          currencyCode: "USD",
          committedMinor: 1000,
          paidMinor: 0,
          debtMinor: 1000,
          lostMinor: 0,
          activeCommittedMinor: 1000,
          activePaidMinor: 0,
          openOrderDebtMinor: 1000,
          unrecordedPaymentsMinor: 0,
          unassignedMinor: 0,
        },
      ],
    );

    act(() => {
      capturedState.applyAdjustmentDeltas?.({
        currencyCode: "PEN",
        openGroupWriteOffMinor: 1800,
        totalWriteOffMinor: 2500,
      });
    });

    expect(capturedState.debts.find((debt) => debt.currencyCode === "USD")).toMatchObject({
      debtMinor: 1000,
      openOrderDebtMinor: 1000,
    });
  });
});
