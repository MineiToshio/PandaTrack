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
  markDoneAndAdvance: (n: number) => void;
  goBack: (n: number) => void;
  /** Report a validation result for a step. When invalid, removes the step (and any later steps) from doneSteps and adds it to erroredSteps. */
  reportValidation: (n: number, isValid: boolean) => void;
};

export const WizardAccordionContext = createContext<WizardAccordionContextValue | null>(null);

export function useWizardAccordion(): WizardAccordionContextValue {
  const value = useContext(WizardAccordionContext);
  if (!value) {
    throw new Error("WizardStep must be rendered inside <WizardAccordion>.");
  }
  return value;
}
