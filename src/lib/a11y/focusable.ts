/** Selectors for elements that participate in keyboard focus order inside a dialog or panel. */
export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Avoid scrolling the page when focus moves inside a fixed overlay (browser default scroll-into-view). */
export const FOCUS_OPTIONS_NO_SCROLL: FocusOptions = { preventScroll: true };

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("aria-hidden"),
  );
}
