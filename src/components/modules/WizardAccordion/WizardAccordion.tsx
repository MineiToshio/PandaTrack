"use client";

import { Children, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import Stepper, { type StepperStep } from "@/components/core/Stepper";
import { cn } from "@/lib/styles";
import { WizardAccordionContext, type WizardAccordionContextValue } from "./WizardContext";

export type WizardAccordionProps = {
  /** 1-indexed initial active step. Default `1`. */
  startStep?: number;
  /** Pre-marked done steps (1-indexed). Default `[]`. */
  initialDoneSteps?: number[];
  /** Notifies the parent when the active step changes. */
  onStepChange?: (n: number) => void;
  /**
   * Optional explicit step list. When provided, the accordion renders a `<Stepper>` at the top
   * and uses `steps.length` as `totalSteps` (overriding the children-count fallback).
   * Useful when steps are conditionally rendered or when label/visual concerns differ from `<WizardStep>` children.
   */
  steps?: StepperStep[];
  /** When true (default when `steps` is provided), shows the `<Stepper>` indicator at the top. */
  showStepper?: boolean;
  /** Localized name for the stepper navigation landmark. */
  stepperAriaLabel?: string;
  /** Children — list of `<WizardStep>` nodes. */
  children: ReactNode;
  /** Optional className on the wrapping list. */
  className?: string;
};

/**
 * WizardAccordion — one expanded step at a time orchestrator.
 * Implements ADR 0003 D5 (single active step) and ADR 0001 D12 OC3 (free navigation,
 * the user can jump to any step without completing the current one).
 *
 * Optionally renders a `<Stepper>` at the top when `steps` is provided.
 */
export default function WizardAccordion({
  startStep = 1,
  initialDoneSteps = [],
  onStepChange,
  steps,
  showStepper,
  stepperAriaLabel,
  children,
  className,
}: WizardAccordionProps) {
  const stepNodes = Children.toArray(children).filter((child): child is ReactElement =>
    Boolean(child && typeof child === "object" && "props" in (child as ReactElement)),
  );
  const totalSteps = steps?.length ?? stepNodes.length;
  const initialClamped = Math.min(Math.max(startStep, 1), Math.max(totalSteps, 1));
  const [activeStep, setActiveStep] = useState<number>(initialClamped);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(() => new Set(initialDoneSteps));
  const onStepChangeRef = useRef(onStepChange);
  useEffect(() => {
    onStepChangeRef.current = onStepChange;
  }, [onStepChange]);

  const activate = useCallback((n: number) => {
    setActiveStep((current) => {
      if (current === n) return current;
      onStepChangeRef.current?.(n);
      return n;
    });
  }, []);

  const markDoneAndAdvance = useCallback(
    (n: number) => {
      setDoneSteps((prev) => {
        if (prev.has(n)) return prev;
        const next = new Set(prev);
        next.add(n);
        return next;
      });
      const nextStep = Math.min(n + 1, totalSteps);
      activate(nextStep);
    },
    [activate, totalSteps],
  );

  const goBack = useCallback(
    (n: number) => {
      const target = Math.max(1, n - 1);
      activate(target);
    },
    [activate],
  );

  const contextValue = useMemo<WizardAccordionContextValue>(
    () => ({
      activeStep,
      doneSteps,
      totalSteps,
      activate,
      markDoneAndAdvance,
      goBack,
    }),
    [activeStep, doneSteps, totalSteps, activate, markDoneAndAdvance, goBack],
  );

  const shouldShowStepper = showStepper ?? Boolean(steps);
  const doneStepsArray = useMemo(() => Array.from(doneSteps), [doneSteps]);

  return (
    <WizardAccordionContext.Provider value={contextValue}>
      <div className={cn("flex flex-col gap-4 md:gap-6", className)}>
        {shouldShowStepper && steps && (
          <Stepper
            steps={steps}
            activeStep={activeStep}
            doneSteps={doneStepsArray}
            onStepClick={activate}
            ariaLabel={stepperAriaLabel}
          />
        )}
        <ol role="list" className="flex flex-col gap-4 md:gap-6">
          {stepNodes}
        </ol>
      </div>
    </WizardAccordionContext.Provider>
  );
}
