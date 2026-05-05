"use client";

import {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
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
  /** Notifies the parent when the set of done steps changes. */
  onDoneStepsChange?: (steps: number[]) => void;
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
  /**
   * When true, blocks navigation to steps beyond `max(doneSteps) + 1`. Default `false`
   * (free navigation, ADR 0001 D12 OC3).
   */
  gated?: boolean;
  /** When true, scrolls the next step into view after advancing. Default `false`. */
  scrollOnAdvance?: boolean;
  /** Children — list of `<WizardStep>` nodes. */
  children: ReactNode;
  /** Optional className on the wrapping list. */
  className?: string;
};

export type WizardAccordionHandle = {
  /** Activate a specific step. Respects `gated` if enabled. */
  activate: (n: number) => void;
};

/**
 * WizardAccordion — one expanded step at a time orchestrator.
 * Implements ADR 0003 D5 (single active step). Free navigation by default
 * (ADR 0001 D12 OC3); set `gated` to enforce sequential progression.
 *
 * Optionally renders a `<Stepper>` at the top when `steps` is provided.
 * Expose an imperative `activate(n)` via ref for external steppers.
 */
const WizardAccordion = forwardRef<WizardAccordionHandle, WizardAccordionProps>(function WizardAccordion(
  {
    startStep = 1,
    initialDoneSteps = [],
    onStepChange,
    onDoneStepsChange,
    steps,
    showStepper,
    stepperAriaLabel,
    gated = false,
    scrollOnAdvance = false,
    children,
    className,
  },
  ref,
) {
  const stepNodes = Children.toArray(children).filter((child): child is ReactElement =>
    Boolean(child && typeof child === "object" && "props" in (child as ReactElement)),
  );
  const totalSteps = steps?.length ?? stepNodes.length;
  const initialClamped = Math.min(Math.max(startStep, 1), Math.max(totalSteps, 1));
  const [activeStep, setActiveStep] = useState<number>(initialClamped);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(() => new Set(initialDoneSteps));

  const onStepChangeRef = useRef(onStepChange);
  const onDoneStepsChangeRef = useRef(onDoneStepsChange);
  const doneStepsRef = useRef(doneSteps);
  const activeStepRef = useRef(activeStep);
  const isFirstStepRender = useRef(true);
  const isFirstDoneRender = useRef(true);
  useEffect(() => {
    onStepChangeRef.current = onStepChange;
  }, [onStepChange]);
  useEffect(() => {
    onDoneStepsChangeRef.current = onDoneStepsChange;
  }, [onDoneStepsChange]);
  useEffect(() => {
    doneStepsRef.current = doneSteps;
    if (isFirstDoneRender.current) {
      isFirstDoneRender.current = false;
      return;
    }
    onDoneStepsChangeRef.current?.(Array.from(doneSteps));
  }, [doneSteps]);
  useEffect(() => {
    activeStepRef.current = activeStep;
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false;
      return;
    }
    onStepChangeRef.current?.(activeStep);
  }, [activeStep]);

  const computeMaxAllowed = useCallback(() => {
    const done = doneStepsRef.current;
    if (done.size === 0) return 1;
    let maxDone = 0;
    done.forEach((s) => {
      if (s > maxDone) maxDone = s;
    });
    return Math.min(maxDone + 1, totalSteps);
  }, [totalSteps]);

  const activate = useCallback(
    (n: number) => {
      if (gated && n > computeMaxAllowed()) return;
      if (activeStepRef.current === n) return;
      setActiveStep(n);
    },
    [gated, computeMaxAllowed],
  );

  const scrollStepIntoView = useCallback((n: number) => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-wizard-step="${n}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const markDoneAndAdvance = useCallback(
    (n: number) => {
      // Update the ref synchronously so any subsequent gate check sees the new max-done.
      const nextDone = new Set(doneStepsRef.current);
      nextDone.add(n);
      doneStepsRef.current = nextDone;
      setDoneSteps(nextDone);
      const nextStep = Math.min(n + 1, totalSteps);
      if (activeStepRef.current !== nextStep) setActiveStep(nextStep);
      if (scrollOnAdvance) scrollStepIntoView(nextStep);
    },
    [totalSteps, scrollOnAdvance, scrollStepIntoView],
  );

  const goBack = useCallback(
    (n: number) => {
      const target = Math.max(1, n - 1);
      activate(target);
      if (scrollOnAdvance) scrollStepIntoView(target);
    },
    [activate, scrollOnAdvance, scrollStepIntoView],
  );

  useImperativeHandle(ref, () => ({ activate }), [activate]);

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
});

export default WizardAccordion;
