import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/contexts/ToastContext";
import type { StoreDebtRow } from "@/lib/data/orders/storePaymentQueries";
import StorePaymentStateProvider, { useStorePaymentState } from "../StorePaymentStateProvider";
import StoreReconciliationProvider, { useStoreReconciliationState } from "../StoreReconciliationProvider";

/**
 * Integration test for FIX 1 (WO-11 review): mounts the REAL `StorePaymentStateProvider` (the only
 * owner of `storeDebtByCurrency` state) underneath the REAL `StoreReconciliationProvider`, exactly as
 * `StoreDetailContent` nests them, and neither provider is mocked away. Every OTHER test in this
 * folder mocks one provider from the other's perspective, which is exactly why the reviewer's own
 * defect (an adjustment write-off not moving the sidebar's debt figures) went unnoticed: a mock can
 * answer "was the setter called" but never "did the setter's OWN state end up right", and reopening
 * the sheet is the one behaviour that only a real, un-mocked `debts` reducer can prove.
 */

const {
  capturedReconciliationSheetProps,
  createStoreAccountAdjustmentActionMock,
  getStoreReconciliationPreviewActionMock,
  routerRefreshMock,
} = vi.hoisted(() => ({
  capturedReconciliationSheetProps: {
    current: null as { openOrderDebtMinor: number; onSubmit: (input: unknown) => Promise<unknown> } | null,
  },
  createStoreAccountAdjustmentActionMock: vi.fn(),
  getStoreReconciliationPreviewActionMock: vi.fn(),
  routerRefreshMock: vi.fn(),
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

vi.mock("@/app/[locale]/(app)/_actions/storePaymentActions", () => ({
  createStorePaymentAction: vi.fn(),
  deleteStorePaymentAction: vi.fn(),
  listAllStorePaymentsAction: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/_actions/storeAccountAdjustmentActions", () => ({
  createStoreAccountAdjustmentAction: (...args: unknown[]) => createStoreAccountAdjustmentActionMock(...args),
  deleteStoreAccountAdjustmentAction: vi.fn(),
  getStoreReconciliationPreviewAction: (...args: unknown[]) => getStoreReconciliationPreviewActionMock(...args),
}));

vi.mock("@/components/modules/StorePaymentSheet", () => ({
  useStorePaymentSheetOrders: () => ({
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    retry: vi.fn(),
    invalidate: vi.fn(),
    orders: [],
    isLoading: false,
    hasError: false,
    isStale: false,
    isRefreshing: false,
  }),
  StorePaymentSheet: () => null,
}));

vi.mock("@/components/modules/StoreReconciliationSheet", () => ({
  StoreReconciliationSheet: (props: { openOrderDebtMinor: number; onSubmit: (input: unknown) => Promise<unknown> }) => {
    capturedReconciliationSheetProps.current = props;
    return null;
  },
}));

/** Reaches both providers' contexts without going through any launcher UI. */
const captured: {
  openReconciliationSheet: ((currencyCode: string) => void) | null;
} = { openReconciliationSheet: null };

function Probe() {
  const payment = useStorePaymentState();
  const reconciliation = useStoreReconciliationState();
  useEffect(() => {
    captured.openReconciliationSheet = reconciliation.openReconciliationSheet;
  });
  return <div data-testid="debt">{payment.storeDebtByCurrency[0]?.openOrderDebtMinor}</div>;
}

function debtRow(overrides: Partial<StoreDebtRow> = {}): StoreDebtRow {
  return {
    storeId: "store-1",
    currencyCode: "PEN",
    committedMinor: 38000,
    paidMinor: 0,
    debtMinor: 38000,
    lostMinor: 0,
    activeCommittedMinor: 38000,
    activePaidMinor: 0,
    openOrderDebtMinor: 38000,
    unrecordedPaymentsMinor: 0,
    unassignedMinor: 0,
    ...overrides,
  };
}

function renderIntegration() {
  getStoreReconciliationPreviewActionMock.mockResolvedValue({
    ok: true,
    preview: {
      openOrders: [
        {
          orderId: "order-1",
          orderDate: new Date("2026-06-01T00:00:00.000Z"),
          humanReadableId: "ORD-1",
          totalCost: 38000,
          openBalanceMinor: 38000,
          writtenOffMinor: 0,
          status: "OPEN",
        },
      ],
      deliveredOrders: [],
      unassignedMinor: 0,
    },
  });

  return render(
    <ToastProvider>
      <StorePaymentStateProvider
        storeId="store-1"
        storeName="Akiba Records"
        storeDebtByCurrency={[debtRow()]}
        storePayments={[]}
        storePaymentsTotalCount={0}
        locale="es"
      >
        <StoreReconciliationProvider storeId="store-1" storeName="Akiba Records" locale="es" adjustments={[]}>
          <Probe />
        </StoreReconciliationProvider>
      </StorePaymentStateProvider>
    </ToastProvider>,
  );
}

describe("StorePaymentStateProvider + StoreReconciliationProvider - the second-open scenario (FIX 1, WO-11 review)", () => {
  it("moves the read-out baseline the instant a write-off lands, so re-opening the sheet reads the NEW figure, not the stale one", async () => {
    // Never resolves in this test: the optimistic patch must not depend on the server's answer.
    createStoreAccountAdjustmentActionMock.mockReturnValueOnce(new Promise(() => {}));
    renderIntegration();

    // First open: the store owes the full 380.00 (38000 minor units), before any write-off.
    await act(async () => {
      captured.openReconciliationSheet?.("PEN");
      await Promise.resolve();
    });
    expect(capturedReconciliationSheetProps.current?.openOrderDebtMinor).toBe(38000);

    // Write off 180.00 (18000 minor units) against order-1, an OPEN order.
    act(() => {
      void capturedReconciliationSheetProps.current?.onSubmit({
        reason: "no identificado",
        lines: [{ orderId: "order-1", amountMinor: 18000 }],
      });
    });

    // Re-open the sheet (the reviewer's own repro: close it, then open it again) and read the prop
    // the sheet is handed fresh on THIS render, not a value captured before the write-off.
    await act(async () => {
      captured.openReconciliationSheet?.("PEN");
      await Promise.resolve();
    });

    // 380.00 − 180.00 = 200.00 (20000 minor units), not the stale 380.00 a `router.refresh()`-only
    // path would have left on screen until the next full navigation.
    expect(capturedReconciliationSheetProps.current?.openOrderDebtMinor).toBe(20000);
  });
});
