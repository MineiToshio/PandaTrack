import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStorePaymentSheetOrders } from "../useStorePaymentSheetOrders";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";

const getOrders = vi.hoisted(() => vi.fn());

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("@/app/[locale]/(app)/_actions/storePaymentActions", () => ({
  getStorePaymentSheetOrdersAction: getOrders,
}));

function makeOrder(orderId: string): AssignableOrder {
  return {
    orderId,
    humanReadableId: `ORD-${orderId}`,
    orderDate: new Date("2026-01-05T00:00:00.000Z"),
    currencyCode: "PEN",
    isActive: true,
    totalCost: 10000,
    allocatedAmountMinor: 0,
    assignableMinor: 10000,
    restCeilingMinor: 0,
    items: [],
  };
}

/** A promise plus the handles to settle it later, for driving race and failure orders explicitly. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useStorePaymentSheetOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reuses the cached payload for the same store while the stamp holds", async () => {
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    act(() => result.current.close());
    act(() => result.current.open("store-1", "store_detail"));

    expect(getOrders).toHaveBeenCalledTimes(1);
    expect(result.current.orders).toHaveLength(1);
  });

  it("refetches once a mutation has invalidated the payload, on the next open", async () => {
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    act(() => result.current.close());
    act(() => result.current.invalidate());
    act(() => result.current.open("store-1", "store_detail"));

    await waitFor(() => expect(getOrders).toHaveBeenCalledTimes(2));
  });

  it("refetches IN PLACE when the invalidation lands with the sheet still open", async () => {
    // The refusal path: the sheet stays open, so bumping the stamp alone would leave it offering
    // ceilings it has just declared stale, and the collector fixing a line against a balance that
    // no longer exists only to be refused again.
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1"), makeOrder("order-2")] });
    act(() => result.current.invalidate());

    await waitFor(() => expect(getOrders).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.orders).toHaveLength(2));
  });

  it("keeps the current orders readable while the in-place refetch flies (BLOQUEANTE 1)", async () => {
    // The sheet is holding a hand-typed draft whose lines only exist as long as their rows do.
    // Emptying the list for the length of a round trip takes the draft off the screen with it.
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    const slow = deferred<{ ok: true; orders: AssignableOrder[] }>();
    getOrders.mockReturnValueOnce(slow.promise);
    act(() => result.current.invalidate());
    await waitFor(() => expect(getOrders).toHaveBeenCalledTimes(2));

    // Mid-flight: the previous payload is still there, and it is not a loading state either — a
    // skeleton would take the rows away just as thoroughly as an empty list.
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);

    await act(async () => {
      slow.resolve({ ok: true, orders: [makeOrder("order-1"), makeOrder("order-2")] });
      await slow.promise;
    });
    expect(result.current.orders).toHaveLength(2);
  });

  it("falls back to the payload it was refreshing when that refetch never lands", async () => {
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    getOrders.mockRejectedValueOnce(new Error("network down"));
    act(() => result.current.invalidate());
    await waitFor(() => expect(getOrders).toHaveBeenCalledTimes(2));

    // A failed refresh is not the same as a failed load: there are orders on screen, and a draft
    // may be typed into them. The stamp still moved, so the next open refetches from scratch.
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    expect(result.current.hasError).toBe(false);

    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1"), makeOrder("order-2")] });
    act(() => result.current.close());
    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(2));
  });

  it("marks the kept payload as stale, and lets a retry refresh it without emptying it (MENOR 4)", async () => {
    // Falling back silently leaves last known ceilings on screen presented as current, with no way
    // to ask again that does not cost the draft: the only other refresh is closing the sheet.
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    expect(result.current.isStale).toBe(false);

    getOrders.mockRejectedValueOnce(new Error("network down"));
    act(() => result.current.invalidate());
    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.hasError).toBe(false);

    const slow = deferred<{ ok: true; orders: AssignableOrder[] }>();
    getOrders.mockReturnValueOnce(slow.promise);
    act(() => result.current.retry());

    // Mid-retry the rows are still there — this is the retry a collector reaches for WITH a draft
    // typed into them, so a skeleton would cost exactly what it is meant to save.
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      slow.resolve({ ok: true, orders: [makeOrder("order-1"), makeOrder("order-2")] });
      await slow.promise;
    });
    expect(result.current.orders).toHaveLength(2);
    expect(result.current.isStale).toBe(false);
  });

  it("spends no round trip when the sheet closes in the same turn as the invalidation (NIT 9)", async () => {
    // The accepted-payment path: the coordinator invalidates and the sheet closes a microtask
    // later, so a refetch fired on the spot would be for a list nobody is left reading.
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    act(() => {
      result.current.invalidate();
      result.current.close();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getOrders).toHaveBeenCalledTimes(1);
  });

  it("does not refetch on an invalidation while the sheet is closed", async () => {
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    act(() => result.current.close());

    act(() => result.current.invalidate());

    expect(getOrders).toHaveBeenCalledTimes(1);
  });

  it("refetches when a different store is opened", async () => {
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "orders_store_view"));
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    act(() => result.current.open("store-2", "orders_store_view"));

    await waitFor(() => expect(getOrders).toHaveBeenCalledTimes(2));
  });

  it("surfaces a rejected fetch as an error state, not an endless spinner", async () => {
    getOrders.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));

    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.orders).toEqual([]);
  });

  it("surfaces an unauthorized answer as an error, never as an empty store", async () => {
    getOrders.mockResolvedValue({ ok: false, error: "unauthorized" });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));

    await waitFor(() => expect(result.current.hasError).toBe(true));
  });

  it("retries the same store on demand", async () => {
    getOrders.mockRejectedValueOnce(new Error("network down"));
    getOrders.mockResolvedValue({ ok: true, orders: [makeOrder("order-1")] });
    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "store_detail"));
    await waitFor(() => expect(result.current.hasError).toBe(true));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
  });

  it("drops a stale response so one store's orders never land under another's name", async () => {
    const slowStoreOne = deferred<{ ok: true; orders: AssignableOrder[] }>();
    const fastStoreTwo = deferred<{ ok: true; orders: AssignableOrder[] }>();
    getOrders.mockReturnValueOnce(slowStoreOne.promise).mockReturnValueOnce(fastStoreTwo.promise);

    const { result } = renderHook(() => useStorePaymentSheetOrders());

    act(() => result.current.open("store-1", "orders_store_view"));
    act(() => result.current.open("store-2", "orders_store_view"));

    await act(async () => {
      fastStoreTwo.resolve({ ok: true, orders: [makeOrder("order-of-store-2")] });
      slowStoreOne.resolve({ ok: true, orders: [makeOrder("order-of-store-1")] });
      await slowStoreOne.promise;
    });

    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    expect(result.current.orders[0].orderId).toBe("order-of-store-2");
  });
});
