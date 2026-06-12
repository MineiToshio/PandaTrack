import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PasswordRules, { evaluatePasswordRules } from "../PasswordRules";
import { scorePasswordStrength } from "../PasswordStrengthMeter";

describe("evaluatePasswordRules", () => {
  it("returns the single min-length rule and marks it satisfied at 8 characters", () => {
    const rules = evaluatePasswordRules("12345678", { minLength: "Mínimo 8 caracteres" });
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("minLength");
    expect(rules[0].satisfied).toBe(true);
  });

  it("marks the min-length rule unsatisfied below 8 characters", () => {
    const rules = evaluatePasswordRules("abc", { minLength: "Mínimo 8 caracteres" });
    expect(rules[0].satisfied).toBe(false);
  });
});

describe("scorePasswordStrength", () => {
  it("returns 0 for empty input", () => {
    expect(scorePasswordStrength("")).toBe(0);
  });

  it("returns 1 for inputs below the minimum length", () => {
    expect(scorePasswordStrength("abc")).toBe(1);
  });

  it("increases with length and character variety", () => {
    expect(scorePasswordStrength("password")).toBe(1);
    expect(scorePasswordStrength("Password1")).toBeGreaterThanOrEqual(2);
    expect(scorePasswordStrength("Password1!verylong")).toBe(4);
  });
});

describe("<PasswordRules>", () => {
  it("renders the rule label", () => {
    render(
      <PasswordRules rules={[{ id: "minLength", label: "Mínimo 8 caracteres", satisfied: true }]} pristine={false} />,
    );
    expect(screen.getByText("Mínimo 8 caracteres")).toBeTruthy();
  });
});
