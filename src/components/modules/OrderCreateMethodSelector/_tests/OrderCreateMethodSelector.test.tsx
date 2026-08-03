import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderCreateMethodSelector from "../OrderCreateMethodSelector";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/components/modules/Modal/Modal", () => ({
  default: ({
    isOpen,
    title,
    subtitle,
    children,
  }: {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={`${title} ${subtitle ?? ""}`}>
        {children}
      </div>
    ) : null,
}));

describe("OrderCreateMethodSelector", () => {
  it("renders exactly two cards inline: image first, manual second", () => {
    render(<OrderCreateMethodSelector presentation="inline" locale="en" />);

    expect(screen.getByText("fromImage.title")).toBeInTheDocument();
    expect(screen.getByText("manual.title")).toBeInTheDocument();
    expect(screen.getByText("fromImage.badge")).toBeInTheDocument();
    expect(screen.getByText("fromImage.description")).toBeInTheDocument();
    expect(screen.getByText("manual.description")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/en/orders/new/image");
    expect(links[1]).toHaveAttribute("href", "/en/orders/new");
  });

  it("hides the remaining-photo line when there is no balance to show", () => {
    render(<OrderCreateMethodSelector presentation="inline" locale="en" />);

    // The only note the image card renders without a counter is the "no store needed" line.
    expect(screen.getByText("fromImage.noStoreNeeded")).toBeInTheDocument();
    expect(screen.queryByText(/photosRemaining/)).not.toBeInTheDocument();
  });

  it("hides the remaining-photo line for an uncapped collector", () => {
    render(
      <OrderCreateMethodSelector
        presentation="inline"
        locale="en"
        photoCounter={{ remaining: null, limit: null, renewalAtIso: "2026-08-01T00:00:00.000Z" }}
      />,
    );

    expect(screen.queryByText(/photosRemaining/)).not.toBeInTheDocument();
  });

  it("shows the remaining-photo line with the real balance", () => {
    render(
      <OrderCreateMethodSelector
        presentation="inline"
        locale="en"
        photoCounter={{ remaining: 17, limit: 20, renewalAtIso: "2026-08-01T00:00:00.000Z" }}
      />,
    );

    expect(screen.getByText('fromImage.photosRemaining:{"count":17}')).toBeInTheDocument();
  });

  it("disables the image card with a zero counter when the bag is empty, and never the manual card", () => {
    render(
      <OrderCreateMethodSelector
        presentation="inline"
        locale="en"
        photoCounter={{ remaining: 0, limit: 20, renewalAtIso: "2026-08-01T00:00:00.000Z" }}
      />,
    );

    expect(screen.getByText('fromImage.photosRemaining:{"count":0}')).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/en/orders/new");
  });

  it("does not render the overlay dialog when the surface is empty (inline presentation)", () => {
    render(<OrderCreateMethodSelector presentation="inline" locale="en" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the two cards inside the overlay dialog when open", () => {
    const onClose = vi.fn();
    render(<OrderCreateMethodSelector presentation="overlay" locale="en" isOpen onClose={onClose} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("fromImage.title")).toBeInTheDocument();
    expect(screen.getByText("manual.title")).toBeInTheDocument();
  });

  it("renders nothing for the overlay presentation when closed", () => {
    render(<OrderCreateMethodSelector presentation="overlay" locale="en" isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
