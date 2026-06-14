import { render, screen, fireEvent } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import OrderInlinePaymentForm from "../OrderInlinePaymentForm";

/**
 * Runs under a negative-offset timezone (America/New_York) to reproduce the domain-date
 * off-by-one: `orderDate` is persisted at midnight UTC, so local getters on it yield the
 * PREVIOUS calendar day in the Americas. The minimum-allowed payment date must pin to the
 * order's UTC calendar day regardless of the viewer's timezone.
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "detail.payments.dateBeforeOrder": "Payment cannot be before the order date",
    };
    return map[key] ?? key;
  },
}));

describe("OrderInlinePaymentForm payment-date boundary (negative-offset timezone)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  // Order placed on the UTC calendar day 2020-06-12 (safely in the past so payments on/after
  // it are never rejected as future-dated). Stored as the midnight-UTC instant.
  const orderDate = new Date("2020-06-12T00:00:00.000Z");

  function renderForm() {
    render(
      <OrderInlinePaymentForm
        currencyCode="USD"
        remainingAmount={10000}
        orderDate={orderDate}
        locale="en"
        onCancel={() => {}}
        onSubmit={async () => ({ ok: true })}
      />,
    );
    return screen.getByLabelText("detail.payments.dateLabel") as HTMLInputElement;
  }

  const errorText = "Payment cannot be before the order date";

  it("flags a payment dated the day before the order's UTC calendar day", () => {
    const dateInput = renderForm();
    // The buggy local-getter boundary resolved to 2020-06-11, so this date slipped through.
    fireEvent.change(dateInput, { target: { value: "2020-06-11" } });
    expect(screen.getByText(errorText)).toBeTruthy();
  });

  it("accepts a payment dated on the order's UTC calendar day", () => {
    const dateInput = renderForm();
    fireEvent.change(dateInput, { target: { value: "2020-06-12" } });
    expect(screen.queryByText(errorText)).toBeNull();
  });
});
