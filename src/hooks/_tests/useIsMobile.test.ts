import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "../useIsMobile";

type Listener = (event: MediaQueryListEvent) => void;

type MockMql = {
  matches: boolean;
  media: string;
  onchange: ((event: MediaQueryListEvent) => void) | null;
  addListener: (cb: Listener) => void;
  removeListener: (cb: Listener) => void;
  addEventListener: (type: string, cb: Listener) => void;
  removeEventListener: (type: string, cb: Listener) => void;
  dispatchEvent: (event: Event) => boolean;
  setMatches: (next: boolean) => void;
};

function installMatchMediaMock(initialMatches: boolean): MockMql {
  const listeners = new Set<Listener>();

  const mql: MockMql = {
    matches: initialMatches,
    media: "(max-width: 767px)",
    onchange: null,
    addListener: (cb) => {
      listeners.add(cb);
    },
    removeListener: (cb) => {
      listeners.delete(cb);
    },
    addEventListener: (_type, cb) => {
      listeners.add(cb);
    },
    removeEventListener: (_type, cb) => {
      listeners.delete(cb);
    },
    dispatchEvent: () => true,
    setMatches(next: boolean) {
      mql.matches = next;
      const event = { matches: next, media: mql.media } as MediaQueryListEvent;
      listeners.forEach((cb) => cb(event));
    },
  };

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => mql),
  });

  return mql;
}

describe("useIsMobile", () => {
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it("returns the initial matchMedia value after mount", () => {
    installMatchMediaMock(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("updates when the media query changes", () => {
    const mql = installMatchMediaMock(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.setMatches(true);
    });

    expect(result.current).toBe(true);
  });

  it("stays false when matchMedia is unavailable (SSR-safe guard)", () => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
