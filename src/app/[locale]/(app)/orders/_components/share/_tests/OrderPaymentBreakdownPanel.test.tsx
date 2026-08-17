import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The breakdown panel, exercised through the form that owns its state, against the REAL copy.
 *
 * The catalog is loaded instead of stubbed because half of what these tests measure is the FIGURES
 * the panel prints, and a key-only mock erases every one of them: "S/ 59,90" and "detail.….price"
 * are indistinguishable to the assertion that matters (I-1b counts money inside the list). The
 * sibling `i18n-placeholder-parity-guard` is what keeps the placeholder names honest.
 */
vi.mock("next-intl", async () => {
  const catalog = (await import("../../../../../../../i18n/locales/es/orders.json")).default as Record<string, unknown>;
  const resolve = (path: string): unknown =>
    path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], catalog);

  return {
    useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      const text = resolve(full.replace(/^orders\.?/, ""));
      if (typeof text !== "string") return full;
      return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        values && name in values ? String(values[name]) : match,
      );
    },
  };
});

import OrderInlinePaymentForm, {
  type OrderInlinePaymentSubmission,
} from "../../../[id]/_components/OrderInlinePaymentForm";
import type { BreakdownItem } from "@/lib/orders/orderPaymentBreakdown";

/** ORD-20260305-01: total 244,90, balance 45,00, pool 199,90, two priced products. */
const TWO_PRICED: BreakdownItem[] = [
  { itemId: "a", name: "Kingdom 23", basePagableMinor: 5990, allocatedMinor: 0 },
  { itemId: "b", name: "Berserk deluxe", basePagableMinor: 18500, allocatedMinor: 0 },
];

/** ORD-20260509-03: total 330,00, balance 280,00, six products and not one price on record. */
const SIX_UNPRICED: BreakdownItem[] = Array.from({ length: 6 }, (_, index) => ({
  itemId: `u${index}`,
  name: `Tomo ${index + 1}`,
  basePagableMinor: null,
  allocatedMinor: 0,
}));

const THREE_UNPRICED = SIX_UNPRICED.slice(0, 3);

type FormOverrides = Partial<React.ComponentProps<typeof OrderInlinePaymentForm>>;

function renderForm(overrides: FormOverrides = {}) {
  return render(
    <OrderInlinePaymentForm
      currencyCode="PEN"
      remainingAmount={4500}
      orderTotalCostMinor={24490}
      undetailedPaidMinor={19990}
      items={TWO_PRICED}
      orderDate={new Date("2026-03-05T00:00:00.000Z")}
      locale="es"
      autoFocus={false}
      onCancel={() => {}}
      onSubmit={async () => ({ ok: true })}
      onSubmitted={() => {}}
      {...overrides}
    />,
  );
}

function amountField(): HTMLInputElement {
  return screen.getByLabelText("Monto") as HTMLInputElement;
}

/** Types the payment amount and unfolds the breakdown, which is folded by default, always. */
function openBreakdown(amount: string) {
  fireEvent.change(amountField(), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: /Desglosar entre productos/ }));
}

/** The disclosure, found by its STATE rather than its label, which the draft rewrites. */
function breakdownTrigger(): HTMLElement {
  return screen.getByRole("button", { expanded: true });
}

/** Folds the panel back up, with whatever the collector has already put in it. */
function foldBreakdown() {
  fireEvent.click(breakdownTrigger());
}

function isPanelOpen(): boolean {
  return screen.queryByRole("list", { name: "Productos de este pedido" }) !== null;
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));
}

function productList(): HTMLElement {
  return screen.getByRole("list", { name: "Productos de este pedido" });
}

function rowFor(name: string): HTMLElement {
  return within(productList()).getByText(name).closest("li") as HTMLElement;
}

function fieldFor(name: string): HTMLInputElement {
  return within(rowFor(name)).getByRole("textbox") as HTMLInputElement;
}

function checkboxFor(name: string): HTMLInputElement {
  return within(rowFor(name)).getByRole("checkbox") as HTMLInputElement;
}

function fillButtonFor(name: string): HTMLElement {
  return within(rowFor(name)).getByRole("button", { name: /^Asignar / });
}

/** Every amount printed as TEXT somewhere inside the given node. */
function moneyTextsIn(node: HTMLElement): string[] {
  return (node.textContent ?? "").match(/S\/\s[\d,]+\.\d{2}/g) ?? [];
}

/** The line the foot's second sentence prints: the ORDER's balance after this payment. */
function orderAfterLine(): string {
  return screen.getByText(/Este pedido (quedará debiendo|queda saldado)/).textContent ?? "";
}

describe("order payment breakdown · the foot's second line (I-3)", () => {
  /**
   * T5. Ticking, unticking, re-splitting, typing and clearing all move the FIRST foot line and none
   * of them may move the second, because the split does not decide how much of the payment reaches
   * the order: all of it does, whatever the breakdown says.
   */
  it("never moves the order's own balance, whatever the draft does", () => {
    renderForm({ remainingAmount: 4500 });
    openBreakdown("20.00");

    const before = orderAfterLine();

    fireEvent.click(checkboxFor("Kingdom 23"));
    expect(orderAfterLine()).toBe(before);

    fireEvent.click(checkboxFor("Berserk deluxe"));
    expect(orderAfterLine()).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Partes iguales" }));
    expect(orderAfterLine()).toBe(before);

    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "12.00" } });
    expect(orderAfterLine()).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar el desglose" }));
    expect(orderAfterLine()).toBe(before);

    // And it is the balance minus the PAYMENT, not minus what the draft happened to place.
    expect(before).toContain("S/ 25.00");
  });
});

describe("order payment breakdown · what the fill button promises (I-1)", () => {
  /**
   * T6. The figure in the control's accessible name is the figure it writes. They are one
   * `computeFillableMinor` call, never two similar ones, and the test checks that at three
   * different moments of the draft because the ceiling is live.
   */
  it("writes exactly the amount its accessible name promises, at every moment of the draft", () => {
    renderForm();
    openBreakdown("45.00");

    const promised = () => fillButtonFor("Berserk deluxe").getAttribute("aria-label");

    // (1) empty draft
    expect(promised()).toBe("Asignar S/ 45.00 a Berserk deluxe");

    // (2) with the other row holding money
    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "10.00" } });
    expect(promised()).toBe("Asignar S/ 35.00 a Berserk deluxe");

    // (3) and pressing it writes that same figure
    fireEvent.click(fillButtonFor("Berserk deluxe"));
    expect(fieldFor("Berserk deluxe").value).toBe("35.00");
    expect(promised()).toBe("Asignar S/ 35.00 a Berserk deluxe");
  });
});

describe("order payment breakdown · a typed line is never overwritten (I-2)", () => {
  /**
   * T8. The split reaches only what the collector has not decided.
   *
   * The typed line is checked on BOTH sides of the screen: what the field still shows AND what the
   * payload still carries. Asserting the text alone is not enough and that is not a hypothetical —
   * a pinned line keeps its raw text on screen even when a split has overwritten the amount behind
   * it, so a version of this test that only read the field passes while the payment silently
   * changes shape on the way out.
   */
  it("leaves a typed line alone, on screen and in the payload, and splits only the rest", () => {
    const onSubmit = vi.fn<(s: OrderInlinePaymentSubmission) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
    renderForm({ items: THREE_UNPRICED, remainingAmount: 10000, orderTotalCostMinor: 10000, onSubmit });
    openBreakdown("100.00");

    fireEvent.change(fieldFor("Tomo 1"), { target: { value: "30.00" } });
    fireEvent.click(checkboxFor("Tomo 3"));

    // The payload first, because it is the half a pinned line's raw text cannot fake.
    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));
    expect(onSubmit.mock.calls[0][0].allocations).toEqual([
      { orderItemId: "u0", amountMinor: 3000 },
      { orderItemId: "u2", amountMinor: 7000 },
    ]);

    expect(fieldFor("Tomo 1").value).toBe("30.00");
    expect(fieldFor("Tomo 3").value).toBe("70.00");
    expect(fieldFor("Tomo 2").value).toBe("");
  });
});

describe("order payment breakdown · what is sent is what was shown (I-5)", () => {
  /**
   * T9's render half. The payload holds the integers that were on screen, with no rounding and no
   * rescaling on the way out, and it closes against the payment.
   */
  it("emits the visible integers and closes against the payment", async () => {
    const onSubmit = vi.fn<(s: OrderInlinePaymentSubmission) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
    renderForm({ onSubmit });
    openBreakdown("45.00");

    fireEvent.click(screen.getByRole("button", { name: "Partes iguales" }));
    fireEvent.click(checkboxFor("Kingdom 23"));
    fireEvent.click(checkboxFor("Berserk deluxe"));

    expect(fieldFor("Kingdom 23").value).toBe("22.50");
    expect(fieldFor("Berserk deluxe").value).toBe("22.50");

    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));

    const submission = onSubmit.mock.calls[0][0];
    expect(submission.allocations).toEqual([
      { orderItemId: "a", amountMinor: 2250 },
      { orderItemId: "b", amountMinor: 2250 },
    ]);
    const assigned = submission.allocations.reduce((sum, line) => sum + line.amountMinor, 0);
    // The residual is what the server derives, `P - sum`, so this is the whole closure.
    expect(assigned + (submission.amount - assigned)).toBe(4500);
    expect(assigned).toBe(4500);
  });
});

describe("order payment breakdown · a covered product is not offered (E5)", () => {
  /** T10. Not a disabled control: no control. */
  it("renders neither a checkbox nor a field for a product whose price is already covered", () => {
    renderForm({
      items: [
        { itemId: "a", name: "Kingdom 23", basePagableMinor: 4050, allocatedMinor: 4050 },
        { itemId: "b", name: "Berserk deluxe", basePagableMinor: 18500, allocatedMinor: 0 },
      ],
    });
    openBreakdown("45.00");

    const settled = rowFor("Kingdom 23");
    expect(within(settled).queryByRole("checkbox")).toBeNull();
    expect(within(settled).queryByRole("textbox")).toBeNull();
    expect(within(settled).getByText("Saldado")).toBeInTheDocument();

    // The payable one still is.
    expect(within(rowFor("Berserk deluxe")).getByRole("checkbox")).toBeInTheDocument();
  });
});

describe("order payment breakdown · figures inside the list partition, never replicate (I-1b)", () => {
  /**
   * T11 (a). The worst case in the collection: six products with no price at all, so a per-row
   * ceiling would print the WHOLE payment six times over. The list prints no payment figure at all.
   */
  it("prints no payment figure at all inside the list with an empty draft", () => {
    renderForm({ items: SIX_UNPRICED, remainingAmount: 28000, orderTotalCostMinor: 33000 });
    openBreakdown("280.00");

    expect(moneyTextsIn(productList())).toEqual([]);
    expect(
      within(productList())
        .getAllByRole("textbox")
        .map((field) => (field as HTMLInputElement).value),
    ).toEqual(["", "", "", "", "", ""]);

    // The budget is named once, and OUTSIDE the list, which is what keeps it out of this sum.
    expect(screen.getByText(/Por repartir S\/ 280\.00/)).toBeInTheDocument();
  });

  /**
   * T11 (b). Measured again with rows ticked, because a regression that adds a per-row figure only
   * once a row is ticked walks straight past the empty-draft case.
   */
  it("prints only static product facts and the field values once rows are ticked", () => {
    renderForm();
    openBreakdown("45.00");

    fireEvent.click(screen.getByRole("button", { name: "Partes iguales" }));
    fireEvent.click(checkboxFor("Kingdom 23"));
    fireEvent.click(checkboxFor("Berserk deluxe"));

    // The only money TEXT in the list is each product's own price: a fact about the product, true
    // with or without a payment in progress.
    expect(moneyTextsIn(productList())).toEqual(["S/ 59.90", "S/ 185.00"]);

    const values = within(productList())
      .getAllByRole("textbox")
      .map((field) => Number((field as HTMLInputElement).value) * 100);
    expect(values).toEqual([2250, 2250]);
    // The figures derived from the payment PARTITION it: they add up to at most P, never to N x P.
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(4500);
  });
});

describe("order payment breakdown · a ticked line with no room (I-6, E13)", () => {
  /**
   * T12's render half. The line says why it is empty, stays ticked (unticking it would be the app
   * undoing the collector's own decision) and is not counted or sent.
   */
  it("explains itself, stays ticked, and is neither counted nor emitted", () => {
    const onSubmit = vi.fn<(s: OrderInlinePaymentSubmission) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
    renderForm({ onSubmit });
    openBreakdown("45.00");

    fireEvent.click(checkboxFor("Kingdom 23"));
    fireEvent.click(checkboxFor("Berserk deluxe"));
    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "45.00" } });

    expect(within(rowFor("Berserk deluxe")).getByText("Sin espacio en este pago")).toBeInTheDocument();
    expect(checkboxFor("Berserk deluxe").checked).toBe(true);

    // Not emitted: a zero-amount declaration covers nothing and the server refuses it outright.
    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));
    expect(onSubmit.mock.calls[0][0].allocations).toEqual([{ orderItemId: "a", amountMinor: 4500 }]);

    // And the fold counts the lines that will be WRITTEN, not the boxes that are ticked.
    expect(screen.getByRole("button", { name: /Desglose · 1 de 2 productos/ })).toBeInTheDocument();
  });
});

/**
 * "Marcar todos" ticks and SPLITS. Ticking without splitting is the plausible implementation and it
 * is useless: N ticked boxes over N empty fields, `emittedLineCount` still 0, nothing written.
 *
 * The assertion is therefore on the FIGURES, never on the boxes: counting checked boxes passes with
 * that implementation in place. And on `pinned`, because the other plausible wrong implementation
 * writes the amounts and pins them, which quietly takes the lines out of every later recalculation
 * (I-2 exists to protect what the COLLECTOR typed, not what a bulk control wrote for them).
 */
describe("order payment breakdown · Marcar todos ticks and splits (§3.4)", () => {
  /** Three priced products, and a payment that covers the order exactly. */
  const THREE_PRICED: BreakdownItem[] = [
    { itemId: "a", name: "Kingdom 23", basePagableMinor: 5000, allocatedMinor: 0 },
    { itemId: "b", name: "Berserk deluxe", basePagableMinor: 10000, allocatedMinor: 0 },
    { itemId: "c", name: "Nendoroid Asuka", basePagableMinor: 3000, allocatedMinor: 0 },
  ];

  function renderThreePriced() {
    renderForm({
      items: THREE_PRICED,
      remainingAmount: 18000,
      orderTotalCostMinor: 18000,
      undetailedPaidMinor: 0,
    });
    openBreakdown("180.00");
  }

  it("lands every product on its own price, and pins none of them", () => {
    renderThreePriced();

    fireEvent.click(screen.getByRole("button", { name: "Marcar todos" }));

    expect(fieldFor("Kingdom 23").value).toBe("50.00");
    expect(fieldFor("Berserk deluxe").value).toBe("100.00");
    expect(fieldFor("Nendoroid Asuka").value).toBe("30.00");
    // The fold counts the lines that will be WRITTEN, so it is the payload's own witness.
    expect(screen.getByRole("button", { name: /Desglose · 3 de 3 productos · S\/ 180\.00/ })).toBeInTheDocument();
    // Nothing was typed, so nothing may be pinned: a bulk control that pins writes a state the
    // collector never asked for and that no later recalculation may enter.
    expect(within(productList()).queryByText(/fijado/)).toBeNull();
  });

  it("leaves nothing behind once the foot's own Limpiar is pressed", () => {
    renderThreePriced();

    fireEvent.click(screen.getByRole("button", { name: "Marcar todos" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar el desglose" }));

    expect(screen.getByRole("button", { name: /Desglosar entre productos/ })).toBeInTheDocument();
    expect(within(productList()).queryByText(/fijado/)).toBeNull();
  });
});

describe("order payment breakdown · the mode is a property of the order (§5.2.2)", () => {
  /** T17's render half. */
  it("opens on by-price when any product has a price, with both options offered", () => {
    renderForm();
    openBreakdown("45.00");

    expect(screen.getByRole("button", { name: "Por precio" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Partes iguales" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/Ningún producto tiene precio/)).toBeNull();
  });

  it("offers no mode control at all when no product has a price, and says why", () => {
    renderForm({ items: SIX_UNPRICED, remainingAmount: 28000, orderTotalCostMinor: 33000 });
    openBreakdown("280.00");

    expect(screen.queryByRole("button", { name: "Por precio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Partes iguales" })).toBeNull();
    expect(screen.getByText(/Ningún producto tiene precio/)).toBeInTheDocument();
  });
});

/**
 * Folding hides the lines. It does not withdraw them.
 *
 * The panel's own trigger goes on reading the draft back while it is folded ("Desglose · 2 de 2
 * productos · S/ 45,00"), so a fold that quietly emptied the payload made that summary a claim the
 * submission contradicted: the money went in undesglosado while the screen said it had not.
 */
describe("order payment breakdown · a folded draft is still a draft", () => {
  it("submits the folded lines, exactly as the trigger still reads them back", () => {
    const onSubmit = vi.fn<(s: OrderInlinePaymentSubmission) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
    renderForm({ onSubmit });
    openBreakdown("45.00");

    fireEvent.click(checkboxFor("Kingdom 23"));
    fireEvent.click(checkboxFor("Berserk deluxe"));
    foldBreakdown();

    // Folded: the list is gone and the summary is the whole answer, per §6.2.
    expect(isPanelOpen()).toBe(false);
    expect(screen.getByRole("button", { name: /Desglose · 2 de 2 productos · S\/ 45\.00/ })).toBeInTheDocument();

    submit();
    expect(onSubmit.mock.calls[0][0].allocations).toEqual([
      { orderItemId: "a", amountMinor: 1101 },
      { orderItemId: "b", amountMinor: 3399 },
    ]);
  });

  it("still waits for the verdict, because the folded draft is what a refusal would destroy", () => {
    const onSubmit = vi.fn<(s: OrderInlinePaymentSubmission) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
    const onSubmitted = vi.fn();
    renderForm({ onSubmit, onSubmitted });
    openBreakdown("45.00");

    fireEvent.click(checkboxFor("Kingdom 23"));
    foldBreakdown();
    submit();

    expect(onSubmit.mock.calls[0][0].awaitsVerdict).toBe(true);
    // The other half of the same contract: the surface does not dismiss in the submitting tick, so
    // a refusal still has somewhere to be read and the draft still has somewhere to live.
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  /**
   * The other side of the same question, and it has to be answered with the same predicate: a ticked
   * line worth nothing is not a draft. Nothing is emitted for it, the trigger prints "Desglosar
   * entre productos" (there is no breakdown), and a refusal would therefore destroy nothing — so
   * this payment belongs on the optimistic path with every other undesglosado one.
   */
  it("takes the optimistic path when every ticked line is worth zero", () => {
    const onSubmit = vi.fn<(s: OrderInlinePaymentSubmission) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
    const onSubmitted = vi.fn();
    renderForm({ onSubmit, onSubmitted });
    openBreakdown("45.00");

    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "0" } });
    fireEvent.change(fieldFor("Berserk deluxe"), { target: { value: "0" } });

    // Every visible sign says there is no breakdown here, so the invisible one may not disagree.
    expect(screen.getByRole("button", { name: /Desglosar entre productos/ })).toBeInTheDocument();

    submit();

    const submission = onSubmit.mock.calls[0][0];
    expect(submission.allocations).toEqual([]);
    expect(submission.awaitsVerdict).toBe(false);
    expect(onSubmitted).toHaveBeenCalled();
  });
});

/**
 * The caption on the collector's single most common payment: the closing half of an adelanto +
 * pago final pair, where every line lands EXACTLY on its own price.
 *
 * Read off the result ("this line sits at its own ceiling") every line looks clamped, and the panel
 * says "some products already had payments, so they get less" while nobody received less. Clamped
 * is `quota > ceiling`, which only the split can see.
 */
describe("order payment breakdown · what 'clamped' means (E15)", () => {
  /** Total 150,00 · prices 50,00 / 100,00 · 26,67 and 53,33 already declared · final payment 70,00. */
  const ADVANCE_PAID: BreakdownItem[] = [
    { itemId: "a", name: "Kingdom 23", basePagableMinor: 5000, allocatedMinor: 2667 },
    { itemId: "b", name: "Berserk deluxe", basePagableMinor: 10000, allocatedMinor: 5333 },
  ];

  it("says the plain rule when every line closes exactly on its price, and never the clamped one", () => {
    renderForm({
      items: ADVANCE_PAID,
      remainingAmount: 7000,
      orderTotalCostMinor: 15000,
      undetailedPaidMinor: 0,
    });
    openBreakdown("70.00");

    fireEvent.click(checkboxFor("Kingdom 23"));
    fireEvent.click(checkboxFor("Berserk deluxe"));

    // Each product closes on its own price to the centavo: 23,33 + 26,67 = 50,00 and 46,67 + 53,33
    // = 100,00. Nothing was cut short, so nothing "receives less".
    expect(fieldFor("Kingdom 23").value).toBe("23.33");
    expect(fieldFor("Berserk deluxe").value).toBe("46.67");

    expect(screen.getByText("Cada producto recibe el mismo porcentaje de su precio.")).toBeInTheDocument();
    expect(screen.queryByText(/ya tenían pagos, así que reciben menos/)).toBeNull();
  });

  it("still says the clamped rule when a line really is cut short at its ceiling", () => {
    // The other side of the same predicate, so the fix cannot be "never say it": A's quota is 50% of
    // 50,00 but only 10,00 of its price is left, and that shortfall leaves the split.
    renderForm({
      items: [
        { itemId: "a", name: "Kingdom 23", basePagableMinor: 5000, allocatedMinor: 4000 },
        { itemId: "b", name: "Berserk deluxe", basePagableMinor: 15000, allocatedMinor: 0 },
      ],
      remainingAmount: 11000,
      orderTotalCostMinor: 20000,
      undetailedPaidMinor: 0,
    });
    openBreakdown("100.00");

    fireEvent.click(checkboxFor("Kingdom 23"));
    fireEvent.click(checkboxFor("Berserk deluxe"));

    expect(fieldFor("Kingdom 23").value).toBe("10.00");
    expect(screen.getByText(/ya tenían pagos, así que reciben menos/)).toBeInTheDocument();
  });
});

/**
 * A draft the form is REFUSING cannot be folded out of sight.
 *
 * The refusal and the fields that resolve it both live inside the section, and the CTA is dead
 * while it stands. Folded, the collector had a disabled button, a summary line, and the sentence
 * explaining both nowhere in the document.
 */
describe("order payment breakdown · a blocked draft keeps itself reachable (E7)", () => {
  it("holds the panel open, with the reason and the culprit's own field on screen", () => {
    renderForm();
    openBreakdown("45.00");

    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "40.00" } });
    fireEvent.change(fieldFor("Berserk deluxe"), { target: { value: "40.00" } });

    foldBreakdown();

    expect(isPanelOpen()).toBe(true);
    expect(breakdownTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Te pasaste por S\/ 35\.00/)).toBeInTheDocument();
    expect(fieldFor("Kingdom 23").value).toBe("40.00");
    expect(screen.getByRole("button", { name: /Registrar/ })).toBeDisabled();

    // The fold was refused, not queued: the trigger says so, and points at the sentence saying why.
    const trigger = breakdownTrigger();
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    const reasonId = trigger.getAttribute("aria-describedby");
    expect(document.getElementById(reasonId as string)?.textContent).toContain("Te pasaste por S/ 35.00");

    // And once the draft is legal again the panel is still where the collector left it, rather than
    // collapsing under their hand on a click they made two edits ago.
    fireEvent.change(fieldFor("Berserk deluxe"), { target: { value: "5.00" } });
    expect(isPanelOpen()).toBe(true);
    expect(screen.getByRole("button", { name: /Registrar/ })).toBeEnabled();
  });

  /**
   * The one path where the panel is FOLDED when the draft turns illegal, which is the only path the
   * forced opening is actually for.
   *
   * It is reached from outside the panel: a pinned line stays exactly where it was typed, so
   * lowering the payment itself is what puts the draft over it. The forcing has to be LATCHED into
   * the state rather than derived from the block, because a derived opening un-opens itself the
   * instant the collector fixes the line — pulling the section out from under the caret they are
   * typing into and dropping the focus on `<body>`.
   */
  it("opens itself when the amount drops under a folded draft, and stays open once it is fixed", () => {
    renderForm();
    openBreakdown("45.00");

    // Typed, so no recalculation may move it again. Legal at 45,00, and folded while it is legal.
    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "40.00" } });
    foldBreakdown();
    expect(isPanelOpen()).toBe(false);

    // The payment shrinks under the pinned line, from the field OUTSIDE the panel.
    fireEvent.change(amountField(), { target: { value: "10.00" } });

    expect(isPanelOpen()).toBe(true);
    expect(breakdownTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Te pasaste por S\/ 30\.00/)).toBeInTheDocument();
    expect(fieldFor("Kingdom 23").value).toBe("40.00");

    // Fixed from INSIDE the panel, which is the moment a derived opening collapses the section with
    // the caret in it. The fold is the collector's to ask for, and they have not asked.
    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "5.00" } });
    expect(isPanelOpen()).toBe(true);
    expect(fieldFor("Kingdom 23").value).toBe("5.00");
    expect(screen.getByRole("button", { name: /Registrar/ })).toBeEnabled();

    // Still the collector's to close, though: the latch holds the panel open, it does not nail it.
    foldBreakdown();
    expect(isPanelOpen()).toBe(false);
  });
});

/**
 * The two controls of this panel that can be unable to act, and the sentence each of them owes.
 *
 * `disabled` is how that sentence gets lost: out of the tab order, name never read, no pointer
 * events for a tooltip (`docs/design/interface-patterns.md` §14).
 */
describe("order payment breakdown · a control that cannot act says why (A11y)", () => {
  it("keeps the trigger reachable while the amount is empty, and points it at the reason", () => {
    renderForm();

    const trigger = screen.getByRole("button", { name: /Desglosar entre productos/ });
    expect(trigger).not.toBeDisabled();
    expect(trigger).toHaveAttribute("aria-disabled", "true");

    const reasonId = trigger.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId as string)?.textContent).toBe("Escribe primero el monto del pago.");
  });

  it("keeps a spent fill control reachable, points it at the reason, and writes nothing", () => {
    renderForm();
    openBreakdown("45.00");

    // The whole payment is on the first line, so there is nothing left for the second.
    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "45.00" } });

    const fill = fillButtonFor("Berserk deluxe");
    expect(fill).not.toBeDisabled();
    expect(fill).toHaveAttribute("aria-disabled", "true");

    const reasonId = fill.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId as string)?.textContent).toBe("No queda nada de este pago por asignar.");

    fireEvent.click(fill);
    // Inert, not merely honest: pressing it must not write the zero its name names.
    expect(fieldFor("Berserk deluxe").value).toBe("");
  });
});

/**
 * The residual is ONE figure, so it gets ONE explanation.
 *
 * All three foot lines print the whole residual and their conditions are not exclusive. Equal parts
 * fills every line to its ceiling, so "the ticked products cannot take more" is why money is left
 * over there. By price it is not: the residual has the closed form of `BR-05-24`, and pointing at
 * the ceilings names a constraint the split never pushed against.
 */
describe("order payment breakdown · one residual, one reason", () => {
  /** The prototype's order: prices 280,00 / 18,00 / 89,00 against a total of 1.240,00. */
  const SHIPPING_HEAVY: BreakdownItem[] = [
    { itemId: "a", name: "NGE OST Vol. 2", basePagableMinor: 28000, allocatedMinor: 0 },
    { itemId: "b", name: "Berserk Vol. 41", basePagableMinor: 1800, allocatedMinor: 0 },
    { itemId: "c", name: "Nendoroid Asuka", basePagableMinor: 8900, allocatedMinor: 1000 },
  ];

  it("names the unpriced gap and not the ceilings, when by price both would be true at once", () => {
    renderForm({
      items: SHIPPING_HEAVY,
      remainingAmount: 49600,
      orderTotalCostMinor: 124000,
      undetailedPaidMinor: 74400,
    });
    openBreakdown("496.00");

    fireEvent.click(checkboxFor("NGE OST Vol. 2"));
    fireEvent.click(checkboxFor("Berserk Vol. 41"));
    fireEvent.click(checkboxFor("Nendoroid Asuka"));

    // 40% of each price, and the ticked ceilings (377,00) together fall short of the payment.
    expect(fieldFor("NGE OST Vol. 2").value).toBe("112.00");
    expect(fieldFor("Berserk Vol. 41").value).toBe("7.20");
    expect(fieldFor("Nendoroid Asuka").value).toBe("35.60");

    expect(screen.getByText(/no corresponden a ningún producto/)).toBeInTheDocument();
    expect(screen.queryByText(/los productos marcados ya no admiten más/)).toBeNull();
  });

  it("still names the ceilings in equal parts, where they are the reason", () => {
    renderForm({
      items: SHIPPING_HEAVY,
      remainingAmount: 49600,
      orderTotalCostMinor: 124000,
      undetailedPaidMinor: 74400,
    });
    openBreakdown("496.00");

    fireEvent.click(screen.getByRole("button", { name: "Partes iguales" }));
    fireEvent.click(checkboxFor("NGE OST Vol. 2"));
    fireEvent.click(checkboxFor("Berserk Vol. 41"));
    fireEvent.click(checkboxFor("Nendoroid Asuka"));

    expect(screen.getByText(/los productos marcados ya no admiten más/)).toBeInTheDocument();
  });
});

/**
 * The live region says what the visible foot says, settled case included: announcing "will still
 * owe S/ 0,00" under a foot reading "this order is settled" is one screen saying two things, and it
 * is the case of 7 of the 8 orders that can reach this panel whenever the "Todo" chip is used.
 */
describe("order payment breakdown · the announcement matches the foot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces the settlement rather than a balance of zero", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderForm();
    openBreakdown("45.00");

    fireEvent.click(checkboxFor("Kingdom 23"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Este pedido queda saldado")).toBeInTheDocument();
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("Desglosado S/ 11.01 de S/ 45.00. Este pedido queda saldado.");
  });
});

/**
 * A server refusal is announced exactly once, by the form's own alert, which carries the sentence
 * the server sent. The row's job is the rail and `aria-invalid`; repeating the announcement from a
 * row would say it twice, and what the row would actually announce is a CLIENT-side rule the panel
 * deliberately leaves silent.
 */
describe("order payment breakdown · the refusal is announced once", () => {
  it("keeps a refused row's own message out of the live announcements", async () => {
    renderForm({
      onSubmit: async () => ({ ok: false, error: "EXCEEDS_ITEM_BASE", orderItemId: "a" }),
    });
    openBreakdown("45.00");

    fireEvent.click(checkboxFor("Kingdom 23"));
    submit();

    await waitFor(() =>
      expect(
        screen.getByText("Un producto recibió más de su precio pendiente. Revisa el desglose."),
      ).toBeInTheDocument(),
    );

    // Now the refused row also breaks a client-side rule, which is the one path that put a second
    // alert on screen for the same event.
    fireEvent.change(fieldFor("Kingdom 23"), { target: { value: "60.00" } });
    expect(within(rowFor("Kingdom 23")).getByText("Supera el precio pendiente de este producto.")).toBeInTheDocument();

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});
