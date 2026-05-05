import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Stepper from "@/components/core/Stepper";

const STEPS = [
  { n: 1, label: "Type" },
  { n: 2, label: "Identity" },
  { n: 3, label: "Categories" },
];

describe("Stepper", () => {
  it("renders one nav landmark with all steps", () => {
    render(<Stepper steps={STEPS} activeStep={2} ariaLabel="Form steps" />);
    const nav = screen.getByRole("navigation", { name: "Form steps" });
    expect(nav).toBeTruthy();
    expect(nav.querySelectorAll("li").length).toBe(3);
  });

  it("marks active step with aria-current=step when not clickable", () => {
    render(<Stepper steps={STEPS} activeStep={2} ariaLabel="Form steps" />);
    const nav = screen.getByRole("navigation", { name: "Form steps" });
    const current = nav.querySelector('[aria-current="step"]');
    expect(current).toBeTruthy();
  });

  it("invokes onStepClick when a bullet is pressed", () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={STEPS} activeStep={1} onStepClick={onStepClick} ariaLabel="Form steps" />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onStepClick).toHaveBeenCalledWith(2);
  });

  it("renders done state checkmark when step is in doneSteps and not active", () => {
    const { container } = render(<Stepper steps={STEPS} activeStep={3} doneSteps={[1]} ariaLabel="Form steps" />);
    // Check first step is done; it should not show its number text
    const items = container.querySelectorAll("li");
    expect(items[0].textContent).not.toContain("1");
  });
});
