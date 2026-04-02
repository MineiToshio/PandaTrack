"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FOCUS_OPTIONS_NO_SCROLL, getFocusableElements } from "./focusable";

export type UseFocusScopeOptions = {
  /** When true, trap Tab, focus first focusable on open, and close on Escape. */
  active: boolean;
  /** Root element that contains the focusable UI (excluding aria-hidden backdrops). */
  rootRef: RefObject<HTMLElement | null>;
  /** Called when the user presses Escape while the scope is active. */
  onClose: () => void;
  /** Element to restore focus to when `active` becomes false. Falls back to the previously focused element. */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Focus trap, Escape-to-close, and focus restoration for modal overlays and drawers.
 */
export function useFocusScope({ active, rootRef, onClose, returnFocusRef }: UseFocusScopeOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const root = rootRef.current;
      if (!root) return;

      const focusableElements = getFocusableElements(root);
      if (focusableElements.length === 0) {
        event.preventDefault();
        root.focus(FOCUS_OPTIONS_NO_SCROLL);
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus(FOCUS_OPTIONS_NO_SCROLL);
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, rootRef]);

  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;

    const returnFocusTarget = returnFocusRef?.current ?? null;
    const previousActiveElement = document.activeElement ?? null;

    const firstFocusable = getFocusableElements(root)[0];
    if (firstFocusable) {
      firstFocusable.focus(FOCUS_OPTIONS_NO_SCROLL);
    } else {
      root.focus(FOCUS_OPTIONS_NO_SCROLL);
    }

    return () => {
      const node = (returnFocusRef != null ? returnFocusTarget : previousActiveElement) as HTMLElement | null;
      if (node && typeof node.focus === "function") {
        node.focus(FOCUS_OPTIONS_NO_SCROLL);
      }
    };
  }, [active, rootRef, returnFocusRef]);
}
