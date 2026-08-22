import { beforeEach, describe, expect, it, vi } from "vitest";

type SignOutOptions = { fetchOptions?: { onSuccess?: () => void } };

const { signOutMock, clearShareStashMock, clearAllPendingSettlementsMock, callOrder } = vi.hoisted(() => {
  const order: string[] = [];
  return {
    callOrder: order,
    signOutMock: vi.fn(async (_options: { fetchOptions?: { onSuccess?: () => void } }) => {
      order.push("signOut");
    }),
    clearShareStashMock: vi.fn(async () => {
      order.push("clearShareStash");
    }),
    clearAllPendingSettlementsMock: vi.fn(() => {
      order.push("clearAllPendingSettlements");
    }),
  };
});

vi.mock("../auth-client", () => ({ authClient: { signOut: signOutMock } }));
vi.mock("@/lib/pwa/shareStash", () => ({ clearShareStash: clearShareStashMock }));
vi.mock("@/lib/deliveries/pendingSettlementStore", () => ({
  clearAllPendingSettlements: clearAllPendingSettlementsMock,
}));

import { signOutClient } from "../authSignOut";

describe("signOutClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
  });

  it("drops the share stash before ending the session, so shared screenshots cannot outlive their owner", async () => {
    await signOutClient();

    expect(clearShareStashMock).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["clearShareStash", "clearAllPendingSettlements", "signOut"]);
  });

  // MAJOR F9, 2026-08-20 review: `pandatrack:pendingSettlement:*` is per-delivery, keyed by
  // `deliveryId` with no account scoping baked into the key itself, exactly the same shape of leak
  // the share stash exists to prevent. Before the fix this test fails: sign-out never cleared it.
  it("clears every pending-settlement entry before ending the session, like the share stash", async () => {
    await signOutClient();

    expect(clearAllPendingSettlementsMock).toHaveBeenCalledTimes(1);
    expect(callOrder.indexOf("clearAllPendingSettlements")).toBeLessThan(callOrder.indexOf("signOut"));
  });

  it("forwards the caller's redirect to the auth client's success callback", async () => {
    const onSuccess = vi.fn();
    signOutMock.mockImplementationOnce(async (options: SignOutOptions) => {
      options.fetchOptions?.onSuccess?.();
    });

    await signOutClient({ onSuccess });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
