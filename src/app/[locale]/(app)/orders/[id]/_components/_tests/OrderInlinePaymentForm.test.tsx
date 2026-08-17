import { render, screen, fireEvent } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import OrderInlinePaymentForm, { type OrderInlinePaymentSubmission } from "../OrderInlinePaymentForm";

/**
 * The translation mock reproduces the REAL catalog strings for the keys whose interpolated shape is
 * what a test is asserting on ("Todo · {amount}", "{pct}%", "Registrar {amount}"). A key-only mock
 * cannot tell the two percentage chips apart, and the sibling `i18n-placeholder-parity-guard` is
 * what keeps these shapes honest against `orders.json`.
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    switch (key) {
      case "detail.payments.dateBeforeOrder":
        return "Payment cannot be before the order date";
      case "detail.payments.quickPickAll":
        return `Todo · ${values?.amount}`;
      case "detail.payments.quickPickPercent":
        return `${values?.pct}%`;
      case "detail.payments.submitPaymentAmount":
        return `Registrar ${values?.amount}`;
      case "detail.payments.dateChange":
        return "Cambiar";
      default:
        return key;
    }
  },
}));

const CHANGE_DATE = "Cambiar";
const SUBMIT_EMPTY = "detail.payments.submitPayment";

type SubmitHandler = (submission: OrderInlinePaymentSubmission) => Promise<{ ok: boolean }>;

const noopSubmit: SubmitHandler = async () => ({ ok: true });

function renderForm(
  overrides: Partial<React.ComponentProps<typeof OrderInlinePaymentForm>> = {},
): ReturnType<typeof render> {
  return render(
    <OrderInlinePaymentForm
      currencyCode="USD"
      remainingAmount={10000}
      orderDate={new Date("2020-06-12T00:00:00.000Z")}
      locale="en"
      onCancel={() => {}}
      onSubmit={noopSubmit}
      onSubmitted={() => {}}
      {...overrides}
    />,
  );
}

/** Unfolds the date disclosure and hands back the field behind it. */
function expandDate(): HTMLInputElement {
  fireEvent.click(screen.getByRole("button", { name: "detail.payments.dateChangeAria" }));
  return screen.getByLabelText("detail.payments.dateLabel") as HTMLInputElement;
}

function amountField(): HTMLInputElement {
  return screen.getByLabelText("detail.payments.amountLabel") as HTMLInputElement;
}

/**
 * Runs under a negative-offset timezone (America/New_York) to reproduce the domain-date
 * off-by-one: `orderDate` is persisted at midnight UTC, so local getters on it yield the
 * PREVIOUS calendar day in the Americas. The minimum-allowed payment date must pin to the
 * order's UTC calendar day regardless of the viewer's timezone.
 */
describe("OrderInlinePaymentForm payment-date boundary (negative-offset timezone)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  const errorText = "Payment cannot be before the order date";

  it("flags a payment dated the day before the order's UTC calendar day", () => {
    renderForm();
    const dateInput = expandDate();
    // The buggy local-getter boundary resolved to 2020-06-11, so this date slipped through.
    fireEvent.change(dateInput, { target: { value: "2020-06-11" } });
    expect(screen.getByText(errorText)).toBeTruthy();
  });

  it("accepts a payment dated on the order's UTC calendar day", () => {
    renderForm();
    const dateInput = expandDate();
    fireEvent.change(dateInput, { target: { value: "2020-06-12" } });
    expect(screen.queryByText(errorText)).toBeNull();
  });

  // #19 — preserved regression.
  it("submits the picked day at UTC midnight, not the viewer's local midnight", async () => {
    // The regression this file's component caused: the picked day was submitted as a LOCAL-midnight
    // `Date`, and a `Date` crosses the Server Action boundary as its exact instant. From Lima that
    // stored 05:00Z; from this test's America/New_York it would be 04:00Z (05:00Z on EST). Either
    // way the row sits off the UTC midnight every other domain date uses, and the store payment it
    // creates is the row the collection was found dirty on.
    const onSubmit = vi.fn<SubmitHandler>(async () => ({ ok: true }));
    renderForm({ onSubmit });
    const dateInput = expandDate();

    fireEvent.change(dateInput, { target: { value: "2020-06-15" } });
    fireEvent.change(amountField(), { target: { value: "25.00" } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0].paymentDate;
    expect(submitted.toISOString()).toBe("2020-06-15T00:00:00.000Z");
  });
});

// #11
describe("OrderInlinePaymentForm quick-picks", () => {
  it("offers Todo, 50% and 20%, and writes the balance, half of it and a fifth of it", () => {
    // "Todo" leads because 536 of the collector's 626 payments covered the whole balance. The
    // percentage chips carry the PERCENTAGE, not the amount: three amounts do not fit at 320px and
    // the percentage is the intention ("the store asked for 20%").
    renderForm({ remainingAmount: 41000 });

    const all = screen.getByRole("button", { name: "detail.payments.quickPickAllAria" });
    expect(all).toHaveTextContent("Todo · $410.00");

    fireEvent.click(all);
    expect(amountField().value).toBe("410.00");

    const [half, fifth] = screen.getAllByRole("button", { name: "detail.payments.quickPickPercentAria" });
    expect(half).toHaveTextContent("50%");
    expect(fifth).toHaveTextContent("20%");

    fireEvent.click(half);
    expect(amountField().value).toBe("205.00");

    fireEvent.click(fifth);
    expect(amountField().value).toBe("82.00");
  });

  it("rounds a percentage to the currency's own smallest amount and marks the chip pressed", () => {
    // An odd balance: 50% of 333 minor units is 166.5, which is not a representable amount.
    renderForm({ remainingAmount: 333 });

    const [half] = screen.getAllByRole("button", { name: "detail.payments.quickPickPercentAria" });
    fireEvent.click(half);

    expect(amountField().value).toBe("1.67");
    expect(half).toHaveAttribute("aria-pressed", "true");

    // Typing by hand is the collector overriding the chip, so the chip stops claiming the field.
    fireEvent.change(amountField(), { target: { value: "3.00" } });
    expect(half).toHaveAttribute("aria-pressed", "false");
  });
});

describe("OrderInlinePaymentForm initial amount", () => {
  it("opens holding the amount its caller named, chip pressed and submit live", () => {
    // The caller is the contradiction notice, whose own label reads "Registrar {amount}". A CTA that
    // names a figure and lands on an empty field with a dead submit is a promise the panel breaks.
    renderForm({ remainingAmount: 41000, initialAmountMinor: 41000 });

    expect(amountField().value).toBe("410.00");
    // The prefill IS the "Todo" chip's value, so the chip says so instead of sitting unpressed
    // beside a field it describes.
    expect(screen.getByRole("button", { name: "detail.payments.quickPickAllAria" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Registrar $410.00" })).toBeEnabled();
  });

  it("opens empty when nothing on the way in named an amount", () => {
    renderForm({ remainingAmount: 41000 });

    expect(amountField().value).toBe("");
    expect(screen.getByRole("button", { name: SUBMIT_EMPTY })).toBeDisabled();
  });
});

// #12
describe("OrderInlinePaymentForm initial focus", () => {
  it("does NOT focus the amount field when autoFocus is off (the mobile sheet)", () => {
    // On a phone the focus raises the keyboard over the quick-picks, which are the one-tap path.
    renderForm({ autoFocus: false });

    expect(document.activeElement).not.toBe(amountField());
  });

  it("focuses the amount field when autoFocus is on (the desktop panel)", () => {
    renderForm({ autoFocus: true });

    expect(document.activeElement).toBe(amountField());
  });
});

// #13, #14, #15
describe("OrderInlinePaymentForm date disclosure", () => {
  it("keeps the date field out of the DOM entirely while it still says today", () => {
    // Folded, not hidden: a field that is already correct should not occupy the visual path, and a
    // hidden-but-present input is still a tab stop.
    renderForm();

    expect(screen.queryByLabelText("detail.payments.dateLabel")).toBeNull();
    expect(screen.getByText(CHANGE_DATE)).toBeTruthy();
  });

  it("unfolds the field on Cambiar and hands it the focus", () => {
    renderForm();
    const dateInput = expandDate();

    expect(dateInput).toBeTruthy();
    expect(document.activeElement).toBe(dateInput);
  });

  it("stays unfolded once the collector has touched it, even back on today's date", () => {
    // Re-folding a field the collector just used would hide their own edit, and folding it the
    // instant they set it back to today would make the control flicker under their hand.
    renderForm();
    const dateInput = expandDate();
    const todayValue = dateInput.value;

    fireEvent.change(dateInput, { target: { value: "2020-06-20" } });
    fireEvent.change(screen.getByLabelText("detail.payments.dateLabel"), { target: { value: todayValue } });

    expect(screen.getByLabelText("detail.payments.dateLabel")).toBeTruthy();
    expect(screen.queryByText(CHANGE_DATE)).toBeNull();
  });

  it("unfolds itself and takes the focus when the date the form starts with is refused", () => {
    // Reachable without a single click: nothing stops an order from carrying a future `orderDate`
    // (`orderDateSchema` is a bare domain date), and today's default is then before it. A refusal
    // the collector cannot even see the field for is a dead end.
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const futureOrderDate = new Date(
      Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 0, 0, 0, 0),
    );

    renderForm({ orderDate: futureOrderDate });

    const dateInput = screen.getByLabelText("detail.payments.dateLabel");
    expect(dateInput).toBeTruthy();
    expect(document.activeElement).toBe(dateInput);
    expect(screen.getByText("Payment cannot be before the order date")).toBeTruthy();
  });
});

// #16
describe("OrderInlinePaymentForm submit label", () => {
  it("names the outcome once there is an amount, and the action while there is not", () => {
    renderForm({ remainingAmount: 41000 });

    expect(screen.getByRole("button", { name: SUBMIT_EMPTY })).toBeTruthy();

    fireEvent.change(amountField(), { target: { value: "410.00" } });

    expect(screen.getByRole("button", { name: "Registrar $410.00" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: SUBMIT_EMPTY })).toBeNull();
  });
});

// #17, #18
describe("OrderInlinePaymentForm has no coverage axis at all", () => {
  it("renders no coverage control of any kind", () => {
    // The block asked "¿Qué productos cubre este pago?" 40px from an amount field and then had to
    // deny what its own position promised ("No reparte el monto"). It wrote 0 marks in the whole
    // history. Marking a product paid is a claim about a product and it lives on the product's row.
    const { container } = renderForm();

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(container.querySelector("fieldset")).toBeNull();
  });

  /**
   * The submission carries money and how it is APPORTIONED, never who it declares covered.
   *
   * The breakdown added `allocations` (amounts naming products) and two fields about the split
   * itself; none of them is the coverage axis, which stays on the product's own row. With no
   * products handed in there is no panel, so the allocation list is empty and the shape is exactly
   * what it was before, plus the split's own metadata.
   */
  it("submits money and how it is split, and never a coverage declaration", () => {
    const onSubmit = vi.fn<SubmitHandler>(async () => ({ ok: true }));
    renderForm({ onSubmit });

    fireEvent.change(amountField(), { target: { value: "40.00" } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submission = onSubmit.mock.calls[0][0];
    expect(Object.keys(submission).sort()).toEqual([
      "allocations",
      "amount",
      "awaitsVerdict",
      "paymentDate",
      "splitMode",
    ]);
    expect(submission.amount).toBe(4000);
    expect(submission.allocations).toEqual([]);
    expect(submission.splitMode).toBe("none");
  });
});
