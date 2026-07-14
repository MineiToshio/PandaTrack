import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { syncUserTimezoneActionMock, captureExceptionMock } = vi.hoisted(() => ({
  syncUserTimezoneActionMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/app/[locale]/(app)/_actions/syncUserTimezone", () => ({
  syncUserTimezoneAction: syncUserTimezoneActionMock,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

function stubBrowserTimeZone(timeZone: string | undefined) {
  vi.stubGlobal("Intl", {
    DateTimeFormat: vi.fn(() => ({ resolvedOptions: () => ({ timeZone }) })),
  });
}

/** Re-imported per test so the module-level "already synced" guard starts clean each time. */
async function importTimezoneCapture() {
  vi.resetModules();
  const timezoneCaptureModule = await import("../TimezoneCapture");
  return timezoneCaptureModule.default;
}

describe("TimezoneCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncUserTimezoneActionMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures the browser timezone when the collector has none stored", async () => {
    stubBrowserTimeZone("America/Lima");
    const TimezoneCapture = await importTimezoneCapture();

    render(<TimezoneCapture storedTimezone={null} />);

    await waitFor(() => expect(syncUserTimezoneActionMock).toHaveBeenCalledTimes(1));
    expect(syncUserTimezoneActionMock).toHaveBeenCalledWith("America/Lima");
  });

  it("syncs the stored timezone when the browser reports a different one", async () => {
    stubBrowserTimeZone("Europe/Madrid");
    const TimezoneCapture = await importTimezoneCapture();

    render(<TimezoneCapture storedTimezone="America/Lima" />);

    await waitFor(() => expect(syncUserTimezoneActionMock).toHaveBeenCalledWith("Europe/Madrid"));
  });

  it("does nothing when the stored timezone already matches the browser (steady state)", async () => {
    stubBrowserTimeZone("America/Lima");
    const TimezoneCapture = await importTimezoneCapture();

    const { rerender } = render(<TimezoneCapture storedTimezone="America/Lima" />);
    rerender(<TimezoneCapture storedTimezone="America/Lima" />);

    expect(syncUserTimezoneActionMock).not.toHaveBeenCalled();
  });

  it("writes the same timezone only once within a page session", async () => {
    stubBrowserTimeZone("Asia/Tokyo");
    const TimezoneCapture = await importTimezoneCapture();

    const { unmount } = render(<TimezoneCapture storedTimezone={null} />);
    await waitFor(() => expect(syncUserTimezoneActionMock).toHaveBeenCalledTimes(1));
    unmount();

    render(<TimezoneCapture storedTimezone={null} />);

    await waitFor(() => expect(syncUserTimezoneActionMock).toHaveBeenCalledTimes(1));
  });

  it("does nothing when the browser cannot resolve a timezone", async () => {
    stubBrowserTimeZone(undefined);
    const TimezoneCapture = await importTimezoneCapture();

    render(<TimezoneCapture storedTimezone={null} />);

    expect(syncUserTimezoneActionMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("never throws when the action rejects: the failure is captured once and swallowed", async () => {
    const actionError = new Error("network unreachable");
    stubBrowserTimeZone("America/Lima");
    syncUserTimezoneActionMock.mockRejectedValueOnce(actionError);
    const TimezoneCapture = await importTimezoneCapture();

    expect(() => render(<TimezoneCapture storedTimezone={null} />)).not.toThrow();

    await waitFor(() => expect(captureExceptionMock).toHaveBeenCalledTimes(1));
    expect(captureExceptionMock).toHaveBeenCalledWith(actionError, {
      extra: { action: "syncUserTimezone" },
    });
  });
});
