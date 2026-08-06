"use client";

import { useEffect, useState } from "react";

/**
 * Tailwind's `lg`, the width at which the list toolbars switch from the filter drawer to the
 * inline row. Shared so a component gating on "is the toolbar showing?" cannot drift from the
 * `lg:` class that actually decides it.
 */
export const DESKTOP_TOOLBAR_MIN_WIDTH_PX = 1024;

/**
 * Subscribes to a media query.
 *
 * `defaultValue` is what the hook returns during server render and on the first client frame,
 * before `matchMedia` has been consulted. Pick the value that reproduces the markup the server
 * emits, so hydration does not flip layout.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mql = window.matchMedia(query);
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setMatches(event.matches);
    };

    update(mql);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }

    // Safari < 14 fallback
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [query]);

  return matches;
}

/**
 * Whether the inline list toolbar (search + filter + sort + create) is on screen.
 *
 * The list pages render that toolbar under `lg:flex` and hide it below. Anything that must stand
 * in for one of its controls at narrower widths asks this rather than asking "is this mobile?":
 * the two are not complements, and treating them as such left the 768-1023px band with the
 * toolbar hidden and no replacement, so the sort control simply did not exist there.
 *
 * Defaults to `true` so the server renders the desktop arrangement, matching the `lg:` classes.
 */
export function useHasDesktopToolbar(): boolean {
  return useMediaQuery(`(min-width: ${DESKTOP_TOOLBAR_MIN_WIDTH_PX}px)`, true);
}
