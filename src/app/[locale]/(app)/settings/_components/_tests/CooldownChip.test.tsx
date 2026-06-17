import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CooldownChip from "../CooldownChip";

describe("CooldownChip", () => {
  it("renders the localized label when provided", () => {
    render(<CooldownChip label="Próximo cambio en 5 días." />);
    expect(screen.getByText("Próximo cambio en 5 días.")).toBeTruthy();
  });

  it("renders the emphasis fragment inside a <strong>", () => {
    const { container } = render(<CooldownChip label="Próximo cambio:" emphasis="22 may 2026" />);
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("22 may 2026");
  });

  it("renders nothing when label is empty", () => {
    const { container } = render(<CooldownChip label="" />);
    expect(container.firstChild).toBeNull();
  });
});
