import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/contexts/ToastContext";
import type { CreateStorePaymentActionResult } from "@/app/[locale]/(app)/_actions/storePaymentActions";
import StorePaymentStateProvider from "../StorePaymentStateProvider";
import StorePaymentsSection from "../StorePaymentsSection";

const { capturedSubmitRef, createStorePaymentActionMock, deleteStorePaymentActionMock } = vi.hoisted(() => ({
  capturedSubmitRef: { current: null as ((input: unknown) => void) | null },
  createStorePaymentActionMock: vi.fn(),
  deleteStorePaymentActionMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      vars ? `${namespace}.${key}:${JSON.stringify(vars)}` : `${namespace}.${key}`;
    t.has = () => true;
    return t;
  },
}));

vi.mock("@/components/modules/StorePaymentSheet", () => ({
  useStorePaymentSheetOrders: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), orders: [], isLoading: false }),
  StorePaymentSheet: (props: { onSubmit: (input: unknown) => void }) => {
    capturedSubmitRef.current = props.onSubmit;
    return null;
  },
}));

vi.mock("@/app/[locale]/(app)/_actions/storePaymentActions", () => ({
  createStorePaymentAction: (...args: unknown[]) => createStorePaymentActionMock(...args),
  deleteStorePaymentAction: (...args: unknown[]) => deleteStorePaymentActionMock(...args),
}));

/** A pending, externally-resolvable stand-in for the server round trip, so the test can assert
    what the DOM shows *before* the promise settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderStorePayments() {
  return render(
    <ToastProvider>
      <StorePaymentStateProvider
        storeId="store-1"
        storeName="Akiba Books"
        storeDebtByCurrency={[
          { storeId: "store-1", currencyCode: "PEN", committedMinor: 5000, paidMinor: 0, debtMinor: 5000 },
        ]}
        storePayments={[]}
        storePaymentsTotalCount={0}
        locale="es"
      >
        <StorePaymentsSection locale="es" />
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
          allocationsCount: 0,
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
});
