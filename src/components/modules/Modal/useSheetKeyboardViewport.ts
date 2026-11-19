"use client";

import { useEffect, useState, type RefCallback } from "react";

const KEYBOARD_OFFSET_PROPERTY = "--sheet-keyboard-offset";
const VIEWPORT_HEIGHT_PROPERTY = "--sheet-viewport-height";
const EDITABLE_SELECTOR =
  "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, [contenteditable=true]";

/** Owns keyboard geometry without changing the drawer's natural height or the page's scroll. */
export function useSheetKeyboardViewport(isOpen: boolean): RefCallback<HTMLDivElement> {
  // The portal mounts after its parent effect, so subscribe when the actual content node arrives.
  const [content, setContent] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!content || !isOpen) return;

    const panel = content;
    const viewport = window.visualViewport;
    let frame: number | undefined;

    function resetGeometry(): void {
      panel.style.setProperty(KEYBOARD_OFFSET_PROPERTY, "0px");
      panel.style.removeProperty(VIEWPORT_HEIGHT_PROPERTY);
    }

    function updateGeometry(): void {
      frame = undefined;
      const focused = document.activeElement;
      const hasFocusedInput =
        focused instanceof HTMLElement && panel.contains(focused) && focused.matches(EDITABLE_SELECTOR);
      if (!viewport || viewport.scale !== 1 || !hasFocusedInput) {
        resetGeometry();
        return;
      }

      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      panel.style.setProperty(KEYBOARD_OFFSET_PROPERTY, `${offset}px`);
      if (offset === 0) {
        panel.style.removeProperty(VIEWPORT_HEIGHT_PROPERTY);
        return;
      }
      panel.style.setProperty(VIEWPORT_HEIGHT_PROPERTY, `${viewport.height}px`);

      const body = panel.querySelector<HTMLElement>("[data-modal-sheet-body]");
      if (!body?.contains(focused)) return;
      const fieldBounds = focused.getBoundingClientRect();
      const bodyBounds = body.getBoundingClientRect();
      // Native scrollIntoView can pan every ancestor, including the fixed iOS body. Scroll only
      // this sheet's body, after its keyboard-constrained layout has been applied.
      if (fieldBounds.bottom > bodyBounds.bottom) {
        body.scrollTop += fieldBounds.bottom - bodyBounds.bottom;
      } else if (fieldBounds.top < bodyBounds.top) {
        body.scrollTop += fieldBounds.top - bodyBounds.top;
      }
    }

    function scheduleUpdate(): void {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateGeometry);
    }

    resetGeometry();
    scheduleUpdate();
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    content.addEventListener("focusin", scheduleUpdate);
    content.addEventListener("focusout", scheduleUpdate);

    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      content.removeEventListener("focusin", scheduleUpdate);
      content.removeEventListener("focusout", scheduleUpdate);
      resetGeometry();
    };
  }, [content, isOpen]);

  return setContent;
}
