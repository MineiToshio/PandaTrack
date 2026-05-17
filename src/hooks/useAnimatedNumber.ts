"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Interpolates from the previous value to `value` over `durationMs`, returning the in-flight
 * number on each animation frame. Used for "counter rolling" effects on the order detail hero
 * when the saldo pendiente or payment percentage changes after an addPayment/deletePayment
 * optimistic update.
 *
 *  - First mount: returns `value` directly (no animation on initial paint).
 *  - Subsequent changes: eases from previous → new via cubic ease-out over the duration.
 *  - Honors `prefers-reduced-motion` by snapping to the new value immediately.
 *
 * Caller decides how to round/format the returned number (currency, percentage, etc).
 */
export function useAnimatedNumber(value: number, durationMs = 600): number {
  const [display, setDisplay] = useState(value);
  const prevValueRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevValueRef.current === value) return;

    // Respect users who opted out of motion — collapse the animation to a single frame so
    // the snap goes through requestAnimationFrame (not a synchronous setState in the effect
    // body, which React flags as a cascading render).
    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const effectiveDuration = reducedMotion ? 0 : durationMs;

    const startValue = prevValueRef.current;
    const delta = value - startValue;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = effectiveDuration === 0 ? 1 : Math.min(elapsed / effectiveDuration, 1);
      // Cubic ease-out — fast start, gentle stop. Reads as "the number is settling".
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startValue + delta * eased;
      setDisplay(current);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        prevValueRef.current = value;
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return display;
}
