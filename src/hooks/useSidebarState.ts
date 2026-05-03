"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_SHELL_SIDEBAR_STORAGE_KEY } from "@/lib/constants";

const DEFAULT_EXPANDED = true;

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return DEFAULT_EXPANDED;
  try {
    const stored = localStorage.getItem(APP_SHELL_SIDEBAR_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
  }
  return DEFAULT_EXPANDED;
}

function writeStoredPreference(expanded: boolean) {
  try {
    localStorage.setItem(APP_SHELL_SIDEBAR_STORAGE_KEY, String(expanded));
  } catch {
    // Ignore storage errors
  }
}

export function useSidebarState() {
  const [expanded, setExpandedState] = useState(DEFAULT_EXPANDED);
  const [floatingOpen, setFloatingOpen] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount to avoid SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only hydration from localStorage
    setExpandedState(readStoredPreference());
  }, []);

  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
    writeStoredPreference(next);
  }, []);

  const toggle = useCallback(() => {
    setExpandedState((prev) => {
      const next = !prev;
      writeStoredPreference(next);
      return next;
    });
    setFloatingOpen(false);
  }, []);

  return { expanded, setExpanded, toggle, floatingOpen, setFloatingOpen } as const;
}
