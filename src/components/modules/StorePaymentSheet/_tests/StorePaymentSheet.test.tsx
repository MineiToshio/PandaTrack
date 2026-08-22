import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StorePaymentAllocationPanel from "../StorePaymentAllocationPanel";
import StorePaymentSheet from "../StorePaymentSheet";
import { buildAllocationLines } from "../buildAllocationLines";
import { getCurrencyDecimals } from "@/lib/currency";
import { computeRestCeilingMinor, type AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";
import { resolveBasePagableMinor } from "@/lib/orders/productPaymentState";
import { validateStorePaymentSheetDraft, type StorePaymentSheetDraft } from "@/lib/orders/storePaymentSheetValidation";
import type { StorePaymentSheetSubmitInput, StorePaymentSubmitOutcome } from "../StorePaymentSheet.types";

type SubmitHandler = (input: StorePaymentSheetSubmitInput) => Promise<StorePaymentSubmitOutcome>;

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
    t.rich = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };

/**
 * The primary action as the modal last received it, so a test can fire its handler WITHOUT going
 * through the disabled attribute. `disabled` and the handler's own guards are two separate defenses
 * against the same thing, and a test that can only click an enabled button can never tell whether
 * the second one exists.
 */
const capturedPrimaryAction: { current: MockModalAction | null } = { current: null };

/**
 * Shell stub that keeps the shape of the real `<Modal>` this component actually depends on. It is
 * deliberately NOT the minimal stub: `dismissible`, `loading` and `initialFocusRef` are the
 * behaviors a broken submit path corrupts (a locked-shut modal, a CTA spinning forever, focus
 * landing on the wrong control), so mocking them away would make those defects untestable. Only the
 * adaptive dialog/sheet machinery is dropped.
 */
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: function MockModal({
    isOpen,
    children,
    primaryAction,
    secondaryAction,
    tertiaryAction,
    dismissible = true,
    initialFocusRef,
    size,
    bodyClassName,
    closeButtonLabel = "Close",
    onClose,
  }: {
    isOpen: boolean;
    children: ReactNode;
    primaryAction: MockModalAction;
    secondaryAction: MockModalAction;
    tertiaryAction?: MockModalAction;
    dismissible?: boolean;
    initialFocusRef?: { current: HTMLElement | null };
    size?: string;
    bodyClassName?: string;
    closeButtonLabel?: string;
    onClose: () => void;
  }) {
    // Mirrors ModalDialog: the modal focuses `initialFocusRef` from its OWN effect, which runs
    // after its children's effects — the ordering that decides who wins the initial focus.
    useEffect(() => {
      if (!isOpen) return;
      initialFocusRef?.current?.focus();
    }, [isOpen, initialFocusRef]);

    capturedPrimaryAction.current = primaryAction;

    if (!isOpen) return null;
    return (
      <div role="dialog" data-size={size}>
        {/* No X and no Esc when the modal is not dismissible — that is what "locked shut" means. */}
        {dismissible && (
          <button type="button" onClick={onClose}>
            {closeButtonLabel}
          </button>
        )}
        <div data-body-class={bodyClassName}>{children}</div>
        <button
          type="button"
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
          data-loading={primaryAction.loading ? "true" : undefined}
        >
          {primaryAction.label}
        </button>
        <button type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
          {secondaryAction.label}
        </button>
        {tertiaryAction && (
          <button type="button" onClick={tertiaryAction.onClick} disabled={tertiaryAction.disabled}>
            {tertiaryAction.label}
          </button>
        )}
      </div>
    );
  },
}));

function makeOrder(overrides: Partial<AssignableOrder> = {}): AssignableOrder {
  return {
    orderId: "order-1",
    humanReadableId: "ORD-20260105-01",
    orderDate: new Date("2026-01-05T00:00:00.000Z"),
    currencyCode: "PEN",
    isActive: true,
    totalCost: 10000,
    allocatedAmountMinor: 0,
    assignableMinor: 10000,
    restCeilingMinor: 0,
    items: [
      {
        itemId: "item-1",
        name: "Nendoroid Miku",
        basePagableMinor: 6000,
        allocatedMinor: 0,
        settledByDeclaration: false,
        paidDeclared: false,
      },
      {
        itemId: "item-2",
        name: "Figma Rem",
        basePagableMinor: 4000,
        allocatedMinor: 0,
        settledByDeclaration: false,
        paidDeclared: false,
      },
    ],
    ...overrides,
  };
}

function renderSheet(overrides: Partial<ComponentProps<typeof StorePaymentSheet>> = {}) {
  const onSubmit = vi.fn<SubmitHandler>(() => Promise.resolve({ ok: true }));
  const onClose = vi.fn();
  const onRetryOrders = vi.fn();
  const props: ComponentProps<typeof StorePaymentSheet> = {
    isOpen: true,
    onClose,
    storeId: "store-1",
    storeName: "Akiba Books",
    debts: [{ currencyCode: "PEN", debtMinor: 10000 }],
    orders: [makeOrder()],
    ordersLoading: false,
    ordersError: false,
    ordersStale: false,
    ordersRefreshing: false,
    onRetryOrders,
    locale: "es",
    onSubmit,
    ...overrides,
  };
  const view = render(<StorePaymentSheet {...props} />);
  return {
    onSubmit,
    onClose,
    onRetryOrders,
    props,
    rerender: (next: ComponentProps<typeof StorePaymentSheet>) => view.rerender(<StorePaymentSheet {...next} />),
  };
}

async function typeAmount(amount: string) {
  await userEvent.type(screen.getByLabelText(/amountLabel/), amount);
}

async function openAllocationPanel() {
  await userEvent.click(screen.getByRole("button", { name: /allocations\.(open|edit|review)/ }));
}

/**
 * The explicit "no sé todavía" action (WO-09): parks the draft's current remainder. Requires the
 * allocation panel to be open, since that is the only surface the affordance renders on.
 */
async function parkRemainder() {
  await userEvent.click(screen.getByRole("button", { name: /allocations\.parkRemainderAria/ }));
}

/**
 * Lets one animation frame pass. The reveal runs inside `requestAnimationFrame`, so asserting that
 * a reveal did NOT happen has to outlive the frame it would have happened in.
 */
async function flushFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

/** The desktop and mobile placements of the fill cell are both in the DOM under jsdom. */
function fillButtons(name: string) {
  return screen.getAllByRole("button", { name: new RegExp(`allocations\\.fillAria.*${name}`) });
}

/** Same, for real product names, which carry `#` and parentheses and cannot go into a RegExp. */
function fillButtonsFor(name: string) {
  return screen.getAllByRole("button", {
    name: (accessibleName: string) => accessibleName.includes("allocations.fillAria") && accessibleName.includes(name),
  });
}

/**
 * Nodes printing `text` that are NOT inside a control: what the collector can READ, as opposed to
 * what a screen reader is told when it lands on a button. A disabled shortcut carries its reason in
 * an `sr-only` node of its own, so a bare `getAllByText` counts the same sentence once per control.
 */
function visibleTexts(text: string) {
  return screen.queryAllByText(text).filter((node) => node.closest("button") === null);
}

function amountFieldFor(name: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(
    (label: string) => label.includes("allocations.amountAria") && label.includes(name),
  );
}

/**
 * Every money figure a chunk of rendered text PRINTS, in minor units.
 *
 * The two invariants of ADR 0027 are about printed figures, so they need a reader that finds them
 * wherever they are rather than a hand-listed set of selectors: a regression that moves the figure
 * to another node of the same row has to stay caught. Amount fields hold their value in an
 * attribute, not in `textContent`, so they are correctly outside this count.
 *
 * It scans for the ISO code `formatAmountWithSymbol` always appends, NOT for the `S/` symbol: this
 * sheet is multi-currency by design (its very first control is a currency selector), and a reader
 * keyed to one symbol returns `[]` for a list rendered in USD or JPY — which makes both invariants
 * pass vacuously on exactly the regression they exist to catch. The code also carries the scale, so
 * a 0-decimal currency is read as itself rather than inflated a hundredfold.
 */
function moneyMinorIn(text: string): number[] {
  return [...text.matchAll(/([\d.,]+)\s+([A-Z]{3})\b/g)].map(([, amount, code]) =>
    Math.round(Number(amount.replace(/,/g, "")) * 10 ** getCurrencyDecimals(code)),
  );
}

/** The rendered rows that name an order's own balance. One per order block, per ADR 0027. */
function rowsNamingABalance() {
  return screen.getAllByRole("listitem").filter((row) => (row.textContent ?? "").includes("allocations.orderBalance"));
}

/** Every order balance the list prints, in the order the blocks are rendered. */
function printedBalancesMinor(): number[] {
  return rowsNamingABalance().flatMap((row) => moneyMinorIn(row.textContent ?? ""));
}

describe("StorePaymentSheet — panel de pago", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders no currency selector for a single-currency store", () => {
    renderSheet();
    expect(screen.queryByLabelText(/currencyLabel/)).not.toBeInTheDocument();
  });

  it("shows the store's debt for that currency", () => {
    renderSheet();
    expect(screen.getByText(/debtAmount/)).toBeInTheDocument();
  });

  it("keeps the note field and the collapsed summary row on the payment panel", () => {
    renderSheet();
    expect(screen.getByLabelText(/noteLabel/)).toBeInTheDocument();
    expect(screen.getByText("allocations.heading")).toBeInTheDocument();
    expect(screen.getByText("allocations.summaryNone")).toBeInTheDocument();
    // The list itself is not rendered until the collector asks for it.
    expect(screen.queryByText("Nendoroid Miku")).not.toBeInTheDocument();
  });

  it("blocks submission and shows the exceeds-debt banner once the amount is over the debt", async () => {
    const { onSubmit } = renderSheet({ debts: [{ currencyCode: "PEN", debtMinor: 5000 }] });

    await typeAmount("60"); // 6000 minor units > 5000 debt

    expect(screen.getByRole("alert")).toHaveTextContent("exceedsDebt");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("StorePaymentSheet — navegación entre paneles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves to the allocation panel and back without losing the draft", async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();

    const itemInput = screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/);
    await userEvent.type(itemInput, "40");

    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));
    expect(screen.getByText(/allocations\.summaryAssigned/)).toBeInTheDocument();

    await openAllocationPanel();
    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveValue("40");
  });
});

describe("StorePaymentSheet — botón de relleno", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes the smallest of the line, order and payment ceilings", async () => {
    renderSheet();
    await typeAmount("100"); // 10000 minor units
    await openAllocationPanel();

    // Line ceiling is 6000 (its own base), which is the tightest of the three here.
    await userEvent.click(fillButtons("Nendoroid Miku")[0]);
    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveValue("60.00");
  });

  it("is capped by what is left of the payment, never leaving the draft invalid", async () => {
    renderSheet();
    await typeAmount("50"); // 5000 minor units, less than the item's own 6000 base
    await openAllocationPanel();

    await userEvent.click(fillButtons("Nendoroid Miku")[0]);
    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveValue("50.00");
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
  });

  it("goes inert once the whole payment is assigned, and the reason REACHES the collector", async () => {
    renderSheet();
    await typeAmount("60");
    await openAllocationPanel();

    await userEvent.click(fillButtons("Nendoroid Miku")[0]);
    const [dead] = fillButtons("Figma Rem");

    // Not `disabled`. A disabled button is out of the tab order and drops `pointer-events`, so the
    // reason it used to carry in `title` was unreachable three ways at once: no hover on desktop
    // (pointer-events), no hover on touch at all, and no keyboard route to hear the name. The three
    // `fillDisabled*` strings were dead copy, and the assertion that "covered" this only proved an
    // attribute existed. What has to hold is that the reason ARRIVES.
    expect(dead).not.toBeDisabled();
    expect(dead).toHaveAttribute("aria-disabled", "true");
    dead.focus();
    expect(dead).toHaveFocus();
    expect(dead).toHaveAccessibleDescription("allocations.fillDisabledPayment");

    // And it is on screen, not only in the accessibility tree: a payment-level reason gets a
    // payment-level notice, the twin of `noAmountNotice`, said once for the whole list.
    expect(visibleTexts("allocations.fillDisabledPayment")).toHaveLength(1);

    // Inert means inert: pressing it writes nothing.
    await userEvent.click(dead);
    expect(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/)).toHaveValue("");
  });

  it("says so on the block when ONE order's balance is exactly spent (not the payment's)", async () => {
    // The gap the payment-level notice does not cover, and the one `lineOverOrder` does not either:
    // that message only fires once the block goes PAST its balance, so landing exactly on it — what
    // pressing "Máx." does — left a block of inert controls and not one word of explanation.
    renderSheet({
      debts: [{ currencyCode: "PEN", debtMinor: 20000 }],
      orders: [
        makeOrder({
          items: [
            ...makeOrder().items,
            {
              itemId: "item-3",
              name: "Tercero sin sitio",
              basePagableMinor: 5000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
        makeOrder({
          orderId: "order-2",
          humanReadableId: "ORD-20260106-01",
          items: [
            {
              itemId: "item-4",
              name: "Otro pedido",
              basePagableMinor: 4000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
      ],
    });
    await typeAmount("150");
    await openAllocationPanel();

    // 100.00 of a 150.00 payment: order-1's own balance is exactly spent, the payment is not.
    await userEvent.type(amountFieldFor("Nendoroid Miku"), "60");
    await userEvent.type(amountFieldFor("Figma Rem"), "40");

    const [dead] = fillButtonsFor("Tercero sin sitio");
    expect(dead).toHaveAttribute("aria-disabled", "true");
    expect(dead).toHaveAccessibleDescription("allocations.fillDisabledOrder");
    // Said once for the block, not once per line, and not as an error: the draft is legal.
    expect(visibleTexts("allocations.fillDisabledOrder")).toHaveLength(1);
    expect(visibleTexts("allocations.fillDisabledPayment")).toHaveLength(0);
    // The other order is untouched: its lines still write.
    expect(fillButtonsFor("Otro pedido")[0]).not.toHaveAttribute("aria-disabled");
  });

  it("keeps a 44px touch box on both shortcut controls", async () => {
    // `src/test/tap-target-guard.test.ts` cannot see this one: a `min-h-*` floor is not a box, and
    // proving the rendered height needs font metrics the scanner does not have (its own KNOWN LIMITS
    // says so, and interface-patterns.md §12 repeats it). Deleting both floors left all 61 tests and
    // the guard green, so the floor is asserted here, where the rendered class list is available.
    renderSheet({
      orders: [
        makeOrder({
          items: [
            {
              itemId: "item-1",
              name: "Nendoroid Miku",
              basePagableMinor: 6000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
            {
              itemId: "item-2",
              name: "Sin precio",
              basePagableMinor: null,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
      ],
    });
    await typeAmount("100");
    await openAllocationPanel();

    const fill = fillButtons("Nendoroid Miku")[0];
    const markPaid = screen.getAllByRole("button", { name: /allocations\.markPaidAria.*Sin precio/ })[0];

    // Base-is-mobile, dropped from `md` up: the spelling the guard reads, and the recipe ADR 0027
    // chose over a `::before` because the amount input sits less than 2N away under `md`.
    for (const control of [fill, markPaid]) {
      expect(control.className).toContain("min-h-11");
      expect(control.className).toContain("md:min-h-0");
    }
  });

  it("never renders a settled checkbox", async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe('StorePaymentSheet — fila "Resto del pedido" (C1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders it for a SINGLE-product order whose price plus shipping leaves a gap", async () => {
    renderSheet({
      debts: [{ currencyCode: "PEN", debtMinor: 11800 }],
      orders: [
        makeOrder({
          totalCost: 11800,
          assignableMinor: 11800,
          restCeilingMinor: 1800,
          items: [
            {
              itemId: "item-1",
              name: "Nendoroid Miku",
              basePagableMinor: 10000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
      ],
    });
    await typeAmount("118");
    await openAllocationPanel();

    expect(screen.getByLabelText(/allocations\.restAmountAria/)).toBeInTheDocument();
  });

  it("does not render it when the products absorb the whole balance", async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();

    expect(screen.queryByLabelText(/allocations\.restAmountAria/)).not.toBeInTheDocument();
  });
});

describe('StorePaymentSheet — "Saldada" derivada (C2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders an arithmetically paid product and a legacy declared one identically", async () => {
    renderSheet({
      orders: [
        makeOrder({
          items: [
            {
              itemId: "item-1",
              name: "Pagado a mano",
              basePagableMinor: 6000,
              allocatedMinor: 6000,
              settledByDeclaration: false,
              paidDeclared: false,
            },
            {
              itemId: "item-2",
              name: "Declarado saldado",
              basePagableMinor: 4000,
              allocatedMinor: 0,
              settledByDeclaration: true,
              paidDeclared: false,
            },
          ],
        }),
      ],
    });
    await typeAmount("100");
    await openAllocationPanel();

    expect(screen.getAllByText("allocations.settledLabel")).toHaveLength(4); // 2 lines × (mobile + desktop)
    // Locked, and locked the same way: `readOnly`, never `disabled` (see the focus test below).
    expect(screen.getByLabelText(/allocations\.amountAria.*Pagado a mano/)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/allocations\.amountAria.*Declarado saldado/)).toHaveAttribute("readonly");
  });
});

describe("StorePaymentSheet — envío", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes synchronously with no allocations, fully parked (Optimistic Confirmation, WO-09)", async () => {
    // Updated for WO-09 (`FR-05-58`): "on account" (nothing declared) is no longer a default this
    // surface falls into silently — the collector has to choose it explicitly through "no sé
    // todavía", which parks the whole amount. The optimistic-close behavior on that path is
    // otherwise unchanged.
    const { onSubmit, onClose } = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await parkRemainder();

    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.amount).toBe(10000);
    expect(payload.currencyCode).toBe("PEN");
    expect(payload.allocations).toEqual([]);
    expect(payload.parkedAmountMinor).toBe(10000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("emits one line per typed amount, with no settlesTarget and no zero-amount line", async () => {
    const { onSubmit, onClose } = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    // WO-09 (`FR-05-58`): 40.00 of the 100.00 payment is still unaccounted for, so the equality
    // gate keeps the CTA shut until the rest is either named or, as here, parked on purpose.
    await parkRemainder();

    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onSubmit.mock.calls[0][0].allocations).toEqual([
      { orderId: "order-1", orderItemId: "item-1", amountMinor: 4000 },
    ]);
    expect(onSubmit.mock.calls[0][0].parkedAmountMinor).toBe(6000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open on a server refusal and marks the line the server named (C5)", async () => {
    const onSubmit = vi.fn<SubmitHandler>(() =>
      Promise.resolve({ ok: false, error: "EXCEEDS_ITEM_BASE", orderId: "order-1", orderItemId: "item-1" }),
    );
    const { onClose } = renderSheet({ onSubmit });

    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    // WO-09 (`FR-05-58`): closes the equality gate so the click below actually reaches the handler.
    await parkRemainder();
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("allocations.serverRejectedLine");
    // The draft survives it — that is the whole point of not closing.
    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveValue("40");
  });

  it("stays escapable and resendable on the shape a network drop REALLY takes (GRAVE 1)", async () => {
    // THE shape both production coordinators emit for a dropped connection: a RESOLVED outcome
    // flagged `unanswered`. Neither of them lets the rejection through — their `onRejected` returns
    // a value on purpose, because a `catch` chained after the success handler would roll a payment
    // the server actually committed back off the screen. So this, not `Promise.reject`, is what the
    // sheet has to get right, and reading the rejection instead put every real network drop in the
    // branch that shuts the CTA.
    const onSubmit = vi.fn<SubmitHandler>(() =>
      Promise.resolve({ ok: false, error: "server_error", unanswered: true } as const),
    );
    const { onClose } = renderSheet({ onSubmit });

    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    // WO-09 (`FR-05-58`): closes the equality gate so the click below actually reaches the handler.
    await parkRemainder();
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    // Every way out of the modal is still there: the X, Esc/backdrop (both gated on the same
    // `dismissible`), and "Cancelar" — and the CTA is no longer spinning.
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "cancel" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "allocations.submitPending" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "submit" })).not.toHaveAttribute("data-loading");

    // And the collector is told what happened, with the draft intact.
    expect(screen.getByRole("alert")).toHaveTextContent("error.server_error");
    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveValue("40");
    expect(onClose).not.toHaveBeenCalled();
    // Nothing was refused, so sending the very same payment again is the right move and the CTA
    // must stay live to allow it (unlike a refusal the server described — see below). Nothing was
    // touched between the two submissions: the resend is byte-identical.
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("stays escapable when the submit handler itself THROWS, and does NOT invite a resend (NIT 5)", async () => {
    // The defensive half of the same guarantee, with the OPPOSITE resend semantics on purpose.
    // Neither production coordinator rejects (see the test above): their `onRejected` returns a
    // resolved outcome, so the only live way into the sheet's `catch` is one of their SUCCESS
    // handlers throwing — which means the server already answered. Either the payment is committed
    // (and `createStorePayment` has no idempotency to absorb an identical second one) or it was
    // refused (and the resend earns the identical refusal). A live CTA is wrong for both.
    const onSubmit = vi.fn<SubmitHandler>(() => Promise.reject(new Error("settle handler blew up")));
    const { onClose } = renderSheet({ onSubmit });

    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    // WO-09 (`FR-05-58`): closes the equality gate so the click below actually reaches the handler.
    await parkRemainder();
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("error.unconfirmed");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("surfaces a refusal that names no line, and only re-arms on a change that could lift it (GRAVE 7 / MENOR 5)", async () => {
    const onSubmit = vi.fn<SubmitHandler>(() => Promise.resolve({ ok: false, error: "STORE_DEBT_EXCEEDED" }));
    renderSheet({ onSubmit });

    // WO-09 (`FR-05-58`): the typed amount matches the line's own amount throughout, so the draft
    // stays fully declared (equality) at every step without needing the "no sé todavía" affordance,
    // which is not what this test is about.
    await typeAmount("40");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    // The coordinator's toast renders behind the modal, so the refusal has to be readable in here.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("error.STORE_DEBT_EXCEEDED"));
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();

    // Retyping a LINE cannot lift this one: the refusal is about the payment's own amount against
    // the store's debt, so the resend would earn the identical refusal. Message and CTA both hold.
    await userEvent.clear(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/));
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "30");
    expect(screen.getByRole("alert")).toHaveTextContent("error.STORE_DEBT_EXCEEDED");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();

    // Changing the amount does: that is the number the refusal was about. Matches the line's own
    // 30.00 so the equality gate is satisfied too, for the same reason as above.
    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));
    await userEvent.clear(screen.getByLabelText(/amountLabel/));
    await userEvent.type(screen.getByLabelText(/amountLabel/), "30");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not re-arm the CTA on "Limpiar" after a refusal only the amount can lift (MENOR 6)', async () => {
    // "Limpiar" is a change to the ALLOCATION draft, and STORE_DEBT_EXCEEDED is a verdict on the
    // amount against the store's debt. Clearing the lines cannot lift it, so re-arming the CTA
    // there only walks the collector into the identical refusal. A line edit is already treated
    // this way; wiping every line is the same change, only bigger.
    const onSubmit = vi.fn<SubmitHandler>(() => Promise.resolve({ ok: false, error: "STORE_DEBT_EXCEEDED" }));
    renderSheet({ onSubmit });

    // WO-09 (`FR-05-58`): matches the line's own amount so the equality gate is already satisfied,
    // which is not what this test is about.
    await typeAmount("40");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("error.STORE_DEBT_EXCEEDED"));

    await userEvent.click(screen.getByRole("button", { name: "allocations.clearAria" }));

    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("error.STORE_DEBT_EXCEEDED");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("waits for the list to come back before pointing at the refused line (BLOQUEANTE 1)", async () => {
    // A refusal retires the sheet's order payload, so a refetch is normally in flight right behind
    // it — and a caller that empties the list outright is the same shape. Spending the reveal on a
    // skeleton loses it for good: the collector is told a line is wrong with nothing pointing at it.
    const view: { current: ReturnType<typeof renderSheet> | null } = { current: null };
    const onSubmit = vi.fn<SubmitHandler>(async () => {
      view.current?.rerender({ ...view.current.props, orders: [], ordersLoading: true });
      return { ok: false, error: "EXCEEDS_ITEM_BASE", orderId: "order-1", orderItemId: "item-2" };
    });
    view.current = renderSheet({ onSubmit });

    // WO-09 (`FR-05-58`): matches the line's own amount so the equality gate is already satisfied.
    await typeAmount("30");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "30");
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(screen.getByText("allocations.loading")).toBeInTheDocument());
    await flushFrame();

    view.current.rerender({ ...view.current.props, orders: [makeOrder()], ordersLoading: false });

    await waitFor(() => expect(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/)).toHaveFocus());
  });

  it("says why the CTA is shut while the list is away, instead of dying silently (BLOQUEANTE 1)", async () => {
    const { rerender, props } = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");

    rerender({ ...props, orders: [], ordersLoading: true });

    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
    expect(screen.getByText("draftWaitingOnOrders")).toHaveAttribute("role", "status");
  });
});

describe("StorePaymentSheet — foco (§4.3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens with the focus on the amount field, not on the allocation entry button", async () => {
    renderSheet();
    // The panel's own focus effect runs BEFORE the modal's; if it fires on the initial open it
    // silently overwrites `initialFocusRef` and Enter takes the collector to the second panel
    // without an amount.
    await waitFor(() => expect(screen.getByLabelText(/amountLabel/)).toHaveFocus());
  });

  it("lands on the first line's amount field when entering the allocation panel", async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();

    // Never the recap's "Editar monto o fecha", which is first in document order and would send
    // the collector straight back where they came from.
    await waitFor(() => expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveFocus());
  });
});

describe("StorePaymentSheet — revelar la línea culpable (GRAVE 3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it('"Revisar" enters the panel and puts the focus on the offending line', async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    // 45.00 against a 40.00 base — an item-level block on the SECOND row, so landing on it can
    // only be the reveal and never the panel's own "focus the first line" behavior.
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "45");
    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));

    await userEvent.click(screen.getByRole("button", { name: "allocations.review" }));

    await waitFor(() => expect(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/)).toHaveFocus());
  });

  it("names a line that is actually rendered when the order-level block also implicates its unrendered rest line", async () => {
    // `buildBlockingLines` inserts the order's rest key FIRST, and this order renders no rest row
    // (`restCeilingMinor` 0) — which is the shape of every assignable order in real data. Taking
    // the map's first key would aim the reveal at a row that does not exist.
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "60");
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "45");
    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));

    await userEvent.click(screen.getByRole("button", { name: "allocations.review" }));

    await waitFor(() => expect(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/)).toHaveFocus());
  });

  it("names a rendered line when the block belongs to an order OTHER than the one last typed into", async () => {
    // The discriminating shape for the renderable-key filter, which the test above does not reach:
    // order 2 is over its own balance (60.00 against 50.00 left) while its product stays inside its
    // own base, so the block is ORDER-level and `buildBlockingLines` keys it by that order's "Resto
    // del pedido" FIRST — a row nothing renders (`restCeilingMinor` 0, the shape of every assignable
    // order in real data). The line last typed into belongs to order 1 and is not blocked, so the
    // preference for it does not apply and the choice falls to the map's own order, which is exactly
    // where an unrendered key wins and the reveal lands on nothing.
    renderSheet({
      debts: [{ currencyCode: "PEN", debtMinor: 30000 }],
      orders: [
        makeOrder({
          orderId: "order-1",
          humanReadableId: "ORD-20260105-01",
          items: [
            {
              itemId: "item-1",
              name: "Nendoroid Miku",
              basePagableMinor: 6000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
        makeOrder({
          orderId: "order-2",
          humanReadableId: "ORD-20260106-01",
          assignableMinor: 5000,
          items: [
            {
              itemId: "item-2",
              name: "Figma Rem",
              basePagableMinor: 6000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
      ],
    });
    await typeAmount("200");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "60");
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "10");
    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));

    await userEvent.click(screen.getByRole("button", { name: "allocations.review" }));

    await waitFor(() => expect(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/)).toHaveFocus());
  });

  it("does not replay an honored reveal on the next entry into the panel (GRAVE 2)", async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "45");
    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));
    await userEvent.click(screen.getByRole("button", { name: "allocations.review" }));
    await waitFor(() => expect(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/)).toHaveFocus());

    // Fix the line, leave, come back. The panel unmounts on "Volver al pago" and remounts with a
    // fresh token counter, so a request left standing is replayed and takes the focus off the
    // first row — on this entry and on every later one, reopening the sheet included.
    await userEvent.clear(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/));
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "10");
    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));
    await openAllocationPanel();

    await waitFor(() => expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveFocus());
    await flushFrame();
    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveFocus();
  });

  it('"Ver" clears the filter before scrolling to the culprit (C11)', async () => {
    const orders: AssignableOrder[] = Array.from({ length: 7 }, (_, index) =>
      makeOrder({
        orderId: `order-${index}`,
        humanReadableId: `ORD-2026010${index}-01`,
        items: [
          {
            itemId: `item-${index}-a`,
            name: `Producto A${index}`,
            basePagableMinor: 60000,
            allocatedMinor: 0,
            settledByDeclaration: false,
            paidDeclared: false,
          },
          {
            itemId: `item-${index}-b`,
            name: `Producto B${index}`,
            basePagableMinor: 40000,
            allocatedMinor: 0,
            settledByDeclaration: false,
            paidDeclared: false,
          },
        ],
        totalCost: 100000,
        assignableMinor: 100000,
      }),
    );
    renderSheet({ orders, debts: [{ currencyCode: "PEN", debtMinor: 1000000 }] });
    await typeAmount("100");
    await openAllocationPanel();
    // 200.00 declared against a 100.00 payment: over the payment, culprit = the line just typed.
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Producto A0/), "200");

    // Hide the culprit behind the filter, then ask for it.
    await userEvent.type(screen.getByRole("searchbox"), "Producto A3");
    expect(screen.queryByLabelText(/allocations\.amountAria.*Producto A0/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "allocations.viewLine" }));

    await waitFor(() => expect(screen.getByLabelText(/allocations\.amountAria.*Producto A0/)).toHaveFocus());
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});

describe("StorePaymentSheet — filas invalidadas por una regla del pedido (MENOR 8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("points every marked line at the one message the block carries", async () => {
    // An order already half paid: each line stays inside its own base, but together they outrun
    // what the ORDER has left — the rule that marks a whole block from a single message.
    renderSheet({ orders: [makeOrder({ allocatedAmountMinor: 5000, assignableMinor: 5000 })] });
    await typeAmount("60");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "30");
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "30");

    // The order-level message is written once, on the block's last line; the earlier lines are
    // marked invalid too and must name that same text rather than announce "invalid" with nothing.
    const first = screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/);
    const last = screen.getByLabelText(/allocations\.amountAria.*Figma Rem/);
    expect(first).toHaveAttribute("aria-invalid", "true");
    const describedBy = first.getAttribute("aria-describedby");
    expect(describedBy).toBe(last.getAttribute("aria-describedby"));
    expect(document.getElementById(describedBy ?? "")).toHaveTextContent("allocations.lineOverOrder");
  });
});

describe("StorePaymentSheet — el pago sin monto (GRAVE 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says the amount is missing instead of claiming the payment is fully assigned", async () => {
    renderSheet();
    await openAllocationPanel();

    expect(fillButtons("Nendoroid Miku")[0]).toHaveAccessibleDescription("allocations.fillDisabledNoAmount");
    expect(screen.getByText("allocations.noAmountNotice")).toBeInTheDocument();
  });
});

describe("StorePaymentSheet — la fila Resto dice el número que escribe (GRAVE 4)", () => {
  beforeEach(() => vi.clearAllMocks());

  function renderSingleProductOrderWithGap() {
    return renderSheet({
      debts: [{ currencyCode: "PEN", debtMinor: 11800 }],
      orders: [
        makeOrder({
          totalCost: 11800,
          assignableMinor: 11800,
          restCeilingMinor: 1800,
          items: [
            {
              itemId: "item-1",
              name: "Nendoroid Miku",
              basePagableMinor: 10000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
      ],
    });
  }

  it("promises the 18.00 gap between the product's base and the order's total, and writes it", async () => {
    renderSingleProductOrderWithGap();
    await typeAmount("118");
    await openAllocationPanel();

    // The row prints no figure of its own (ADR 0027); the promise lives in the accessible name and
    // is the amount actually written — never the order's whole 118.00 balance.
    const restFill = screen.getAllByRole("button", { name: /allocations\.fillAria.*restLine/ })[0];
    expect(restFill).toHaveAccessibleName(expect.stringContaining("18.00"));
    expect(moneyMinorIn(restFill.textContent ?? "")).toEqual([]);

    await userEvent.click(restFill);
    expect(screen.getByLabelText(/allocations\.restAmountAria/)).toHaveValue("18.00");
  });

  it("keeps the promise when the PAYMENT, not the ceiling, is the binding cap (ADR 0027)", async () => {
    renderSingleProductOrderWithGap();
    await typeAmount("5"); // 500 minor units, below the rest line's own 1800 ceiling
    await openAllocationPanel();

    // The GRAVE 4 fix gave the printed figure the order's term but never the payment's, so this row
    // went on reading "Falta S/ 18.00" while the button wrote 5.00. Printing nothing removes the
    // whole class: there is one figure, it is the one written.
    const restFill = screen.getAllByRole("button", { name: /allocations\.fillAria.*restLine/ })[0];
    expect(restFill).toHaveAccessibleName(expect.stringContaining("5.00"));
    expect(moneyMinorIn(restFill.textContent ?? "")).toEqual([]);

    await userEvent.click(restFill);
    expect(screen.getByLabelText(/allocations\.restAmountAria/)).toHaveValue("5.00");
  });

  it("stops counting money typed into it once the row itself is gone (GRAVE 4)", async () => {
    const { onSubmit, props, rerender } = renderSingleProductOrderWithGap();
    await typeAmount("118");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.restAmountAria/), "18");
    expect(screen.getByText(/allocations\.totalsAssigned.*18\.00/)).toBeInTheDocument();

    // An allocation made elsewhere (another tab, the order detail's inline form) takes the order's
    // leftover down to nothing, so the row stops rendering. The 18.00 typed into it must stop
    // counting with it: otherwise the totals bar claims money no visible row accounts for, and the
    // submission carries a line the collector can no longer see, let alone correct.
    const [order] = props.orders;
    rerender({ ...props, orders: [{ ...order, restCeilingMinor: 0 }] });

    expect(screen.queryByLabelText(/allocations\.restAmountAria/)).not.toBeInTheDocument();
    expect(screen.getByText(/allocations\.totalsAssigned.*0\.00/)).toBeInTheDocument();

    // And it is not sent either. Dropping it from the payload was only half the fix: with an empty
    // `allocations` the submit would take the optimistic-close path and register the payment on the
    // store's account, with the 18.00 the collector typed discarded and nothing said (GRAVE 2).
    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

/**
 * ORD-20260305-01 of "Pop Dealer Store", the case that exposed the defect, with the values the dev
 * database really holds (read 2026-08-14) mapped through the query's OWN helpers rather than
 * restated by hand: change what `resolveBasePagableMinor` or `computeRestCeilingMinor` mean and this
 * fixture changes with them instead of quietly preserving a shape the query no longer emits.
 *
 * S/ 244.90 of order, S/ 199.90 already declared against it at order level with no product named,
 * so S/ 45.00 left to take. Its two products' own bases are S/ 59.90 and S/ 185.00, which add up to
 * the order's whole cost: 5.4x the money the order can still receive.
 */
function realPopDealerOrder(): AssignableOrder {
  const totalCost = 24490;
  const allocatedAmountMinor = 19990;
  const assignableMinor = totalCost - allocatedAmountMinor;
  const rows = [
    { id: "cmrsnqx3q002h2nz2pscekgcj", name: "Doflamingo #2237 (One Piece)", unitPrice: 5990, quantity: 1 },
    {
      id: "cmrsnqx3q002i2nz2em4ph4j7",
      name: "Tony Tony Chopper #2340 (Pack Chase) (One Piece)",
      unitPrice: 18500,
      quantity: 1,
    },
  ];
  const items = rows.map((row) => ({
    itemId: row.id,
    name: row.name,
    basePagableMinor: resolveBasePagableMinor(row.unitPrice, row.quantity, totalCost, rows.length),
    allocatedMinor: 0,
    settledByDeclaration: false,
    paidDeclared: false,
  }));

  return {
    orderId: "cmrsnqx0u002g2nz2gozomlkm",
    humanReadableId: "ORD-20260305-01",
    orderDate: new Date("2026-03-05T00:00:00.000Z"),
    currencyCode: "PEN",
    isActive: true,
    totalCost,
    allocatedAmountMinor,
    assignableMinor,
    restCeilingMinor: computeRestCeilingMinor({ assignableMinor, items }),
    items,
  };
}

/**
 * ADR 0027, the two invariants, against the real order.
 *
 * Before it, the panel printed `lineCeilingMinor` (a product's own static base) on a control that
 * wrote `computeFillableMinor` (that base capped by the order's room and by the payment). On this
 * order that is "Falta S/ 59,90" and "Falta S/ 185,00" over a balance of S/ 45,00, and pressing
 * either one wrote 45.00.
 */
describe("StorePaymentSheet — la lista dice lo que escribe (ADR 0027)", () => {
  beforeEach(() => vi.clearAllMocks());

  function renderRealOrder() {
    return renderSheet({ debts: [{ currencyCode: "PEN", debtMinor: 4500 }], orders: [realPopDealerOrder()] });
  }

  it.each(realPopDealerOrder().items)(
    "prints no figure on $name that its own shortcut does not write (I-1)",
    async (item) => {
      renderRealOrder();
      await typeAmount("45");
      await openAllocationPanel();

      const [fill] = fillButtonsFor(item.name);
      const printed = moneyMinorIn(fill.textContent ?? "");

      await userEvent.click(fill);
      const writtenMinor = Math.round(Number(amountFieldFor(item.name).value) * 100);

      // The one figure this control promises is the one it writes, and it reaches the collector
      // through the accessible name. Anything else printed on it has to agree with that number.
      expect(writtenMinor).toBe(4500);
      expect(fill).toHaveAccessibleName(expect.stringContaining("45.00"));
      expect(printed).toEqual(printed.map(() => writtenMinor));
    },
  );

  it("never advertises, across the whole list, more room than the order can take (I-1b)", async () => {
    renderRealOrder();
    await typeAmount("45");
    await openAllocationPanel();

    const printedMinor = screen
      .getAllByRole("listitem")
      .flatMap((row) => moneyMinorIn(row.textContent ?? ""))
      .reduce((sum, amount) => sum + amount, 0);

    // Each row's own ceiling is true line by line and false as a list: with an empty draft every
    // line of an order carries that order's whole room, so N lines advertise N times the space
    // there is. A figure printed in the list partitions what it describes or it does not belong.
    expect(printedMinor).toBeLessThanOrEqual(realPopDealerOrder().assignableMinor);
  });

  it("names the order's own balance once, not once per product", async () => {
    renderRealOrder();
    await typeAmount("45");
    await openAllocationPanel();

    expect(rowsNamingABalance()).toHaveLength(1);
    expect(printedBalancesMinor()).toEqual([realPopDealerOrder().assignableMinor]);
  });

  it("names it once per ORDER, and the M figures partition what those M orders can take", async () => {
    const { props } = renderSheet({
      debts: [{ currencyCode: "PEN", debtMinor: 14500 }],
      orders: [realPopDealerOrder(), makeOrder()],
    });
    await typeAmount("45");
    await openAllocationPanel();

    const printedMinor = printedBalancesMinor().reduce((sum, amount) => sum + amount, 0);
    const listedRoomMinor = props.orders.reduce((sum, order) => sum + order.assignableMinor, 0);

    // The axis of this sheet is multi-order, so these are M different facts, not one figure
    // repeated: one per order, adding up to exactly what those M orders can still take. Read from
    // the props rather than hand-listed, because a hand-listed pair is satisfied by a fixture built
    // to match it and says nothing about the arithmetic.
    expect(rowsNamingABalance()).toHaveLength(props.orders.length);
    expect(printedMinor).toBe(listedRoomMinor);
  });

  it("prints those balances even when they sum ABOVE the store's debt, because they are not it", async () => {
    // The identity this surface must NOT claim. `assignableMinor` is DECLARED money
    // (`totalCost - Order.allocatedAmountMinor`) and the store's debt is PAID money
    // (`totalCost - payments`), so the balances are ≥ the debt and equal it only while every
    // payment on the books is fully assigned. This sheet is what breaks that: it accepts a payment
    // with part of it left over ("Sin asignar"), and one ordinary payment with a remainder is
    // enough. 34.00 of listed room over a 30.00 debt is that state, and the list is still right.
    const { props } = renderSheet({
      debts: [{ currencyCode: "PEN", debtMinor: 3000 }],
      orders: [
        makeOrder({
          totalCost: 2000,
          assignableMinor: 2000,
          items: [
            {
              itemId: "item-1",
              name: "Con resto sin asignar",
              basePagableMinor: 2000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
        makeOrder({
          orderId: "order-2",
          humanReadableId: "ORD-20260106-01",
          totalCost: 1400,
          assignableMinor: 1400,
          items: [
            {
              itemId: "item-2",
              name: "El segundo pedido",
              basePagableMinor: 1400,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
      ],
    });
    await typeAmount("10");
    await openAllocationPanel();

    const printedMinor = printedBalancesMinor().reduce((sum, amount) => sum + amount, 0);

    expect(printedMinor).toBe(3400);
    expect(printedMinor).toBeGreaterThan(props.debts[0].debtMinor);
    // Still a partition of the quantity it IS derived from, which is the whole invariant.
    expect(printedMinor).toBe(props.orders.reduce((sum, order) => sum + order.assignableMinor, 0));
  });

  it("states the balance from PRE-draft data, so typing inside the block never moves it", async () => {
    renderRealOrder();
    await typeAmount("45");
    await openAllocationPanel();
    const before = printedBalancesMinor();

    await userEvent.type(amountFieldFor("Doflamingo #2237"), "10");

    // The figure is deliberately `assignableMinor` and not "what is left of it after the draft".
    // A payment-derived balance is the back door into the defect this ADR closed: the row would
    // print a number that changes when the collector types into a DIFFERENT row, under a word
    // ("Falta") that promises a fact about the order.
    expect(printedBalancesMinor()).toEqual(before);
    expect(before).toEqual([realPopDealerOrder().assignableMinor]);
  });
});

describe("StorePaymentSheet — el pedido que todavía no volvió", () => {
  beforeEach(() => vi.clearAllMocks());

  /** Every prop the panel needs, so one test can drive it into a state the sheet cannot produce. */
  function renderPanelWithoutItsOrders() {
    const lines = buildAllocationLines([makeOrder()]);
    const draft: StorePaymentSheetDraft = {
      paymentAmountMinor: 10000,
      debtMinor: 10000,
      paymentDate: null,
      orders: [],
    };
    return render(
      <StorePaymentAllocationPanel
        lines={lines}
        orders={[]}
        draft={draft}
        validation={validateStorePaymentSheetDraft(draft)}
        values={{}}
        declaredLineKeys={new Set()}
        currencyCode="PEN"
        locale="es"
        paymentAmountMinor={10000}
        paymentDate={null}
        status="ready"
        onRetry={vi.fn()}
        serverRejectedLineKey={null}
        lastEditedLineKey={null}
        onChange={vi.fn()}
        onFill={vi.fn()}
        onToggleDeclared={vi.fn()}
        onClear={vi.fn()}
        onParkRemainder={vi.fn()}
        onUnpark={vi.fn()}
        onEditPayment={vi.fn()}
        onEditDate={vi.fn()}
        revealRequest={null}
        onRevealHandled={vi.fn()}
      />,
    );
  }

  it("does not blame the payment when the ORDER is the thing missing", () => {
    // Rows whose order (or its draft) is not there for one render: what a refetch landing a beat
    // before the draft is rebuilt looks like. The fallback used to be `payment`, so the shortcut
    // told the collector "you already assigned the whole payment" over a payment of 100.00 with
    // nothing assigned against it at all.
    renderPanelWithoutItsOrders();

    expect(fillButtons("Nendoroid Miku")[0]).toHaveAccessibleDescription("allocations.fillDisabledUnavailable");
    expect(visibleTexts("allocations.fillDisabledPayment")).toHaveLength(0);
  });
});

describe("StorePaymentSheet — estados de la lista", () => {
  beforeEach(() => vi.clearAllMocks());

  it("announces the loading state with reserved height", async () => {
    renderSheet({ ordersLoading: true, orders: [] });
    await typeAmount("100");
    await openAllocationPanel();
    expect(screen.getByText("allocations.loading")).toBeInTheDocument();
  });

  it("will not send a draft whose lines are not loaded, silently dropping them", async () => {
    // A refetch (or a failed one) empties the list while typed line amounts survive in the draft.
    // Submitting there would take the no-declarations path and close optimistically, having sent
    // a payment the collector never asked for.
    const { rerender, props } = renderSheet();
    // WO-09 (`FR-05-58`): matches the line's own amount so the equality gate is already satisfied.
    await typeAmount("40");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();

    rerender({ ...props, orders: [], ordersError: true });

    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
  });

  it("offers a retry when the load failed", async () => {
    const { onRetryOrders } = renderSheet({ ordersError: true, orders: [] });
    await typeAmount("100");
    await openAllocationPanel();

    expect(screen.getByText("allocations.errorLoading")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "allocations.retry" }));
    expect(onRetryOrders).toHaveBeenCalledTimes(1);
  });

  it("explains the empty case instead of leaving a blank list", async () => {
    renderSheet({ orders: [] });
    await typeAmount("100");
    await openAllocationPanel();

    expect(screen.getByText("allocations.empty")).toBeInTheDocument();
    expect(screen.getByText("allocations.emptyHint")).toBeInTheDocument();
  });

  it("surfaces a failed refresh instead of passing the old list off as current (MENOR 4)", async () => {
    const { onRetryOrders } = renderSheet({ ordersStale: true });
    await typeAmount("100");

    expect(screen.getByText("staleOrders")).toBeInTheDocument();
    // The retry lives here, next to the notice: the panel's own one is in its error branch, which
    // a kept payload never reaches. This one refetches over the rows, so it costs no draft.
    await userEvent.click(screen.getByRole("button", { name: "allocations.retry" }));
    expect(onRetryOrders).toHaveBeenCalledTimes(1);
  });

  it("does not offer a second retry while one is already flying (MENOR 4)", async () => {
    renderSheet({ ordersStale: true, ordersRefreshing: true });

    expect(screen.getByRole("button", { name: "allocations.retry" })).toBeDisabled();
  });
});

describe("StorePaymentSheet — la lista se encoge bajo un borrador vivo (GRAVE 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPrimaryAction.current = null;
  });

  /**
   * The reachable shape, and the one `ordersStatus` cannot see: an in-place refetch that SUCCEEDS
   * and comes back shorter, because the order was settled from another tab or from the order
   * detail's inline form between the two loads. `ordersLoading` and `ordersError` stay false
   * throughout — the list is perfectly `ready`, it is just missing a row the draft was typed into.
   */
  function shrinkToSecondItemOnly(view: ReturnType<typeof renderSheet>) {
    const [order] = view.props.orders;
    view.rerender({ ...view.props, orders: [{ ...order, items: [order.items[1]] }] });
  }

  it("says which money fell away, and shuts the CTA on it", async () => {
    const view = renderSheet();
    // WO-09 (`FR-05-58`): 70.00 matches the two lines' own sum (40 + 30) so the equality gate is
    // already satisfied, which is not what this test is about.
    await typeAmount("70");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "30");
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();

    shrinkToSecondItemOnly(view);

    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent("droppedDraftLines");
    expect(notice).toHaveTextContent("40.00");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
  });

  it("refuses the optimistic close even if the CTA is fired anyway", async () => {
    // The whole draft's worth of rows goes away, so `allocations` comes out empty and the submit
    // would take the "nothing declared" branch: close on the spot and register the payment on the
    // store's account, with every hand-typed line discarded in silence. Fired through the action's
    // own handler rather than the button, so `disabled` cannot be what makes this pass — and this
    // test deliberately asserts nothing about the notice, so it still holds if the notice and the
    // disabled CTA are ever lost. `handleConfirm` is the last line, and it has to stand alone.
    const view = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");

    view.rerender({ ...view.props, orders: [] });

    await act(async () => {
      capturedPrimaryAction.current?.onClick();
    });

    expect(view.onSubmit).not.toHaveBeenCalled();
    expect(view.onClose).not.toHaveBeenCalled();
  });

  it("clears on its own dismissal, which keeps every line still on screen", async () => {
    const view = renderSheet();
    // WO-09 (`FR-05-58`): 30.00 matches what survives the shrink below (Figma Rem's own 30.00), so
    // the equality gate is satisfied once the vanished line is dismissed, with no park needed.
    await typeAmount("30");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "30");
    shrinkToSecondItemOnly(view);

    await userEvent.click(screen.getByRole("button", { name: "droppedDraftLinesDismiss" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // "Limpiar" would have taken this one with it; only the vanished key is dropped.
    expect(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/)).toHaveValue("30");
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(view.onSubmit.mock.calls[0][0].allocations).toEqual([
      { orderId: "order-1", orderItemId: "item-2", amountMinor: 3000 },
    ]);
  });

  it("says nothing about a line left at zero, which is not money", async () => {
    const view = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "0");
    // WO-09 (`FR-05-58`): 0 is not money, so the whole 100.00 is still unaccounted for — park it
    // the same way an everyday "on account" payment now has to.
    await parkRemainder();

    shrinkToSecondItemOnly(view);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // And the "nothing declared" path is still open to it: no declaration was lost.
    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(view.onSubmit).toHaveBeenCalledTimes(1);
    expect(view.onSubmit.mock.calls[0][0].allocations).toEqual([]);
    expect(view.onClose).toHaveBeenCalledTimes(1);
  });

  it("catches the everyday shape too: the rest row leaving because its own ceiling reached zero", async () => {
    // `shrinkToSecondItemOnly` is the RARE way here — it needs the product itself deleted from the
    // order in another tab. This is the one the collector actually lives: a payment made elsewhere
    // lands against the order, `assignableMinor` drops to what its products can absorb, and
    // `computeRestCeilingMinor` returns 0, so the "Resto del pedido" row stops rendering with
    // money typed into it. The rerender carries the WHOLE shape the query would produce (the
    // order's own `allocatedAmountMinor` / `assignableMinor` move with the ceiling), not just the
    // one field under test.
    const view = renderSheet({
      debts: [{ currencyCode: "PEN", debtMinor: 11800 }],
      orders: [
        makeOrder({
          totalCost: 11800,
          assignableMinor: 11800,
          restCeilingMinor: 1800,
          items: [
            {
              itemId: "item-1",
              name: "Nendoroid Miku",
              basePagableMinor: 10000,
              allocatedMinor: 0,
              settledByDeclaration: false,
              paidDeclared: false,
            },
          ],
        }),
      ],
    });
    await typeAmount("18");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.restAmountAria/), "18");
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();

    const [order] = view.props.orders;
    view.rerender({
      ...view.props,
      debts: [{ currencyCode: "PEN", debtMinor: 10000 }],
      orders: [{ ...order, allocatedAmountMinor: 1800, assignableMinor: 10000, restCeilingMinor: 0 }],
    });

    expect(screen.queryByLabelText(/allocations\.restAmountAria/)).not.toBeInTheDocument();
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent("droppedDraftLines");
    expect(notice).toHaveTextContent("18.00");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "droppedDraftLinesDismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // WO-09 (`FR-05-58`): the dismissed line took its 18.00 with it, so the payment is back to
    // "nothing declared" — park the remainder the same way an everyday on-account payment would.
    await parkRemainder();
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
  });

  it("retires a reveal whose row is not in a settled list, instead of replaying it later (MENOR 5)", async () => {
    // The refusal names a line, and by the time the panel goes looking for it the list has come
    // back without it. Left standing, the request survives: the effect's deps do not change, so
    // nothing retries it, and the panel remounts on the next "Volver al pago" → "Editar" with a
    // fresh token counter, replaying it against a list that now HAS the row — clearing the filter
    // and dragging the focus onto a row nobody asked about.
    const view: { current: ReturnType<typeof renderSheet> | null } = { current: null };
    const onSubmit = vi.fn<SubmitHandler>(async () => {
      const [order] = view.current!.props.orders;
      view.current!.rerender({ ...view.current!.props, orders: [{ ...order, items: [order.items[0]] }] });
      return { ok: false, error: "EXCEEDS_ITEM_BASE", orderId: "order-1", orderItemId: "item-2" };
    });
    view.current = renderSheet({ onSubmit });

    // WO-09 (`FR-05-58`): matches the line's own amount so the equality gate is already satisfied.
    await typeAmount("30");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "30");
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(screen.queryByLabelText(/allocations\.amountAria.*Figma Rem/)).not.toBeInTheDocument());
    await flushFrame();

    // The row comes back on the next refresh, and the collector walks out of the panel and in again.
    view.current.rerender({ ...view.current.props, orders: [makeOrder()] });
    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));
    await openAllocationPanel();
    await flushFrame();

    expect(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/)).not.toHaveFocus();
    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveFocus();
  });
});

describe("StorePaymentSheet — una fila que vuelve SALDADA con dinero dentro (GRAVE 1)", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * The shape `getAssignableOrdersByStore` really produces, and the one the dropped-lines notice
   * cannot see: items are NEVER filtered out (its `.filter` is at ORDER level), so a product paid
   * to 100% keeps coming back with `allocatedMinor === basePagableMinor` and its key stays
   * renderable. The order's own figures move with it, as they would in the query.
   */
  function settleFirstItemFromTheServer(view: ReturnType<typeof renderSheet>) {
    const [order] = view.props.orders;
    view.rerender({
      ...view.props,
      orders: [
        {
          ...order,
          allocatedAmountMinor: 6000,
          assignableMinor: 4000,
          items: [{ ...order.items[0], allocatedMinor: 6000 }, order.items[1]],
        },
      ],
    });
  }

  it("lets the money be taken back out instead of trapping it behind a dead CTA", async () => {
    // The path this branch opened: press "Falta" (which writes exactly the line's remaining base),
    // submit, get no answer after the server committed, and the deferred refetch lands with that
    // product settled while the 60.00 is still in its field.
    const view = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.click(fillButtons("Nendoroid Miku")[0]);
    expect(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/)).toHaveValue("60.00");

    settleFirstItemFromTheServer(view);

    // No dropped-lines notice can rescue this one: the key still renders, it just came back
    // settled. The row says why through its own over-base message, and the CTA is shut.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByText("allocations.settledLabel").length).toBeGreaterThan(0);
    const culprit = screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/);
    expect(culprit).toHaveValue("60.00");
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();

    // The only exits used to be "Limpiar" (which costs every other line) and closing the sheet.
    expect(culprit).toBeEnabled();
    await userEvent.clear(culprit);

    // Emptied, it locks again: a settled line still takes no NEW money.
    expect(culprit).toHaveAttribute("readonly");
    // WO-09 (`FR-05-58`): clearing the field left the whole 100.00 unaccounted for again — park it,
    // exactly the recovery path "the money can still be taken back out" now goes through.
    await parkRemainder();
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
  });

  it("locks the emptied row without dropping the focus out of the modal (NIT A)", async () => {
    // The lock snaps shut ON the keystroke that empties the field, with the caret still inside it.
    // `disabled` would move that focus to `<body>`, and `ModalDialog`'s trap only intercepts `Tab`
    // when the active element is the modal's first or last focusable — so from `<body>` the next
    // `Tab` walks into the page behind the (non-portalled) modal. `readOnly` keeps the caret.
    const view = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.click(fillButtons("Nendoroid Miku")[0]);
    settleFirstItemFromTheServer(view);

    const culprit = screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/);
    await userEvent.clear(culprit);

    // jsdom never blurs an element that turns `disabled`, so the symptom itself cannot be asserted
    // here. What can is the property that produces it: the locked field is `readOnly` and NEVER
    // `disabled`. Whoever swaps it back for the shorter attribute gets this test in the face.
    expect(culprit).not.toBeDisabled();
    expect(culprit).toHaveAttribute("readonly");

    // Locked all the same: keystrokes reaching it write nothing.
    culprit.focus();
    await userEvent.keyboard("5");
    expect(culprit).toHaveValue("");
  });

  it("keeps a legacy settled-by-declaration row correctable too (NIT 6)", async () => {
    // `settledByDeclaration` settles a row whose base is NOT exhausted, so `isItemOverRemainingBase`
    // stays silent: an amount typed before the flag arrived would otherwise ride into the payload
    // with no error, no message and no field to correct it in.
    const view = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "10");

    const [order] = view.props.orders;
    view.rerender({
      ...view.props,
      orders: [{ ...order, items: [{ ...order.items[0], settledByDeclaration: true }, order.items[1]] }],
    });

    const culprit = screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/);
    expect(culprit).toBeEnabled();
    await userEvent.clear(culprit);
    expect(culprit).toHaveAttribute("readonly");

    // WO-09 (`FR-05-58`): clearing the line left the whole 100.00 unaccounted for again.
    await parkRemainder();
    await userEvent.click(screen.getByRole("button", { name: "submit" }));
    expect(view.onSubmit.mock.calls[0][0].allocations).toEqual([]);
  });
});

describe("StorePaymentSheet — multimoneda", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a currency selector that filters the eligible lines", async () => {
    renderSheet({
      debts: [
        { currencyCode: "PEN", debtMinor: 10000 },
        { currencyCode: "USD", debtMinor: 5000 },
      ],
      orders: [
        makeOrder({ orderId: "order-pen", currencyCode: "PEN" }),
        makeOrder({ orderId: "order-usd", currencyCode: "USD", items: [] }),
      ],
    });

    expect(screen.getByLabelText(/currencyLabel/)).toBeInTheDocument();
    await typeAmount("50");
    await openAllocationPanel();
    expect(screen.getByText("Nendoroid Miku")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));
    await userEvent.selectOptions(screen.getByLabelText(/currencyLabel/), "USD");
    await openAllocationPanel();
    expect(screen.queryByText("Nendoroid Miku")).not.toBeInTheDocument();
  });
});

describe("StorePaymentSheet — filtro (C11)", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeBigStore() {
    const orders: AssignableOrder[] = Array.from({ length: 7 }, (_, index) => ({
      ...makeOrder({
        orderId: `order-${index}`,
        humanReadableId: `ORD-2026010${index}-01`,
        items: [
          {
            itemId: `item-${index}-a`,
            name: `Producto A${index}`,
            basePagableMinor: 6000,
            allocatedMinor: 0,
            settledByDeclaration: false,
            paidDeclared: false,
          },
          {
            itemId: `item-${index}-b`,
            name: `Producto B${index}`,
            basePagableMinor: 4000,
            allocatedMinor: 0,
            settledByDeclaration: false,
            paidDeclared: false,
          },
        ],
      }),
    }));
    return orders;
  }

  it("keeps every line of a matched order, not just the matching one", async () => {
    renderSheet({ orders: makeBigStore(), debts: [{ currencyCode: "PEN", debtMinor: 100000 }] });
    await typeAmount("100");
    await openAllocationPanel();

    const search = screen.getByRole("searchbox");
    await userEvent.type(search, "Producto A3");

    const list = screen.getByRole("list");
    expect(within(list).getByText("Producto A3")).toBeInTheDocument();
    // Its sibling under the same order survives even though it does not match.
    expect(within(list).getByText("Producto B3")).toBeInTheDocument();
    expect(within(list).queryByText("Producto A2")).not.toBeInTheDocument();
  });

  it("matches on the order reference too, which each row shows", async () => {
    renderSheet({ orders: makeBigStore(), debts: [{ currencyCode: "PEN", debtMinor: 100000 }] });
    await typeAmount("100");
    await openAllocationPanel();

    await userEvent.type(screen.getByRole("searchbox"), "ORD-20260105-01");

    const list = screen.getByRole("list");
    expect(within(list).getByText("Producto A5")).toBeInTheDocument();
    expect(within(list).queryByText("Producto A1")).not.toBeInTheDocument();
  });

  it("offers a way out when nothing matches", async () => {
    renderSheet({ orders: makeBigStore(), debts: [{ currencyCode: "PEN", debtMinor: 100000 }] });
    await typeAmount("100");
    await openAllocationPanel();

    await userEvent.type(screen.getByRole("searchbox"), "no existe");
    expect(screen.getByText(/allocations\.searchEmpty/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "allocations.searchClear" }));
    expect(screen.getByText("Producto A0")).toBeInTheDocument();
  });
});

describe("StorePaymentSheet — cobertura declarada", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * B2, the defect that would have made this feature counter-productive. If a marked product's
   * amount field went read-only, the money would go into "Resto del pedido" instead, which writes
   * an allocation naming NO product: the mark would manufacture exactly the undetailed money it
   * exists to reduce. Editability follows the arithmetic and nothing else.
   */
  it("keeps a marked product's amount field editable, and its money in the payload", async () => {
    const order = makeOrder({
      items: [
        {
          itemId: "item-1",
          name: "Nendoroid Miku",
          basePagableMinor: 6000,
          allocatedMinor: 0,
          settledByDeclaration: false,
          paidDeclared: true,
        },
      ],
      restCeilingMinor: 0,
    });
    const { onSubmit } = renderSheet({ orders: [order] });

    // WO-09 (`FR-05-58`): matches the line's own typed amount so the equality gate is already
    // satisfied, with no park needed for a test that is about the field staying editable.
    await typeAmount("20.00");
    await openAllocationPanel();

    const [amountField] = screen.getAllByLabelText(/allocations\.amountAria/);
    expect(amountField).not.toHaveAttribute("readonly");

    await userEvent.type(amountField, "20.00");
    await userEvent.click(screen.getByRole("button", { name: /submit/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].allocations).toEqual([
      { orderId: "order-1", orderItemId: "item-1", amountMinor: 2000 },
    ]);
  });

  it("leaves Sin asignar exactly where it was when a product is marked", async () => {
    const order = makeOrder({
      items: [
        {
          itemId: "item-1",
          name: "Sin precio",
          basePagableMinor: null,
          allocatedMinor: 0,
          settledByDeclaration: false,
          paidDeclared: false,
        },
      ],
      restCeilingMinor: 0,
    });
    const { onSubmit } = renderSheet({ orders: [order] });

    await typeAmount("50.00");
    await openAllocationPanel();

    const before = screen.getAllByText(/allocations\.totalsUnassigned/).length;
    await userEvent.click(screen.getAllByRole("button", { name: /allocations\.markPaidAria/ })[0]);
    // The mark moves no money: the totals line is unaffected by it, before parking touches it too.
    expect(screen.getAllByText(/allocations\.totalsUnassigned/).length).toBe(before);

    // WO-09 (`FR-05-58`): the mark alone never satisfies the equality gate (it is a different axis,
    // see the two axes' own doc comment) — the unpriced product has nowhere to receive money, so
    // the only way to submit is to park the whole amount on purpose.
    await parkRemainder();
    await userEvent.click(screen.getByRole("button", { name: /submit/ }));

    // Marks travel on their own axis: no allocation line, and the money is untouched.
    expect(onSubmit.mock.calls[0][0].allocations).toEqual([]);
    expect(onSubmit.mock.calls[0][0].declarePaidItemIds).toEqual(["item-1"]);
    expect(onSubmit.mock.calls[0][0].parkedAmountMinor).toBe(5000);
  });

  it("offers the mark only where no price is on record", async () => {
    // Where the number IS known, using the number is strictly more informative than a claim, so
    // that line keeps its "Falta S/ X" fill button and no mark control at all.
    const order = makeOrder({
      items: [
        {
          itemId: "priced",
          name: "Con precio",
          basePagableMinor: 6000,
          allocatedMinor: 0,
          settledByDeclaration: false,
          paidDeclared: false,
        },
        {
          itemId: "unpriced",
          name: "Sin precio",
          basePagableMinor: null,
          allocatedMinor: 0,
          settledByDeclaration: false,
          paidDeclared: false,
        },
      ],
      restCeilingMinor: 0,
    });
    renderSheet({ orders: [order] });

    await typeAmount("50.00");
    await openAllocationPanel();

    expect(fillButtons("Con precio").length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: /allocations\.markPaidAria.*Con precio/ })).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: /allocations\.markPaidAria/ }).length).toBeGreaterThan(0);
  });

  it("does not re-declare a product that already carries the mark", async () => {
    const order = makeOrder({
      items: [
        {
          itemId: "item-1",
          name: "Sin precio",
          basePagableMinor: null,
          allocatedMinor: 0,
          settledByDeclaration: false,
          paidDeclared: true,
        },
      ],
      restCeilingMinor: 0,
    });
    const { onSubmit } = renderSheet({ orders: [order] });

    await typeAmount("50.00");
    // WO-09 (`FR-05-58`): nothing to declare here (the product is already marked server-side, so it
    // is not re-declared, and it has no price to receive money against) — park the whole amount, the
    // same "on account" path an everyday payment with nothing to name now goes through explicitly.
    await openAllocationPanel();
    await parkRemainder();
    await userEvent.click(screen.getByRole("button", { name: /submit/ }));

    expect(onSubmit.mock.calls[0][0].declarePaidItemIds).toEqual([]);
  });
});

/**
 * The explicit "no sé todavía" affordance itself (WO-09, `FR-05-58`/`FR-05-60`, `ADR 0033`): the
 * client mirror of the store-level equality rule, and the one control that lets a draft with money
 * left over become submittable without naming a product.
 */
describe("StorePaymentSheet — no sé todavía (WO-09)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers the affordance next to the remaining amount, and choosing it enables submit and shows the parked amount", async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");

    // Leftover money (60.00), nothing parked yet: the CTA is shut and the affordance is offered,
    // naming the exact amount it would park in its own accessible name.
    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
    const parkButton = screen.getByRole("button", { name: /allocations\.parkRemainderAria/ });
    expect(parkButton).toHaveAccessibleName(expect.stringContaining("60.00"));
    expect(screen.getByText(/allocations\.totalsUnassigned.*60\.00/)).toBeInTheDocument();

    await userEvent.click(parkButton);

    // Choosing it: the submit control opens up, "Sin asignar" gives way to "Aparcado", and the
    // affordance itself is replaced by its own undo.
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
    expect(screen.getByText(/allocations\.totalsParked.*60\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/allocations\.totalsUnassigned/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /allocations\.parkRemainderAria/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "allocations.unparkAria" })).toBeInTheDocument();
  });

  it("submits the parked figure alongside the named allocations", async () => {
    const { onSubmit } = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    await parkRemainder();

    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onSubmit.mock.calls[0][0].allocations).toEqual([
      { orderId: "order-1", orderItemId: "item-1", amountMinor: 4000 },
    ]);
    expect(onSubmit.mock.calls[0][0].parkedAmountMinor).toBe(6000);
  });

  it("resets the parked choice, and shuts the CTA again, once the amount changes afterward", async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    await parkRemainder();
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();

    // The remainder a park closed was about THIS amount. A different amount has a different
    // remainder, so the choice has to be re-made on purpose rather than silently reinterpreted.
    await userEvent.click(screen.getByRole("button", { name: "allocations.back" }));
    await userEvent.clear(screen.getByLabelText(/amountLabel/));
    await userEvent.type(screen.getByLabelText(/amountLabel/), "50");

    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
    await openAllocationPanel();
    expect(screen.getByText(/allocations\.totalsUnassigned/)).toBeInTheDocument();
    expect(screen.queryByText(/allocations\.totalsParked/)).not.toBeInTheDocument();
  });

  it("resets the parked choice once a line is edited afterward, not just the amount", async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    await parkRemainder();
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();

    // Typing into ANY line moves the remainder the park was about, not only the amount field.
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Figma Rem/), "1");

    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
    expect(screen.getByText(/allocations\.totalsUnassigned/)).toBeInTheDocument();
  });

  it('undoes a park choice through "Quitar", so the collector can name the money after all', async () => {
    renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "40");
    await parkRemainder();
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "allocations.unparkAria" }));

    expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
    expect(screen.getByText(/allocations\.totalsUnassigned.*60\.00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /allocations\.parkRemainderAria/ })).toBeInTheDocument();
  });

  it("offers no affordance once the draft already overshoots the payment", async () => {
    renderSheet();
    await typeAmount("50");
    await openAllocationPanel();
    await userEvent.type(screen.getByLabelText(/allocations\.amountAria.*Nendoroid Miku/), "60");

    // Over the payment is a different mistake (lower a line), never something to park.
    expect(screen.queryByRole("button", { name: /allocations\.parkRemainderAria/ })).not.toBeInTheDocument();
  });

  it("can submit fully parked, with nothing named against any order (spec §3.4)", async () => {
    const { onSubmit, onClose } = renderSheet();
    await typeAmount("100");
    await openAllocationPanel();
    await parkRemainder();

    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onSubmit.mock.calls[0][0].allocations).toEqual([]);
    expect(onSubmit.mock.calls[0][0].parkedAmountMinor).toBe(10000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
