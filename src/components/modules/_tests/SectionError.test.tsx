import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: "Couldn't load",
      retry: "Try again",
      "offline.title": "No connection",
    };
    return map[key] ?? key;
  },
}));

// Imported after the mocks so the component picks them up.
import SectionError from "../SectionError";

describe("SectionError", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("renders an alert region with the destructive default title, message and retry", () => {
    render(<SectionError message="We couldn't load the payments." />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Couldn't load")).toBeTruthy();
    expect(screen.getByText("We couldn't load the payments.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });

  it("uses the offline title for the warning tone", () => {
    render(<SectionError tone="warning" message="You appear to be offline." />);
    expect(screen.getByText("No connection")).toBeTruthy();
  });

  it("calls onRetry when provided and does not call router.refresh", () => {
    const onRetry = vi.fn();
    render(<SectionError message="x" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to router.refresh when no onRetry is given", () => {
    render(<SectionError message="x" />);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
