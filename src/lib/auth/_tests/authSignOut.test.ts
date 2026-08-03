import { beforeEach, describe, expect, it, vi } from "vitest";

type SignOutOptions = { fetchOptions?: { onSuccess?: () => void } };

const { signOutMock, clearShareStashMock, callOrder } = vi.hoisted(() => {
  const order: string[] = [];
  return {
    callOrder: order,
    signOutMock: vi.fn(async (_options: { fetchOptions?: { onSuccess?: () => void } }) => {
      order.push("signOut");
    }),
    clearShareStashMock: vi.fn(async () => {
      order.push("clearShareStash");
    }),
  };
});

vi.mock("../auth-client", () => ({ authClient: { signOut: signOutMock } }));
vi.mock("@/lib/pwa/shareStash", () => ({ clearShareStash: clearShareStashMock }));

import { signOutClient } from "../authSignOut";

describe("signOutClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
  });

  it("drops the share stash before ending the session, so shared screenshots cannot outlive their owner", async () => {
    await signOutClient();

    expect(clearShareStashMock).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["clearShareStash", "signOut"]);
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
