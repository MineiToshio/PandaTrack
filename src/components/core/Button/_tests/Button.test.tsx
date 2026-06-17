import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Button from "@/components/core/Button/Button";

describe("Button — element rendering", () => {
  it("renders a <button> element by default", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeTruthy();
  });

  it("defaults type to 'button' to prevent accidental form submit", () => {
    render(<Button>Submit</Button>);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("renders an <a> element when as='a'", () => {
    render(
      <Button as="a" href="/orders">
        Orders
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Orders" });
    expect(link.getAttribute("href")).toBe("/orders");
  });
});

describe("Button — disabled", () => {
  it("sets native disabled on <button>", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("disabled");
  });

  it("sets aria-disabled and removes href on <a> when disabled", () => {
    const { container } = render(
      <Button as="a" href="/orders" disabled>
        Disabled link
      </Button>,
    );
    // <a> without href loses the link role per ARIA spec — query directly
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("aria-disabled")).toBe("true");
    expect(anchor?.getAttribute("href")).toBeNull();
    expect(anchor?.getAttribute("tabindex")).toBe("-1");
  });
});

describe("Button — loading state", () => {
  it("sets aria-busy when loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("shows spinner when loading", () => {
    render(<Button loading>Save</Button>);
    // Loader2 renders as an SVG; assert the button contains an animated element
    const btn = screen.getByRole("button");
    const spinner = btn.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("does not show spinner when not loading", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn.querySelector(".animate-spin")).toBeNull();
  });
});

describe("Button — PostHog tracking", () => {
  it("adds data-ph-event attribute when posthogEvent is provided", () => {
    render(<Button posthogEvent="cta_clicked">CTA</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-ph-event", "cta_clicked");
  });

  it("does not add data-ph-event when posthogEvent is absent", () => {
    render(<Button>CTA</Button>);
    expect(screen.getByRole("button").hasAttribute("data-ph-event")).toBe(false);
  });
});

describe("Button — leading and trailing icons", () => {
  it("renders leadingIcon content", () => {
    render(<Button leadingIcon={<span data-testid="lead" />}>Icon button</Button>);
    expect(screen.getByTestId("lead")).toBeTruthy();
  });

  it("renders trailingIcon content", () => {
    render(<Button trailingIcon={<span data-testid="trail" />}>Icon button</Button>);
    expect(screen.getByTestId("trail")).toBeTruthy();
  });

  it("replaces leadingIcon with spinner when loading", () => {
    render(
      <Button loading leadingIcon={<span data-testid="lead" />}>
        Save
      </Button>,
    );
    // Original icon replaced by spinner; spinner present, original icon absent
    expect(screen.queryByTestId("lead")).toBeNull();
    expect(screen.getByRole("button").querySelector(".animate-spin")).toBeTruthy();
  });
});
