import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateOrderFab from "../CreateOrderFab";

let mockPathname = "/en/orders";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/components/modules/OrderCreateMethodSelector/OrderCreateMethodSelector", () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="method-selector" /> : null),
}));

describe("CreateOrderFab", () => {
  it("renders the single-action pill on the Orders list", () => {
    mockPathname = "/en/orders";
    render(<CreateOrderFab locale="en" />);
    const button = screen.getByRole("button", { name: "fabLabel" });
    expect(button).toBeInTheDocument();
  });

  it("renders on the Dashboard", () => {
    mockPathname = "/en/dashboard";
    render(<CreateOrderFab locale="en" />);
    expect(screen.getByRole("button", { name: "fabLabel" })).toBeInTheDocument();
  });

  it("does not render on order detail", () => {
    mockPathname = "/en/orders/ord-1";
    render(<CreateOrderFab locale="en" />);
    expect(screen.queryByRole("button", { name: "fabLabel" })).not.toBeInTheDocument();
  });

  it("does not render inside the manual creation wizard", () => {
    mockPathname = "/en/orders/new";
    render(<CreateOrderFab locale="en" />);
    expect(screen.queryByRole("button", { name: "fabLabel" })).not.toBeInTheDocument();
  });

  it("does not render on Stores or Deliveries", () => {
    mockPathname = "/en/stores";
    render(<CreateOrderFab locale="en" />);
    expect(screen.queryByRole("button", { name: "fabLabel" })).not.toBeInTheDocument();
  });

  it("opens the method selector overlay on click", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    mockPathname = "/en/orders";
    render(<CreateOrderFab locale="en" />);

    expect(screen.queryByTestId("method-selector")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "fabLabel" }));
    expect(screen.getByTestId("method-selector")).toBeInTheDocument();
  });
});
