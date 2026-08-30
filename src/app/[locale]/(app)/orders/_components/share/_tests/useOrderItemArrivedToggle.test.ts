import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setOrderItemArrivedActionMock } = vi.hoisted(() => ({
  setOrderItemArrivedActionMock: vi.fn(),
}));

vi.mock("../../../_actions/orderItemActions", () => ({
  setOrderItemArrivedAction: setOrderItemArrivedActionMock,
}));

import { useOrderItemArrivedToggle } from "../useOrderItemArrivedToggle";

const ORDER_ID = "order-1";
const ITEM_ID = "item-1";

beforeEach(() => {
  setOrderItemArrivedActionMock.mockReset();
});

describe("useOrderItemArrivedToggle", () => {
  it("rolls back the optimistic state instead of leaving it stuck when the action call rejects", async () => {
    // The bug: `setOrderItemArrivedAction` is a Server Action, which rejects on a transport failure
    // the same way `authClient` does. Awaited with no try/catch inside the transition, that
    // rejection re-throws during render and replaces the whole page with the (app)/error.tsx
    // boundary instead of reverting this one toggle.
    const transportError = new Error("fetch failed");
    setOrderItemArrivedActionMock.mockRejectedValue(transportError);
    const onStateChange = vi.fn();

    const { result } = renderHook(() =>
      useOrderItemArrivedToggle({
        orderId: ORDER_ID,
        itemId: ITEM_ID,
        initialState: "open",
        lockedByDelivery: false,
        lockedByCancellation: false,
        onStateChange,
      }),
    );

    act(() => result.current.toggle());
    expect(result.current.state).toBe("arrived_at_store");

    await waitFor(() => expect(result.current.state).toBe("open"));
    // Silent revert by design (mirrors useOrderItemPaidDeclaration's own JSDoc): no error is
    // surfaced beyond putting the state back, so onStateChange only ever sees the two real
    // transitions (optimistic, then rollback), never a third "error" signal.
    expect(onStateChange).toHaveBeenCalledTimes(2);
    expect(onStateChange).toHaveBeenNthCalledWith(1, "arrived_at_store");
    expect(onStateChange).toHaveBeenNthCalledWith(2, "open");
  });
});
