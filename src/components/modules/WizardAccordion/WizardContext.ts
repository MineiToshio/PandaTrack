"use client";

import { createContext, useContext } from "react";

export type WizardLayout = "wizard" | "all-open";

export type WizardAccordionContextValue = {
  activeStep: number;
  doneSteps: ReadonlySet<number>;
  erroredSteps: ReadonlySet<number>;
  totalSteps: number;
  /**
   * Layout mode:
   *  - `wizard` (default): one step body expanded at a time, header buttons advance/collapse.
   *  - `all-open`: every step body always rendered; header is a static anchor (no toggle);
   *    primary/secondary actions are not rendered (the parent owns the submit footer).
   */
  layout: WizardLayout;
  activate: (n: number) => void;
  /** Returns true if `activate(n)` would actually move the active step (i.e. it's not gated off). */
  canActivate: (n: number) => boolean;
  markDoneAndAdvance: (n: number) => void;
  goBack: (n: number) => void;
  /** Report a validation result for a step. When invalid, removes the step (and any later steps) from doneSteps and adds it to erroredSteps. */
  reportValidation: (n: number, isValid: boolean) => void;
  /**
   * Briefly pulse the active step's sticky mobile primary button — used as a
   * UX hint when the user taps a future locked step (gated mode) so they know
   * the forward path is the sticky CTA at the bottom of the viewport.
   */
  pulseStickyHint: () => void;
  /**
   * Internal: the active step calls this in a `useEffect` to register its
   * `triggerStickyPulse` function. `null` clears the registration.
   */
  registerStickyPulse: (fn: (() => void) | null) => void;
};

export const WizardAccordionContext = createContext<WizardAccordionContextValue | null>(null);

export function useWizardAccordion(): WizardAccordionContextValue {
  const value = useContext(WizardAccordionContext);
  if (!value) {
    throw new Error("WizardStep must be rendered inside <WizardAccordion>.");
  }
  return value;
}
