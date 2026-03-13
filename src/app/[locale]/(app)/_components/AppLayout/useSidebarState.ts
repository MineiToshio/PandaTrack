"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_SHELL_SIDEBAR_STORAGE_KEY } from "@/lib/constants";

const STORAGE_VALUE_EXPANDED = "true";
const STORAGE_VALUE_COLLAPSED = "false";

const DEFAULT_EXPANDED = true;

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return DEFAULT_EXPANDED;
  try {
    const stored = localStorage.getItem(APP_SHELL_SIDEBAR_STORAGE_KEY);
    if (stored === STORAGE_VALUE_EXPANDED) return true;
    if (stored === STORAGE_VALUE_COLLAPSED) return false;
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_EXPANDED;
}

function writeStoredPreference(expanded: boolean) {
  try {
    localStorage.setItem(APP_SHELL_SIDEBAR_STORAGE_KEY, expanded ? STORAGE_VALUE_EXPANDED : STORAGE_VALUE_COLLAPSED);
  } catch {
    // Ignore storage errors
  }
}

export function useSidebarState() {
  const [expanded, setExpandedState] = useState(DEFAULT_EXPANDED);

  useEffect(() => {
    // Hydrate from localStorage after mount to avoid SSR mismatch and to respect user preference.
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
  }, []);

  return { expanded, setExpanded, toggle } as const;
}
