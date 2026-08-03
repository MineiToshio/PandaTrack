import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import ImageIntakeCurrencyGate from "../ImageIntakeCurrencyGate";

describe("ImageIntakeCurrencyGate", () => {
  it("explains the block and offers the settings route that unblocks it", () => {
    render(<ImageIntakeCurrencyGate locale="en" />);

    expect(screen.getByText("title")).toBeTruthy();
    expect(screen.getByText("description")).toBeTruthy();
    expect(screen.getByRole("link", { name: "cta" }).getAttribute("href")).toBe("/en/settings");
  });

  it("keeps the manual path reachable, because it needs no currency to be assumed", () => {
    render(<ImageIntakeCurrencyGate locale="es" />);

    expect(screen.getByRole("link", { name: "secondary" }).getAttribute("href")).toBe("/es/orders/new");
  });

  it("offers no way to start an extraction from this state", () => {
    render(<ImageIntakeCurrencyGate locale="en" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
