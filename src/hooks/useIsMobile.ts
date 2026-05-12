"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/**
 * Returns `true` when the viewport matches the mobile breakpoint (<768px).
 * SSR-safe: returns `false` during server render and hydrates to the real
 * value after mount. Consumers that need to switch between layouts based on
 * viewport (e.g. adaptive Modal → bottom sheet) should treat the initial
 * `false` as desktop-default and rely on the post-mount update.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mql = window.matchMedia(MOBILE_QUERY);
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    update(mql);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }

    // Safari < 14 fallback
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  return isMobile;
}
