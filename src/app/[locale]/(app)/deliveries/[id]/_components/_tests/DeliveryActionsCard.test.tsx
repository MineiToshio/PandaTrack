import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeliveryActionsCard from "../DeliveryActionsCard";

// Predictable next-intl mock — labels resolve to `deliveries.<key>` so assertions are stable.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `deliveries.${key}`,
}));

function renderCard(isReopening: boolean) {
  return render(
    <DeliveryActionsCard
      status="DELIVERED"
      editHref="/en/deliveries/d1/edit"
      isReopening={isReopening}
      onMarkDelivered={vi.fn()}
      onReopen={vi.fn()}
      onCancel={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe("DeliveryActionsCard — reopen loading state", () => {
  it("does not mark the reopen button busy when idle", () => {
    renderCard(false);
    const reopenButton = screen.getByRole("button", { name: "deliveries.detail.actions.reopen" });
    expect(reopenButton).not.toHaveAttribute("aria-busy", "true");
    expect(reopenButton).not.toBeDisabled();
  });

  it("announces aria-busy and disables the button while reopening, keeping its accessible name", () => {
    renderCard(true);
    const reopenButton = screen.getByRole("button", { name: "deliveries.detail.actions.reopen" });
    expect(reopenButton).toHaveAttribute("aria-busy", "true");
    expect(reopenButton).toBeDisabled();
  });
});
