"use client";

import { createContext, useContext } from "react";

export type WizardAccordionContextValue = {
  activeStep: number;
  doneSteps: ReadonlySet<number>;
  erroredSteps: ReadonlySet<number>;
  totalSteps: number;
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
