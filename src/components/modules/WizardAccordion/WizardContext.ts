"use client";

import { createContext, useContext } from "react";

export type WizardAccordionContextValue = {
  activeStep: number;
  doneSteps: ReadonlySet<number>;
  totalSteps: number;
  activate: (n: number) => void;
  markDoneAndAdvance: (n: number) => void;
  goBack: (n: number) => void;
};

export const WizardAccordionContext = createContext<WizardAccordionContextValue | null>(null);

export function useWizardAccordion(): WizardAccordionContextValue {
  const value = useContext(WizardAccordionContext);
  if (!value) {
    throw new Error("WizardStep must be rendered inside <WizardAccordion>.");
  }
  return value;
}
