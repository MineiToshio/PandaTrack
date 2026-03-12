import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarState } from "../useSidebarState";
import { APP_SHELL_SIDEBAR_STORAGE_KEY } from "@/lib/constants";

const storage: Record<string, string> = {};

describe("useSidebarState", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
    delete storage[APP_SHELL_SIDEBAR_STORAGE_KEY];
  });

  it("returns expanded true by default when storage is empty", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded).toBe(true);
  });

  it("returns expanded false when storage has collapsed value", () => {
    storage[APP_SHELL_SIDEBAR_STORAGE_KEY] = "false";
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded).toBe(false);
  });

  it("toggle flips expanded and persists to storage", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.expanded).toBe(false);
    expect(storage[APP_SHELL_SIDEBAR_STORAGE_KEY]).toBe("false");

    act(() => {
      result.current.toggle();
    });
    expect(result.current.expanded).toBe(true);
    expect(storage[APP_SHELL_SIDEBAR_STORAGE_KEY]).toBe("true");
  });

  it("setExpanded updates state and persists to storage", () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.setExpanded(false);
    });
    expect(result.current.expanded).toBe(false);
    expect(storage[APP_SHELL_SIDEBAR_STORAGE_KEY]).toBe("false");

    act(() => {
      result.current.setExpanded(true);
    });
    expect(result.current.expanded).toBe(true);
    expect(storage[APP_SHELL_SIDEBAR_STORAGE_KEY]).toBe("true");
  });
});
