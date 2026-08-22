import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * The payment breakdown inside the review screen, against the REAL Spanish copy.
 *
 * The catalog is loaded rather than stubbed for the same reason the order detail's own panel test
 * loads it: half of what is measured here is the FIGURES the panel prints, and a key-only stub
 * erases every one of them. It also measures which of two sentences the budget line uses
 * ("del pedido" vs "de lo que falta"), which a stub answering with key paths cannot tell apart from
 * a component that never chose.
 */
vi.mock("next-intl", async () => {
  const catalogs: Record<string, unknown> = {
    orders: (await import("@/i18n/locales/es/orders.json")).default,
    imageIntake: (await import("@/i18n/locales/es/imageIntake.json")).default,
    productBreakdown: (await import("@/i18n/locales/es/productBreakdown.json")).default,
    components: (await import("@/i18n/locales/es/components.json")).default,
    storeProductTypes: (await import("@/i18n/locales/es/storeProductTypes.json")).default,
    common: (await import("@/i18n/locales/es/common.json")).default,
  };

  const resolve = (path: string): unknown =>
    path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], catalogs);

  const useTranslations = (namespace?: string) => {
    const translate = (key: string, values?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      const text = resolve(full);
      // Namespaces this screen only passes through (dates, chips) keep answering with their key, so
      // an assertion never silently matches a message that does not exist.
      if (typeof text !== "string") return full;
      return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        values && name in values ? String(values[name]) : match,
      );
    };
    translate.rich = (key: string, tags: Record<string, (chunks: string) => unknown>) =>
      tags.link ? tags.link(translate(key)) : translate(key);
    translate.has = () => true;
    return translate;
  };

  return { useTranslations, useLocale: () => "es" };
});

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

vi.mock("@/lib/fx/exchangeRates", () => ({
  fetchTodayRate: vi.fn(async () => ({ ok: false as const })),
}));

import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import type { IntakeBreakdownPayload } from "@/lib/imageIntake/intakeBreakdownContract";
import IntakeReviewScreen from "../IntakeReviewScreen";

const STORE_ID = "clh1234567890abcdefghijkl";
const STORE_OPTIONS = [{ id: STORE_ID, name: "Pop Dealer" }];
const PRODUCT_TYPE_KEYS = ["figures", "manga"];

function field<T>(value: T | null, source: "read" | "assumed" | null = value === null ? null : "read") {
  return { value, source };
}

type ProductSpec = { name: string; unitPrice: number | null };
type PaymentSpec = { amount: number | null; paidAt: string | null };

function buildDraft(input: {
  groups: ProductSpec[][];
  totalCost: number | null;
  payments?: PaymentSpec[];
  orderDate?: string | null;
}): ImageIntakeDraft {
  return {
    store: { matchedStoreId: STORE_ID, name: field("Pop Dealer"), phone: field(null), candidates: [] },
    currency: field("PEN"),
    orderDate: field(input.orderDate === undefined ? "2026-07-20" : input.orderDate),
    totalCost: field(input.totalCost),
    groups: input.groups.map((products, groupIndex) => ({
      sourcePhrase: `grupo ${groupIndex + 1}`,
      reason: "split" as const,
      doubtful: false,
      priceSplit: "explicit-unit" as const,
      products: products.map((product) => ({
        name: product.name,
        unitPrice: product.unitPrice,
        suggestedProductTypeKey: null,
        referenceUrl: null,
      })),
    })),
    payments: (input.payments ?? []).map((payment) => ({
      amount: field(payment.amount),
      paidAt: field(payment.paidAt),
    })),
    delivery: null,
    warnings: [],
  };
}

type SaveSpy = ReturnType<
  typeof vi.fn<(draft: ImageIntakeDraft, rate: number | null, breakdown: IntakeBreakdownPayload | undefined) => void>
>;

function renderScreen(draft: ImageIntakeDraft, onSave: SaveSpy = vi.fn()) {
  render(
    <IntakeReviewScreen
      initialDraft={draft}
      baseCurrencyCode="PEN"
      storeOptions={STORE_OPTIONS}
      productTypeKeys={PRODUCT_TYPE_KEYS}
      isSaving={false}
      onSave={onSave}
      onManualClick={vi.fn()}
      spentPhotoCount={2}
      remainingPhotos={null}
      onAddProductSheet={vi.fn()}
    />,
  );
  return onSave;
}

/** The `<li>` of one payment row, found through the id its amount field already carries. */
function paymentRow(index: number): HTMLElement {
  const amountField = document.getElementById(`intake-payment-amount-${index}`);
  if (amountField === null) throw new Error(`payment row ${index} is not on screen`);
  return amountField.closest("li") as HTMLElement;
}

function openBreakdown(index: number) {
  fireEvent.click(within(paymentRow(index)).getByRole("button", { name: /Desglosar entre productos/ }));
}

function selectAllIn(index: number) {
  fireEvent.click(within(paymentRow(index)).getByRole("button", { name: "Marcar todos" }));
}

function productListIn(index: number): HTMLElement {
  return within(paymentRow(index)).getByRole("list", { name: "Productos de este pedido" });
}

function rowFor(index: number, name: string): HTMLElement {
  return within(productListIn(index)).getByText(name).closest("li") as HTMLElement;
}

function fieldFor(index: number, name: string): HTMLInputElement {
  return within(rowFor(index, name)).getByRole("textbox") as HTMLInputElement;
}

/** The disclosure of one payment row, whatever it currently reads. */
function breakdownTrigger(index: number): HTMLElement {
  return within(paymentRow(index)).getAllByRole("button")[0];
}

function paymentsSection(): HTMLElement {
  return document.getElementById("intake-section-payments")?.closest("section") as HTMLElement;
}

function submit() {
  fireEvent.click(screen.getAllByRole("button", { name: "Crear pedido" })[0]);
  // Rows that are all priced and do not add up to the stated total now raise the same totals
  // confirmation the manual forms raise. `TWO_PRICED` is deliberately in that state (150,00 for
  // rows worth 150,00 only when the fixture says so), and none of the cases here is about that
  // gate, so the question is answered and the case gets on with what it is actually asserting.
  const confirm = screen.queryByRole("button", { name: "Guardar de todos modos" });
  if (confirm !== null) fireEvent.click(confirm);
}

/** Two priced products against a total of 150,00: the fixture every arithmetic case below uses. */
const TWO_PRICED: ProductSpec[] = [
  { name: "Kingdom 23", unitPrice: 5000 },
  { name: "Berserk deluxe", unitPrice: 10000 },
];

/**
 * With two payment rows on screen there are two panels, and every id the panel and its rows mint
 * used to be a module constant. Two `id="order-payment-breakdown"`, two fact nodes per product (the
 * item key is the product's POSITION, identical on both rows), and every `aria-controls`,
 * `aria-expanded` and `aria-describedby` pointing at whichever copy rendered first.
 *
 * One panel cannot see this: the duplicates only exist in pairs. The two-row fixture IS the test.
 */
describe("intake breakdown · two panels never share a DOM id (T10)", () => {
  it("mints unique ids across both open panels, and every reference resolves", () => {
    renderScreen(
      buildDraft({
        groups: [TWO_PRICED],
        totalCost: 15000,
        payments: [
          { amount: 8000, paidAt: "2026-07-21" },
          { amount: 2000, paidAt: "2026-07-22" },
        ],
      }),
    );

    openBreakdown(0);
    openBreakdown(1);

    const ids = [...paymentsSection().querySelectorAll<HTMLElement>("[id]")].map((node) => node.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);

    for (const index of [0, 1]) {
      const controls = breakdownTrigger(index).getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      expect(document.getElementById(controls as string)).not.toBeNull();
    }
  });
});

/**
 * Row k splits against what the rows above it left behind, so a product an earlier row already
 * covered to its price is not offered at all: no checkbox, no field, just the chip.
 *
 * The query is by ROLE for exactly that reason. Asserting the chip alone passes with the ceilings
 * ignored, because a covered product still renders a name; what the ceilings decide is whether the
 * row has controls that can send the server an amount it refuses with `EXCEEDS_ITEM_BASE`.
 */
describe("intake breakdown · a product row 0 covered is not offered on row 1 (T7, E5)", () => {
  it("drops the controls of the covered product and keeps the other one's", () => {
    renderScreen(
      buildDraft({
        groups: [TWO_PRICED],
        totalCost: 15000,
        payments: [
          { amount: 8000, paidAt: "2026-07-21" },
          { amount: 2000, paidAt: "2026-07-22" },
        ],
      }),
    );

    // Row 0 hands Kingdom 23 its whole price and the rest to Berserk.
    openBreakdown(0);
    fireEvent.change(fieldFor(0, "Kingdom 23"), { target: { value: "50.00" } });
    fireEvent.change(fieldFor(0, "Berserk deluxe"), { target: { value: "30.00" } });

    openBreakdown(1);
    const covered = rowFor(1, "Kingdom 23");
    expect(within(covered).queryByRole("checkbox")).toBeNull();
    expect(within(covered).queryByRole("textbox")).toBeNull();
    expect(within(covered).getByText("Saldado")).toBeInTheDocument();

    const payable = rowFor(1, "Berserk deluxe");
    expect(within(payable).getByRole("checkbox")).toBeInTheDocument();
    expect(within(payable).getByRole("textbox")).toBeInTheDocument();
  });
});

/**
 * `percentBasis` chooses COPY and never arithmetic. Row 0's denominator IS the order total, so the
 * detail's own "del pedido" is literal there; from row 1 the base is what the rows above left
 * unpaid, and printing "del pedido" would put two percentages measured against two different things
 * ten centimetres apart under one label.
 *
 * The test asserts the LABEL and not the figure, on purpose: the guard that keeps the applied and
 * the printed denominator identical can raise the denominator above that base, so the sentence
 * names the base rather than promising `pago / saldo`. The figures live in the lib's own test.
 */
describe("intake breakdown · the percentage names its own base (T18)", () => {
  it("says 'del pedido' on the first row and 'de lo que falta' from the second", () => {
    renderScreen(
      buildDraft({
        groups: [TWO_PRICED],
        totalCost: 15000,
        payments: [
          { amount: 8000, paidAt: "2026-07-21" },
          { amount: 2000, paidAt: "2026-07-22" },
        ],
      }),
    );

    openBreakdown(0);
    openBreakdown(1);

    expect(within(paymentRow(0)).getByText(/Por repartir .* % del pedido/)).toBeInTheDocument();
    expect(within(paymentRow(0)).queryByText(/de lo que falta/)).toBeNull();

    expect(within(paymentRow(1)).getByText(/Por repartir .* % de lo que falta/)).toBeInTheDocument();
    expect(within(paymentRow(1)).queryByText(/% del pedido/)).toBeNull();
  });
});

/** Three priced products against a total of 180,00, so removing one still leaves a panel to look at. */
const THREE_PRICED: ProductSpec[] = [
  { name: "Kingdom 23", unitPrice: 5000 },
  { name: "Berserk deluxe", unitPrice: 10000 },
  { name: "Nendoroid Asuka", unitPrice: 3000 },
];

/**
 * The predicate that wipes every breakdown draft is the COUNT of flattened products, and nothing
 * else. Correcting a name has to survive it, because a breakdown erased for fixing a typo is the
 * app deleting the collector's work over a neighbouring field; removing a product must not, because
 * the lines point at positions that have just been renumbered.
 */
describe("intake breakdown · what clears the drafts and what does not (T8, §7.3)", () => {
  function setUp() {
    renderScreen(
      buildDraft({
        groups: [THREE_PRICED],
        totalCost: 18000,
        payments: [{ amount: 18000, paidAt: "2026-07-21" }],
      }),
    );
    openBreakdown(0);
    selectAllIn(0);
    expect(fieldFor(0, "Kingdom 23").value).toBe("50.00");
  }

  it("(a) survives a corrected product NAME", () => {
    setUp();

    const nameCells = screen.getAllByLabelText("Nombre") as HTMLInputElement[];
    fireEvent.change(nameCells[2], { target: { value: "Nendoroid Asuka Plugsuit" } });

    expect(fieldFor(0, "Kingdom 23").value).toBe("50.00");
    expect(fieldFor(0, "Berserk deluxe").value).toBe("100.00");
    expect(fieldFor(0, "Nendoroid Asuka Plugsuit").value).toBe("30.00");
    expect(screen.queryByText(/Cambiaste los productos/)).toBeNull();
  });

  it("(b) is wiped, and said out loud, when a product is removed", () => {
    setUp();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar producto 3" }));

    expect(within(paymentRow(0)).getByRole("button", { name: /Desglosar entre productos/ })).toBeInTheDocument();
    expect(screen.getByText(/Cambiaste los productos/)).toBeInTheDocument();
  });
});

/**
 * The gate a breakdown buys is deliberately narrow. A row WITHOUT one keeps `FR-11-52b`: incomplete
 * rows are dropped server-side and block nothing, which is the right trade for two fields the
 * collector can retype. A row WITH one carries up to N hand-typed lines, so it is stopped here.
 */
describe("intake breakdown · the save gate is narrow (T9, §8.2)", () => {
  function draftWithUndatedPayment() {
    return buildDraft({
      groups: [TWO_PRICED],
      totalCost: 15000,
      payments: [{ amount: 8000, paidAt: null }],
    });
  }

  it("(a) refuses to save a dated-less row that carries a breakdown, and focuses its date", () => {
    const onSave = renderScreen(draftWithUndatedPayment());

    openBreakdown(0);
    selectAllIn(0);
    submit();

    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe("intake-payment-date-0");
    expect(screen.getByText(/Ponle fecha a este pago/)).toBeInTheDocument();
  });

  it("(b) still saves when the same incomplete row carries no breakdown", () => {
    const onSave = renderScreen(draftWithUndatedPayment());

    submit();

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

/**
 * Every input of the split lives outside the panel on this screen, so the panel has to be a live
 * function of them: correcting a price upstairs re-runs the split through the same door a tick goes
 * through. What it may never touch is a line the collector typed into (I-2).
 */
describe("intake breakdown · a corrected price re-splits, a typed line does not (T12, §4.1)", () => {
  function setUpEightyPaid(onSave: SaveSpy = vi.fn()) {
    renderScreen(
      buildDraft({
        groups: [TWO_PRICED],
        totalCost: 15000,
        payments: [{ amount: 8000, paidAt: "2026-07-21" }],
      }),
      onSave,
    );
    openBreakdown(0);
    selectAllIn(0);
    expect(fieldFor(0, "Kingdom 23").value).toBe("26.67");
    expect(fieldFor(0, "Berserk deluxe").value).toBe("53.33");
  }

  function priceCells(): HTMLInputElement[] {
    return screen.getAllByLabelText("Precio unit.") as HTMLInputElement[];
  }

  it("(a) re-splits the unpinned lines against the new price", () => {
    setUpEightyPaid();

    // The total does not move with it (`FR-11-58b`), so the residual is what absorbs the gap.
    fireEvent.change(priceCells()[1], { target: { value: "40" } });

    expect(fieldFor(0, "Kingdom 23").value).toBe("26.67");
    expect(fieldFor(0, "Berserk deluxe").value).toBe("21.33");
    expect(within(paymentRow(0)).getByText(/Sin desglosar S\/ 32\.00/)).toBeInTheDocument();
  });

  it("(b) leaves a hand-typed line exactly where it was typed", () => {
    const onSave = vi.fn();
    setUpEightyPaid(onSave);

    fireEvent.change(priceCells()[1], { target: { value: "40" } });
    fireEvent.change(fieldFor(0, "Kingdom 23"), { target: { value: "30.00" } });

    expect(fieldFor(0, "Kingdom 23").value).toBe("30.00");
    expect(fieldFor(0, "Berserk deluxe").value).toBe("13.33");

    // The PAYLOAD too, because a pinned line keeps its raw text on screen even when a split has
    // overwritten the amount behind it: reading the field alone passes while the money changes
    // shape on the way out.
    submit();
    expect(onSave.mock.calls[0][2]).toEqual([
      {
        paymentIndex: 0,
        lines: [
          { position: 1, amountMinor: 3000 },
          { position: 2, amountMinor: 1333 },
        ],
      },
    ]);
  });
});

/**
 * The frequent path is a payment nobody splits, and it must reach the action as `undefined` rather
 * than as one empty entry per row: the wire contract refuses an entry with no lines, so a uniform
 * shape would break the ordinary save for the sake of a symmetry nothing needs.
 */
describe("intake breakdown · a payment nobody split sends nothing (T14, §5)", () => {
  it("passes undefined to onSave when no panel was ever touched", () => {
    const onSave = renderScreen(
      buildDraft({
        groups: [TWO_PRICED],
        totalCost: 15000,
        payments: [{ amount: 8000, paidAt: "2026-07-21" }],
      }),
    );

    submit();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][2]).toBeUndefined();
  });

  it("passes the declared lines, by position, once one is", () => {
    const onSave = renderScreen(
      buildDraft({
        groups: [TWO_PRICED],
        totalCost: 15000,
        payments: [{ amount: 8000, paidAt: "2026-07-21" }],
      }),
    );

    openBreakdown(0);
    selectAllIn(0);
    submit();

    expect(onSave.mock.calls[0][2]).toEqual([
      {
        paymentIndex: 0,
        lines: [
          { position: 1, amountMinor: 2667 },
          { position: 2, amountMinor: 5333 },
        ],
      },
    ]);
  });
});

/** A, B, C priced 5000/10000/5000 against a total of 20000: row 0 covers A exactly. */
const RESIDUAL_FIXTURE: ProductSpec[] = [
  { name: "Kingdom 23", unitPrice: 5000 },
  { name: "Berserk deluxe", unitPrice: 10000 },
  { name: "Nendoroid Asuka", unitPrice: 5000 },
];

/**
 * `showResidualUnpriced` (`OrderPaymentBreakdownPanel.tsx`) blames the residual on unpriced
 * products only when the eligible lines' prices fall SHORT of `orderTotalCostMinor`
 * (`sumEligiblePrices < ctx.orderTotalCostMinor`). Row 1 here is the state the intake gate made the
 * NORMAL one from row 2 onward: once row 0 covers A exactly, `orderRemainingBalanceMinor` for row 1
 * is 15000 and `resolveSplitDenominator`'s guard raises it no further, because B and C's prices
 * already sum to that same 15000 (`resolveIntakeBreakdownContext`'s own doc comment, third
 * consumer). `sumEligiblePrices == orderTotalCostMinor`, so the phrase must NOT print, and a `<=`
 * in place of `<` is the one-character mutant that would print it over a row whose prices already
 * add up to the whole denominator.
 */
describe("intake breakdown · the residual is never blamed on unpriced products when prices foot the denominator", () => {
  it("shows the residual amount but not the 'no corresponden a ningún producto' sentence", () => {
    renderScreen(
      buildDraft({
        groups: [RESIDUAL_FIXTURE],
        totalCost: 20000,
        payments: [
          { amount: 5000, paidAt: "2026-07-21" },
          { amount: 10000, paidAt: "2026-07-22" },
        ],
      }),
    );

    // Row 0 hands A its whole price, so it is fully covered before row 1 ever opens.
    openBreakdown(0);
    fireEvent.change(fieldFor(0, "Kingdom 23"), { target: { value: "50.00" } });

    // Row 1 ticks only B: 66.667% of its 10000 price is 6667, leaving a 3333 residual.
    openBreakdown(1);
    fireEvent.click(within(rowFor(1, "Berserk deluxe")).getByRole("checkbox"));

    expect(fieldFor(1, "Berserk deluxe").value).toBe("66.67");
    expect(within(paymentRow(1)).getByText(/Sin desglosar S\/ 33\.33/)).toBeInTheDocument();
    expect(within(paymentRow(1)).queryByText(/no corresponden a ningún producto/)).toBeNull();
  });
});
