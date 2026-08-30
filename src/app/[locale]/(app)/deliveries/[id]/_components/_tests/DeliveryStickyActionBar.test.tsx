import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeliveryStickyActionBar from "../DeliveryStickyActionBar";

// Predictable next-intl mock — labels resolve to `deliveries.<key>` so assertions are stable.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `deliveries.${key}`,
}));

function renderBar(status: "DELIVERED" | "CANCELLED", isReopening: boolean) {
  return render(
    <DeliveryStickyActionBar
      deliveryId="d1"
      status={status}
      editHref="/en/deliveries/d1/edit"
      isReopening={isReopening}
      onMarkDelivered={vi.fn()}
      onReopen={vi.fn()}
      onOpenActionsSheet={vi.fn()}
    />,
  );
}

describe("DeliveryStickyActionBar — reopen loading state (DELIVERED, full-width button)", () => {
  it("shows the idle label with no aria-busy when not reopening", () => {
    renderBar("DELIVERED", false);
    const reopenButton = screen.getByRole("button", { name: "deliveries.detail.stickyBar.reopen" });
    expect(reopenButton).not.toHaveAttribute("aria-busy", "true");
  });

  it("announces aria-busy and a translated loading label instead of a literal ellipsis", () => {
    renderBar("DELIVERED", true);
    const reopenButton = screen.getByRole("button", { name: "deliveries.detail.stickyBar.reopening" });
    expect(reopenButton).toHaveAttribute("aria-busy", "true");
    expect(reopenButton).toBeDisabled();
    expect(screen.queryByText("…")).toBeNull();
  });
});

describe("DeliveryStickyActionBar — reopen loading state (CANCELLED, overflow + reopen)", () => {
  it("announces aria-busy and a translated loading label instead of a literal ellipsis", () => {
    renderBar("CANCELLED", true);
    const reopenButton = screen.getByRole("button", { name: "deliveries.detail.stickyBar.reopening" });
    expect(reopenButton).toHaveAttribute("aria-busy", "true");
    expect(reopenButton).toBeDisabled();
    expect(screen.queryByText("…")).toBeNull();
  });
});
