import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrderCreateForm from "../OrderCreateForm";
import type { OrderStoreOption } from "../OrderStoreField";

vi.mock("next-intl", () => {
  const translate = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;
  translate.has = () => false;
  translate.rich = (key: string) => key;
  return {
    useTranslations: () => translate,
    useLocale: () => "es",
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  // Prefills the store so step 1 needs no interaction: currency derives from its country (PE → PEN)
  // and the order date defaults to today, so "Continuar" is reachable immediately.
  useSearchParams: () => new URLSearchParams("store=store-1"),
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("../DiscrepancyModal", () => ({ default: () => null }));

const STORES: OrderStoreOption[] = [{ id: "store-1", name: "Pop Dealer", countryCode: "PE" }];

const actionMock = vi.fn().mockResolvedValue({ success: false, error: "validation" });

/** Drives the real (unmocked) wizard from step 1 through step 2 into step 3, where the
    "¿Pagaste algo hoy?" block lives — it only mounts once its step becomes active
    (`WizardStep` keeps every step's body in the DOM but `hidden` until then).

    `actionsLayout="sticky-on-mobile"` renders each step's primary CTA twice (a `md:hidden`
    mobile bar plus the `hidden md:flex` desktop bar) — jsdom does not evaluate the responsive
    Tailwind classes that hide one of them, so both are "visible" to `getByRole`. Picking the
    first match is enough since either copy runs the identical click handler. */
async function clickFirst(name: string) {
  const [button] = screen.getAllByRole("button", { name });
  await userEvent.click(button!);
}

async function goToStep3() {
  render(<OrderCreateForm stores={STORES} productTypeKeys={[]} baseCurrencyCode="USD" action={actionMock} />);

  await clickFirst("stepContinue");

  await userEvent.type(screen.getByPlaceholderText("itemNamePlaceholder"), "Figura");
  await userEvent.type(screen.getByPlaceholderText("totalCostPlaceholder"), "100");
  await clickFirst("stepContinue");
}

beforeEach(() => {
  actionMock.mockClear();
});

describe("OrderCreateForm — ¿Pagaste algo hoy?", () => {
  it("starts collapsed", async () => {
    await goToStep3();

    expect(screen.getByRole("button", { name: "initialPayment.toggle" })).toHaveAttribute("aria-expanded", "false");
  });

  it("'Pagué todo' fills the amount with the current total and expands the section", async () => {
    await goToStep3();

    await userEvent.click(screen.getByRole("button", { name: "initialPayment.paidInFull" }));

    expect(screen.getByRole("button", { name: "initialPayment.toggle" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/initialPayment\.amountLabel/)).toHaveValue("100");
  });

  it("'Adelanto' expands the section for a manual partial amount", async () => {
    await goToStep3();

    await userEvent.click(screen.getByRole("button", { name: "initialPayment.advance" }));

    expect(screen.getByRole("button", { name: "initialPayment.toggle" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/initialPayment\.amountLabel/)).toHaveValue("");
  });

  it("blocks submission when the advance is more than the order total", async () => {
    await goToStep3();

    await userEvent.click(screen.getByRole("button", { name: "initialPayment.advance" }));
    await userEvent.type(screen.getByLabelText(/initialPayment\.amountLabel/), "150");
    await clickFirst("confirmCta");

    expect(screen.getByText("validation.initialPaymentExceedsTotal")).toBeInTheDocument();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("declares the advance in the submitted form data", async () => {
    await goToStep3();

    await userEvent.click(screen.getByRole("button", { name: "initialPayment.paidInFull" }));
    await clickFirst("confirmCta");

    await waitFor(() => expect(actionMock).toHaveBeenCalled());
    const submittedFormData = actionMock.mock.calls[0]![1] as FormData;
    expect(submittedFormData.get("initialPaymentAmount")).toBe("100");
    expect(submittedFormData.get("initialPaymentDate")).toBeTruthy();
  });

  it("omits the advance fields entirely when the collector never touches the section", async () => {
    await goToStep3();

    await clickFirst("confirmCta");

    await waitFor(() => expect(actionMock).toHaveBeenCalled());
    const submittedFormData = actionMock.mock.calls[0]![1] as FormData;
    expect(submittedFormData.get("initialPaymentAmount")).toBeNull();
  });
});
