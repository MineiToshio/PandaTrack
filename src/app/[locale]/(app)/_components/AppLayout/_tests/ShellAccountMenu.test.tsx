import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShellAccountMenu from "../ShellAccountMenu";
import type { AppShellUserIdentity } from "../types";

const { signOutClientMock, routerPushMock, routerRefreshMock, posthogCaptureMock } = vi.hoisted(() => ({
  signOutClientMock: vi.fn(),
  routerPushMock: vi.fn(),
  routerRefreshMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/dashboard",
  useRouter: () => ({ push: routerPushMock, refresh: routerRefreshMock }),
}));

vi.mock("posthog-js", () => ({ default: { capture: posthogCaptureMock } }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    typeof values?.username === "string" ? `${key}:${values.username}` : key,
}));

vi.mock("@/lib/auth/authSignOut", () => ({
  signOutClient: signOutClientMock,
}));

const USER: AppShellUserIdentity = { username: "collector", name: "Collector", image: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShellAccountMenu sign-out", () => {
  it("does not refresh the route before signOutClient's onSuccess actually fires", async () => {
    // The bug: `router.refresh()` used to run synchronously right after `void signOutClient(...)`,
    // firing before the sign-out request ever resolves. A refresh issued while the session cookie is
    // still live re-renders server data as if the collector were still signed in.
    let capturedOnSuccess: (() => void) | undefined;
    signOutClientMock.mockImplementation(({ onSuccess }: { onSuccess?: () => void }) => {
      capturedOnSuccess = onSuccess;
      return new Promise(() => {
        // Deliberately never resolves within the test: it stands in for a still-in-flight request,
        // so any refresh() call recorded here can only be the premature, pre-fix one.
      });
    });

    render(<ShellAccountMenu locale="en" user={USER} signOutLabel="Sign out" surface="desktop" />);

    fireEvent.click(screen.getByRole("button", { name: /account.triggerLabel/ }));
    fireEvent.click(screen.getByText("Sign out"));

    expect(signOutClientMock).toHaveBeenCalledTimes(1);
    expect(routerRefreshMock).not.toHaveBeenCalled();

    capturedOnSuccess?.();

    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    expect(routerPushMock).toHaveBeenCalledWith("/en/sign-in");
  });
});
