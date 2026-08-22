import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/contexts/ToastContext";
import type { StoreDebtRow } from "@/lib/data/orders/storePaymentQueries";
import StoreReconciliationProvider, {
  useStoreReconciliationState,
  type StoreReconciliationAdjustmentRow,
} from "../StoreReconciliationProvider";

const {
  capturedSubmitRef,
  capturedOnGoToAssignPaymentRef,
  createStoreAccountAdjustmentActionMock,
  deleteStoreAccountAdjustmentActionMock,
  getStoreReconciliationPreviewActionMock,
  routerRefreshMock,
  openPaymentSheetMock,
  applyAdjustmentDeltasMock,
} = vi.hoisted(() => ({
  capturedSubmitRef: { current: null as ((input: unknown) => Promise<unknown> | void) | null },
  capturedOnGoToAssignPaymentRef: { current: null as (() => void) | null },
  createStoreAccountAdjustmentActionMock: vi.fn(),
  deleteStoreAccountAdjustmentActionMock: vi.fn(),
  getStoreReconciliationPreviewActionMock: vi.fn(),
  routerRefreshMock: vi.fn(),
  openPaymentSheetMock: vi.fn(),
  applyAdjustmentDeltasMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefreshMock, push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      vars ? `${namespace}.${key}:${JSON.stringify(vars)}` : `${namespace}.${key}`;
    t.has = () => true;
    return t;
  },
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

vi.mock("@/app/[locale]/(app)/_actions/storeAccountAdjustmentActions", () => ({
  createStoreAccountAdjustmentAction: (...args: unknown[]) => createStoreAccountAdjustmentActionMock(...args),
  deleteStoreAccountAdjustmentAction: (...args: unknown[]) => deleteStoreAccountAdjustmentActionMock(...args),
  getStoreReconciliationPreviewAction: (...args: unknown[]) => getStoreReconciliationPreviewActionMock(...args),
}));

vi.mock("@/components/modules/StoreReconciliationSheet", () => ({
  StoreReconciliationSheet: (props: { onSubmit: (input: unknown) => void; onGoToAssignPayment: () => void }) => {
    capturedSubmitRef.current = props.onSubmit;
    capturedOnGoToAssignPaymentRef.current = props.onGoToAssignPayment;
    return null;
  },
}));

// A FIXED debt row, deliberately: the reviewer's own finding (GRAVE 1 / FIX 1) was that this mock
// used to feed one and never assert `applyAdjustmentDeltas` was called at all, so a coordinator that
// silently dropped the setter (or called it with the wrong deltas) still passed every test here. The
// fixed row stays (nothing in this suite reads it back to assert a MOVED figure — that would belong
// to `StorePaymentStateProvider`'s own test, which owns the real reducer), but `applyAdjustmentDeltas`
// is now a real spy the tests below assert on directly.
vi.mock("../StorePaymentStateProvider", () => ({
  useStorePaymentState: () => ({
    storeDebtByCurrency: [
      {
        storeId: "store-1",
        currencyCode: "PEN",
        committedMinor: 18000,
        paidMinor: 0,
        debtMinor: 18000,
        lostMinor: 0,
        activeCommittedMinor: 18000,
        activePaidMinor: 0,
        openOrderDebtMinor: 18000,
        unrecordedPaymentsMinor: 0,
        unassignedMinor: 0,
      } satisfies StoreDebtRow,
    ],
    openPaymentSheet: openPaymentSheetMock,
    applyAdjustmentDeltas: applyAdjustmentDeltasMock,
  }),
}));

/** Reaches the provider's own context without going through any launcher UI. */
const captured: {
  openReconciliationSheet: ((currencyCode: string) => void) | null;
  adjustments: StoreReconciliationAdjustmentRow[];
  deleteAdjustment: ((adjustmentId: string) => Promise<{ ok: boolean; error?: string }>) | null;
} = { openReconciliationSheet: null, adjustments: [], deleteAdjustment: null };

function Probe() {
  const state = useStoreReconciliationState();
  useEffect(() => {
    captured.openReconciliationSheet = state.openReconciliationSheet;
    captured.adjustments = state.adjustments;
    captured.deleteAdjustment = state.deleteAdjustment;
  });
  return (
    <ul>
      {state.adjustments.map((adjustment) => (
        <li key={adjustment.id}>{adjustment.reason}</li>
      ))}
    </ul>
  );
}

beforeEach(() => {
  applyAdjustmentDeltasMock.mockClear();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** One row of the preview's own `openOrders` / `deliveredOrders` list, in the shape the sheet reads. */
function previewOrderRow(overrides: Partial<{ orderId: string; totalCost: number; openBalanceMinor: number }> = {}) {
  return {
    orderId: "order-1",
    orderDate: new Date("2026-06-01T00:00:00.000Z"),
    humanReadableId: "ORD-1",
    totalCost: 18000,
    openBalanceMinor: 18000,
    writtenOffMinor: 0,
    status: "OPEN" as never,
    ...overrides,
  };
}

function renderProvider(
  initialAdjustments: StoreReconciliationAdjustmentRow[] = [],
  preview: {
    openOrders: ReturnType<typeof previewOrderRow>[];
    deliveredOrders: ReturnType<typeof previewOrderRow>[];
  } = {
    openOrders: [],
    deliveredOrders: [],
  },
) {
  getStoreReconciliationPreviewActionMock.mockResolvedValue({
    ok: true,
    preview: { ...preview, unassignedMinor: 0 },
  });
  return render(
    <ToastProvider>
      <StoreReconciliationProvider
        storeId="store-1"
        storeName="Akiba Records"
        locale="es"
        adjustments={initialAdjustments}
      >
        <Probe />
      </StoreReconciliationProvider>
    </ToastProvider>,
  );
}

describe("StoreReconciliationProvider - submitting an adjustment", () => {
  it("inserts the adjustment optimistically before the server answers", () => {
    const pending = deferred<{ ok: true; adjustmentId: string }>();
    createStoreAccountAdjustmentActionMock.mockReturnValueOnce(pending.promise);
    renderProvider();

    act(() => captured.openReconciliationSheet?.("PEN"));

    expect(screen.queryByText("no identificado")).not.toBeInTheDocument();

    act(() => {
      void capturedSubmitRef.current?.({
        reason: "no identificado",
        lines: [{ orderId: "order-1", amountMinor: 18000 }],
      });
    });

    // The optimistic row is on screen immediately, in parallel with the still-pending server call.
    expect(screen.getByText("no identificado")).toBeInTheDocument();
    expect(createStoreAccountAdjustmentActionMock).toHaveBeenCalledTimes(1);
  });

  it("reconciles the optimistic id with the server's own and refreshes the router on success", async () => {
    createStoreAccountAdjustmentActionMock.mockResolvedValueOnce({ ok: true, adjustmentId: "adjustment-real-1" });
    renderProvider();

    act(() => captured.openReconciliationSheet?.("PEN"));
    await act(async () => {
      await capturedSubmitRef.current?.({
        reason: "no identificado",
        lines: [{ orderId: "order-1", amountMinor: 18000 }],
      });
    });

    expect(screen.getByText("no identificado")).toBeInTheDocument();
    expect(captured.adjustments.some((adjustment) => adjustment.id === "adjustment-real-1")).toBe(true);
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("rolls back the optimistic insert and toasts the mapped error on ADJUSTMENT_EXCEEDS_ORDER_BALANCE", async () => {
    createStoreAccountAdjustmentActionMock.mockResolvedValueOnce({
      ok: false,
      error: "ADJUSTMENT_EXCEEDS_ORDER_BALANCE",
      orderId: "order-1",
    });
    renderProvider();

    act(() => captured.openReconciliationSheet?.("PEN"));
    await act(async () => {
      await capturedSubmitRef.current?.({
        reason: "no identificado",
        lines: [{ orderId: "order-1", amountMinor: 18000 }],
      });
    });

    // Rolled back: the optimistic row is gone.
    expect(screen.queryByText("no identificado")).not.toBeInTheDocument();
    expect(
      screen.getByText("stores.redesign.detail.reconciliation.error.ADJUSTMENT_EXCEEDS_ORDER_BALANCE"),
    ).toBeInTheDocument();
  });

  it("rolls back and toasts on STORE_HAS_UNASSIGNED_MONEY too", async () => {
    createStoreAccountAdjustmentActionMock.mockResolvedValueOnce({ ok: false, error: "STORE_HAS_UNASSIGNED_MONEY" });
    renderProvider();

    act(() => captured.openReconciliationSheet?.("PEN"));
    await act(async () => {
      await capturedSubmitRef.current?.({
        reason: "no identificado",
        lines: [{ orderId: "order-1", amountMinor: 18000 }],
      });
    });

    expect(screen.queryByText("no identificado")).not.toBeInTheDocument();
    expect(
      screen.getByText("stores.redesign.detail.reconciliation.error.STORE_HAS_UNASSIGNED_MONEY"),
    ).toBeInTheDocument();
  });

  it("moves openOrderDebtMinor and debtMinor by the open-group and total write-off, scoped separately (FIX 1, WO-11 review)", async () => {
    createStoreAccountAdjustmentActionMock.mockReturnValueOnce(new Promise(() => {}));
    renderProvider([], {
      openOrders: [previewOrderRow({ orderId: "order-1" })],
      deliveredOrders: [previewOrderRow({ orderId: "order-2", totalCost: 7000, openBalanceMinor: 7000 })],
    });

    await act(async () => {
      captured.openReconciliationSheet?.("PEN");
      await Promise.resolve();
    });

    act(() => {
      void capturedSubmitRef.current?.({
        reason: "no identificado",
        lines: [
          { orderId: "order-1", amountMinor: 18000 },
          { orderId: "order-2", amountMinor: 7000 },
        ],
      });
    });

    // order-1 is OPEN (18000 counts toward `openOrderDebtMinor`); order-2 is delivered (its 7000
    // moves only the lifetime `debtMinor` ceiling, `ADR 0034` §1 — the ceiling subtracts ALL lines).
    expect(applyAdjustmentDeltasMock).toHaveBeenCalledWith({
      currencyCode: "PEN",
      openGroupWriteOffMinor: 18000,
      totalWriteOffMinor: 25000,
    });
  });

  it("reverts the (negated) deltas when the create is refused", async () => {
    createStoreAccountAdjustmentActionMock.mockResolvedValueOnce({
      ok: false,
      error: "ADJUSTMENT_EXCEEDS_ORDER_BALANCE",
      orderId: "order-1",
    });
    renderProvider([], { openOrders: [previewOrderRow({ orderId: "order-1" })], deliveredOrders: [] });

    await act(async () => {
      captured.openReconciliationSheet?.("PEN");
      await Promise.resolve();
    });
    await act(async () => {
      await capturedSubmitRef.current?.({
        reason: "no identificado",
        lines: [{ orderId: "order-1", amountMinor: 18000 }],
      });
    });

    expect(applyAdjustmentDeltasMock).toHaveBeenNthCalledWith(1, {
      currencyCode: "PEN",
      openGroupWriteOffMinor: 18000,
      totalWriteOffMinor: 18000,
    });
    // Same magnitude, negated: this is the whole rollback mechanism (see the provider's own doc).
    expect(applyAdjustmentDeltasMock).toHaveBeenNthCalledWith(2, {
      currencyCode: "PEN",
      openGroupWriteOffMinor: -18000,
      totalWriteOffMinor: -18000,
    });
  });
});

describe("StoreReconciliationProvider - deleting an adjustment", () => {
  function existingAdjustment(
    overrides: Partial<StoreReconciliationAdjustmentRow> = {},
  ): StoreReconciliationAdjustmentRow {
    return {
      id: "adjustment-1",
      adjustmentDate: new Date("2026-08-01T00:00:00.000Z"),
      reason: "no identificado",
      magnitudeMinor: 18000,
      currencyCode: "PEN",
      lines: [
        {
          orderId: "order-1",
          amountMinor: 18000,
          orderDate: new Date(),
          orderHumanReadableId: "ORD-1",
          orderActive: true,
        },
      ],
      ...overrides,
    };
  }

  it("removes the row optimistically before the server answers", () => {
    const pending = deferred<{ ok: true }>();
    deleteStoreAccountAdjustmentActionMock.mockReturnValueOnce(pending.promise);
    renderProvider([existingAdjustment()]);

    expect(screen.getByText("no identificado")).toBeInTheDocument();

    act(() => {
      void captured.deleteAdjustment?.("adjustment-1");
    });

    expect(screen.queryByText("no identificado")).not.toBeInTheDocument();
  });

  it("puts the row back when the server refuses the delete", async () => {
    deleteStoreAccountAdjustmentActionMock.mockResolvedValueOnce({ ok: false, error: "NOT_FOUND" });
    renderProvider([existingAdjustment()]);

    let result: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      result = await captured.deleteAdjustment?.("adjustment-1");
    });

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    // Rollback: the row is back on screen.
    expect(screen.getByText("no identificado")).toBeInTheDocument();
  });

  it("toasts the mapped error too, not only rolling the row back (MINOR-6, WO-11 review)", async () => {
    // The row's own inline confirm-dialog message is `StorePaymentsSection`'s job (and already
    // covered there); this asserts the PROVIDER'S failure branch, mirroring how a payment create's
    // own failure toasts (`StorePaymentStateProvider.handleSubmitPayment`).
    deleteStoreAccountAdjustmentActionMock.mockResolvedValueOnce({ ok: false, error: "NOT_FOUND" });
    renderProvider([existingAdjustment()]);

    await act(async () => {
      await captured.deleteAdjustment?.("adjustment-1");
    });

    expect(screen.getByText("stores.redesign.detail.reconciliation.error.NOT_FOUND")).toBeInTheDocument();
  });

  it("restores openOrderDebtMinor and debtMinor by the deleted adjustment's own deltas, open-group lines scoped separately (FIX 1, WO-11 review)", () => {
    const pending = deferred<{ ok: true }>();
    deleteStoreAccountAdjustmentActionMock.mockReturnValueOnce(pending.promise);
    const mixed = existingAdjustment({
      magnitudeMinor: 25000,
      lines: [
        {
          orderId: "order-1",
          amountMinor: 18000,
          orderDate: new Date(),
          orderHumanReadableId: "ORD-1",
          orderActive: true,
        },
        {
          orderId: "order-2",
          amountMinor: 7000,
          orderDate: new Date(),
          orderHumanReadableId: "ORD-2",
          orderActive: false,
        },
      ],
    });
    renderProvider([mixed]);

    act(() => {
      void captured.deleteAdjustment?.("adjustment-1");
    });

    // Deleting REMOVES a write-off, so it gives money back: negated deltas, scoped to the open-group
    // line only for `openOrderDebtMinor` (18000) but every line for the lifetime `debtMinor` (25000).
    expect(applyAdjustmentDeltasMock).toHaveBeenCalledWith({
      currencyCode: "PEN",
      openGroupWriteOffMinor: -18000,
      totalWriteOffMinor: -25000,
    });
  });

  it("re-applies the (positive) deltas when the delete is refused, undoing the optimistic restore", async () => {
    deleteStoreAccountAdjustmentActionMock.mockResolvedValueOnce({ ok: false, error: "NOT_FOUND" });
    renderProvider([existingAdjustment()]);

    await act(async () => {
      await captured.deleteAdjustment?.("adjustment-1");
    });

    expect(applyAdjustmentDeltasMock).toHaveBeenNthCalledWith(1, {
      currencyCode: "PEN",
      openGroupWriteOffMinor: -18000,
      totalWriteOffMinor: -18000,
    });
    // Same magnitude, positive again: undoes the optimistic restore now that the delete failed.
    expect(applyAdjustmentDeltasMock).toHaveBeenNthCalledWith(2, {
      currencyCode: "PEN",
      openGroupWriteOffMinor: 18000,
      totalWriteOffMinor: 18000,
    });
  });
});

describe("StoreReconciliationProvider - parked money hand-off", () => {
  it("calls the store payment provider's own opener when the sheet asks to assign a payment", () => {
    renderProvider();
    act(() => captured.openReconciliationSheet?.("PEN"));

    act(() => capturedOnGoToAssignPaymentRef.current?.());

    expect(openPaymentSheetMock).toHaveBeenCalledTimes(1);
  });
});
