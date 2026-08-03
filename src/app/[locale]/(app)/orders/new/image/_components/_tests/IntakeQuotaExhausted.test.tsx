import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import IntakeQuotaExhausted from "../IntakeQuotaExhausted";

vi.mock("next-intl", () => ({
  // Namespace-aware so the two namespaces this screen reads (`upload`, `quota`) stay distinguishable.
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const short = `${namespace.split(".").pop()}.${key}`;
    return values ? `${short}:${JSON.stringify(values)}` : short;
  },
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString().slice(0, 10),
  }),
}));

describe("IntakeQuotaExhausted", () => {
  it("states what ran out, when it renews, and offers the always-free route", () => {
    render(<IntakeQuotaExhausted limit={20} renewalAtIso="2026-08-01T00:00:00.000Z" onManualClick={vi.fn()} />);

    expect(screen.getByText('quota.exhaustedTitle:{"limit":20}')).toBeInTheDocument();
    expect(screen.getByText('quota.exhausted:{"renewalDate":"2026-08-01"}')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "quota.exhaustedCta" })).toBeInTheDocument();
  });

  it("routes to the manual method, which is never blocked by the bag", async () => {
    const onManualClick = vi.fn();
    render(<IntakeQuotaExhausted limit={20} renewalAtIso="2026-08-01T00:00:00.000Z" onManualClick={onManualClick} />);

    await userEvent.click(screen.getByRole("button", { name: "quota.exhaustedCta" }));

    expect(onManualClick).toHaveBeenCalledTimes(1);
  });
});
