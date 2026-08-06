"use client";

import { useMediaQuery } from "./useMediaQuery";

const MOBILE_QUERY = "(max-width: 767px)";

/**
 * Returns `true` when the viewport matches the mobile breakpoint (<768px).
 * SSR-safe: returns `false` during server render and hydrates to the real
 * value after mount. Consumers that need to switch between layouts based on
 * viewport (e.g. adaptive Modal → bottom sheet) should treat the initial
 * `false` as desktop-default and rely on the post-mount update.
 *
 * Note this is NOT the complement of "the list toolbar is showing" — that switches at `lg`
 * (1024px). Use `useHasDesktopToolbar` when standing in for a toolbar control.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
