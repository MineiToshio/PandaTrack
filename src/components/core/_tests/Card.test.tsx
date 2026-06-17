import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Card from "@/components/core/Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>hello</Card>);
    expect(screen.getByText("hello")).toBeTruthy();
  });

  it("uses div by default", () => {
    const { container } = render(<Card>x</Card>);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("supports `as` prop for semantic element", () => {
    const { container } = render(<Card as="section">x</Card>);
    expect(container.querySelector("section")).toBeTruthy();
  });

  it("accepts variant=outlined without crashing", () => {
    render(<Card variant="outlined">y</Card>);
    expect(screen.getByText("y")).toBeTruthy();
  });

  it("accepts variant=subtle without crashing", () => {
    render(<Card variant="subtle">z</Card>);
    expect(screen.getByText("z")).toBeTruthy();
  });
});
