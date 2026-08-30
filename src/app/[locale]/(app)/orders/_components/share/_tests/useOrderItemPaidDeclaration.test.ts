import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setOrderItemPaidDeclaredActionMock, refreshMock } = vi.hoisted(() => ({
  setOrderItemPaidDeclaredActionMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("../../../_actions/orderItemActions", () => ({
  setOrderItemPaidDeclaredAction: setOrderItemPaidDeclaredActionMock,
}));

import { useOrderItemPaidDeclaration } from "../useOrderItemPaidDeclaration";

const ORDER_ID = "order-1";
const ITEM_ID = "item-1";

beforeEach(() => {
  setOrderItemPaidDeclaredActionMock.mockReset();
  refreshMock.mockReset();
});

describe("useOrderItemPaidDeclaration", () => {
  it("rolls back the optimistic mark and reports 'other' instead of leaving a stuck chip on rejection", async () => {
    // The bug: `setOrderItemPaidDeclaredAction` is a Server Action, which rejects on a transport
    // failure the same way `authClient` does. Awaited with no try/catch inside the transition, that
    // rejection re-throws during render and replaces the whole page with the (app)/error.tsx
    // boundary instead of just reverting this one chip.
    const transportError = new Error("fetch failed");
    setOrderItemPaidDeclaredActionMock.mockRejectedValue(transportError);
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useOrderItemPaidDeclaration({ orderId: ORDER_ID, itemId: ITEM_ID, initialDeclared: false, onError }),
    );

    act(() => result.current.toggle());
    expect(result.current.declared).toBe(true);

    await waitFor(() => expect(onError).toHaveBeenCalledWith("other"));
    expect(result.current.declared).toBe(false);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
