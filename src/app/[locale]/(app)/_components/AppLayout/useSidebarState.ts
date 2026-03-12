"use client";

import { useCallback, useState } from "react";
import { APP_SHELL_SIDEBAR_STORAGE_KEY } from "@/lib/constants";

const STORAGE_VALUE_EXPANDED = "true";
const STORAGE_VALUE_COLLAPSED = "false";

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(APP_SHELL_SIDEBAR_STORAGE_KEY);
    if (stored === STORAGE_VALUE_EXPANDED) return true;
    if (stored === STORAGE_VALUE_COLLAPSED) return false;
  } catch {
    // Ignore storage errors
  }
  return true;
}

function writeStoredPreference(expanded: boolean) {
  try {
    localStorage.setItem(APP_SHELL_SIDEBAR_STORAGE_KEY, expanded ? STORAGE_VALUE_EXPANDED : STORAGE_VALUE_COLLAPSED);
  } catch {
    // Ignore storage errors
  }
}

export function useSidebarState() {
  const [expanded, setExpandedState] = useState(() => (typeof window === "undefined" ? true : readStoredPreference()));

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
