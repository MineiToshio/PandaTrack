import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_SESSION_KEEPALIVE_MIN_INTERVAL_MS } from "@/lib/constants";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { getSession: getSessionMock },
}));

/** Re-imported per test so the module-level throttle starts clean each time. */
async function importSessionKeepAlive() {
  vi.resetModules();
  const sessionKeepAliveModule = await import("../SessionKeepAlive");
  return sessionKeepAliveModule.default;
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("SessionKeepAlive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getSessionMock.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("refreshes the session through the auth route on mount", async () => {
    const SessionKeepAlive = await importSessionKeepAlive();

    render(<SessionKeepAlive />);

    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes again when the app returns to the foreground after the throttle window", async () => {
    const SessionKeepAlive = await importSessionKeepAlive();
    render(<SessionKeepAlive />);

    setVisibility("hidden");
    vi.advanceTimersByTime(AUTH_SESSION_KEEPALIVE_MIN_INTERVAL_MS);
    setVisibility("visible");

    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });

  it("does not refresh on every focus inside the throttle window", async () => {
    const SessionKeepAlive = await importSessionKeepAlive();
    render(<SessionKeepAlive />);

    vi.advanceTimersByTime(AUTH_SESSION_KEEPALIVE_MIN_INTERVAL_MS - 1);
    setVisibility("visible");

    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when the app goes to the background", async () => {
    const SessionKeepAlive = await importSessionKeepAlive();
    render(<SessionKeepAlive />);

    vi.advanceTimersByTime(AUTH_SESSION_KEEPALIVE_MIN_INTERVAL_MS);
    setVisibility("hidden");

    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("swallows a failed refresh so the shell is never broken by it", async () => {
    getSessionMock.mockRejectedValue(new Error("offline"));
    const SessionKeepAlive = await importSessionKeepAlive();

    expect(() => render(<SessionKeepAlive />)).not.toThrow();
    await vi.runAllTimersAsync();
  });
});
