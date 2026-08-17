import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import MarkDeliveredModal from "../MarkDeliveredModal";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
}));

type MockModalAction = { label: string; onClick: () => void };

// Same shell stub the other modal tests use: exercise this component's own markup and actions
// without the adaptive dialog/sheet machinery.
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: ({
    isOpen,
    children,
    primaryAction,
  }: {
    isOpen: boolean;
    children: ReactNode;
    primaryAction: MockModalAction;
  }) =>
    isOpen ? (
      <div>
        {children}
        <button type="button" onClick={primaryAction.onClick}>
          confirm
        </button>
      </div>
    ) : null,
}));

/**
 * Runs under a negative-offset timezone, where the bug is visible at all. The picker's value is a
 * LOCAL-midnight `Date`, and a `Date` crosses the Server Action boundary as its exact instant, so
 * submitting it raw stored the arrival at 05:00Z from Lima (04:00Z here on EDT) instead of the UTC
 * midnight every other domain date sits on. Two `delivery.receivedDate` rows were written that way.
 */
describe("MarkDeliveredModal received-date normalization (negative-offset timezone)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("submits the picked day at UTC midnight", () => {
    const onSubmit = vi.fn();
    render(
      <MarkDeliveredModal
        isOpen
        onClose={() => {}}
        humanReadableId="ENT-001"
        storeName="Pop Dealer Store"
        productCount={2}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/detail\.markDeliveredModal\.dateLabel/), {
      target: { value: "2026-02-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((onSubmit.mock.calls[0][0] as Date).toISOString()).toBe("2026-02-10T00:00:00.000Z");
  });
});
