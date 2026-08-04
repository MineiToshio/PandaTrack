import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => {
  const translate = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;
  // `t.rich` is what the attribution line uses; the stub renders the chunks so the link's text is
  // assertable without pulling the real message catalog into a unit test.
  translate.rich = (key: string, tags: Record<string, (chunks: string) => unknown>) =>
    tags.link ? tags.link(key) : key;
  // The group cards resolve category names through `useStoreProductTypeName`, which asks the
  // namespace whether it holds a key before reading it.
  translate.has = () => true;
  return {
    useTranslations: () => translate,
    useLocale: () => "es",
  };
});

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

const fetchTodayRateMock = vi.fn();
vi.mock("@/lib/fx/exchangeRates", () => ({
  fetchTodayRate: (from: string, to: string) => fetchTodayRateMock(from, to),
}));

import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import IntakeReviewScreen from "../IntakeReviewScreen";

function field<T>(value: T | null, source: "read" | "assumed" | null) {
  return { value, source };
}

function buildDraft(overrides: Partial<ImageIntakeDraft> = {}): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: "clh1234567890abcdefghijkl",
      name: field("Pop Dealer", "read"),
      phone: field(null, null),
      candidates: [],
    },
    currency: field("PEN", "read"),
    orderDate: field("2026-07-20", "read"),
    totalCost: field(48000, "read"),
    groups: [
      {
        sourcePhrase: "el pack chase de Gojo",
        reason: "split",
        doubtful: false,
        priceSplit: "explicit-unit",
        products: [
          { name: "Gojo", unitPrice: 9000, suggestedProductTypeKey: null, referenceUrl: null },
          { name: "Gojo (chase)", unitPrice: 6000, suggestedProductTypeKey: null, referenceUrl: null },
        ],
      },
    ],
    payments: [],
    delivery: null,
    warnings: [],
    ...overrides,
  };
}

const STORE_OPTIONS = [{ id: "clh1234567890abcdefghijkl", name: "Pop Dealer" }];

/** Stands in for the live catalog the page reads and hands to the group cards. */
const PRODUCT_TYPE_KEYS = ["figures", "manga"];

/** The draft fixture is priced in PEN, so this base makes every default render a same-currency one. */
const BASE_CURRENCY = "PEN";

function renderScreen(draft: ImageIntakeDraft, baseCurrencyCode = BASE_CURRENCY) {
  return render(
    <IntakeReviewScreen
      initialDraft={draft}
      baseCurrencyCode={baseCurrencyCode}
      storeOptions={STORE_OPTIONS}
      productTypeKeys={PRODUCT_TYPE_KEYS}
      isSaving={false}
      onSave={vi.fn()}
      onManualClick={vi.fn()}
      spentPhotoCount={2}
      remainingPhotos={null}
      onAddProductSheet={vi.fn()}
    />,
  );
}

/**
 * The screen renders its actions twice, as the repository's long forms do: an inline footer that
 * only shows from `md` up, and a fixed bar that only shows below it. jsdom loads no stylesheet, so
 * both are reachable here and every query has to say which one it means. Document order is footer
 * first, bar second.
 */
function submitButtons() {
  return screen.getAllByRole("button", { name: "create.submit" });
}

function desktopSubmit(): HTMLElement {
  return submitButtons()[0];
}

function mobileSubmit(): HTMLElement {
  return submitButtons()[1];
}

function manualButtons() {
  return screen.getAllByRole("button", { name: "manual" });
}

beforeEach(() => {
  fetchTodayRateMock.mockReset();
  fetchTodayRateMock.mockResolvedValue({ ok: true, rate: 3.75, date: "2026-07-29" });
});

describe("IntakeReviewScreen", () => {
  it("renders a clean draft as a document: no attribute is a form control", () => {
    renderScreen(buildDraft());

    expect(screen.queryByLabelText(/fields.orderDate/)).toBeNull();
    expect(screen.queryByLabelText(/fields.currency/)).toBeNull();
    expect(screen.queryByLabelText(/fields.total/)).toBeNull();
  });

  it("uses the clean header when nothing needs a second look", () => {
    renderScreen(buildDraft());
    expect(screen.getByText("headerClean")).toBeTruthy();
  });

  it("turns an assumed currency into a marked, editable control", () => {
    renderScreen(buildDraft({ currency: field("PEN", "assumed") }));

    expect(screen.getByLabelText(/fields.currency/)).toBeTruthy();
    expect(screen.getByText("provenance.assumed")).toBeTruthy();
  });

  it("turns a missing total into a marked, editable control", () => {
    renderScreen(buildDraft({ totalCost: field(null, null) }));

    // Scoped to the total's own label: the delivery window is always a control when the chat did
    // not carry one, so more than one "missing" marker on screen is the expected state.
    const totalLabel = screen.getByLabelText(/fields.total/);
    expect(totalLabel).toBeTruthy();
    expect(screen.getAllByText("provenance.missing").length).toBeGreaterThan(0);
  });

  it("always offers the delivery window as a control, since a chat rarely carries one", () => {
    renderScreen(buildDraft());

    expect(screen.getByLabelText(/fields.deliveryRange/)).toBeTruthy();
  });

  it("does not count the absent delivery window as a doubt to resolve", () => {
    // The header promises "review N things"; an optional field the chat almost never carries would
    // inflate that number on nearly every draft and make the promise dishonest.
    renderScreen(buildDraft());

    expect(screen.getByText("headerClean")).toBeTruthy();
  });

  it("counts the outstanding work in the header when something was assumed", () => {
    renderScreen(buildDraft({ currency: field("PEN", "assumed") }));

    const header = screen.getByText(/headerWithDoubts/);
    expect(header.textContent).toContain('"doubtCount":1');
    expect(header.textContent).toContain('"productCount":2');
  });

  it("prices every amount in the draft's own currency, never in a built-in default", () => {
    const { container } = renderScreen(
      buildDraft({
        currency: field("PEN", "read"),
        payments: [{ amount: field(12000, "read"), paidAt: field("2026-07-21", "read") }],
      }),
    );

    expect(screen.getAllByText("480.00 PEN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("120.00 PEN").length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain("USD");
  });

  it("prices amounts in an assumed currency too, with the assumed marker beside it", () => {
    renderScreen(buildDraft({ currency: field("PEN", "assumed") }));

    expect(screen.getByText("provenance.assumed")).toBeTruthy();
    expect(screen.getAllByText("480.00 PEN").length).toBeGreaterThan(0);
  });

  it("shows a shipping cost read from the chat and says it is not saved with the order", () => {
    renderScreen(
      buildDraft({
        delivery: {
          expectedFrom: field("2026-08-01", "read"),
          expectedTo: field("2026-08-15", "read"),
          cost: field(2500, "read"),
        },
      }),
    );

    expect(screen.getByText("delivery.cost")).toBeTruthy();
    expect(screen.getByText("25.00 PEN")).toBeTruthy();
    expect(screen.getByText("delivery.costNotSaved")).toBeTruthy();
  });

  it("shows no shipping cost row when the chat carried none", () => {
    renderScreen(buildDraft());

    expect(screen.queryByText("delivery.cost")).toBeNull();
  });

  it("ends on the same literal CTA as the manual form, plus the way out to it", () => {
    renderScreen(buildDraft());

    // One CTA per bar, and one way out per bar: the two are the same pair rendered at two widths.
    expect(submitButtons()).toHaveLength(2);
    expect(manualButtons()).toHaveLength(2);
  });

  it("hands the confirmed draft, not the extracted one, to the save handler", () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft()}
        baseCurrencyCode={BASE_CURRENCY}
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

    desktopSubmit().click();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].store.matchedStoreId).toBe("clh1234567890abcdefghijkl");
  });

  it("hands the confirmed draft, not the extracted one, to the manual-form exit too", () => {
    const onManualClick = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft({ orderDate: field(null, null) })}
        baseCurrencyCode={BASE_CURRENCY}
        storeOptions={STORE_OPTIONS}
        productTypeKeys={PRODUCT_TYPE_KEYS}
        isSaving={false}
        onSave={vi.fn()}
        onManualClick={onManualClick}
        spentPhotoCount={2}
        remainingPhotos={null}
        onAddProductSheet={vi.fn()}
      />,
    );

    // Edit a field the review screen exposes as a control before leaving, so the assertion below
    // can only pass if the manual-click handler received the current (edited) draft, not the one
    // the screen was first rendered with.
    fireEvent.change(screen.getByLabelText(/fields.orderDate/), { target: { value: "2026-08-01" } });

    manualButtons()[0].click();

    expect(onManualClick).toHaveBeenCalledTimes(1);
    expect(onManualClick.mock.calls[0][0].orderDate.value).toBe("2026-08-01");
  });
});

describe("IntakeReviewScreen exchange rate", () => {
  it("shows no exchange-rate row when the order is already in the base currency", () => {
    renderScreen(buildDraft());

    expect(screen.queryByLabelText(/fx.label/)).toBeNull();
    expect(fetchTodayRateMock).not.toHaveBeenCalled();
  });

  it("shows the row prefilled with today's rate when the order is in a foreign currency", async () => {
    renderScreen(buildDraft({ currency: field("USD", "read") }), "PEN");

    const input = await screen.findByLabelText(/fx.label/);
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("3.75"));
    expect(fetchTodayRateMock).toHaveBeenCalledWith("USD", "PEN");
    // The rate's own date is on screen, so the collector can tell how current the figure is.
    expect(screen.getByText(/fx.rateDate/)).toBeTruthy();
  });

  it("credits the rate provider wherever a fetched rate is shown", async () => {
    renderScreen(buildDraft({ currency: field("USD", "read") }), "PEN");

    expect(await screen.findByRole("link", { name: "attribution" })).toBeTruthy();
  });

  it("leaves the field empty and explains itself when the provider cannot serve the pair", async () => {
    fetchTodayRateMock.mockResolvedValue({ ok: false, reason: "missing-pair" });
    renderScreen(buildDraft({ currency: field("USD", "read") }), "PEN");

    const input = await screen.findByLabelText(/fx.label/);
    await waitFor(() => expect(screen.getByText(/fx.unavailable/)).toBeTruthy());
    // Never a number the screen made up: an unverifiable rate would be exactly the invention this
    // review step exists to prevent.
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("still saves, without a rate, when the lookup failed and the collector left the field empty", async () => {
    fetchTodayRateMock.mockResolvedValue({ ok: false, reason: "network" });
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft({ currency: field("USD", "read") })}
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

    await screen.findByText(/fx.unavailable/);
    desktopSubmit().click();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][1]).toBeNull();
  });

  it("hands the collector's edited rate to the save handler, not the fetched one", async () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft({ currency: field("USD", "read") })}
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

    const input = await screen.findByLabelText(/fx.label/);
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("3.75"));
    fireEvent.change(input, { target: { value: "3.812345" } });

    desktopSubmit().click();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][1]).toBe(3.812345);
  });

  it("refuses to save a rate the order schema would reject, instead of dropping it in silence", async () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft({ currency: field("USD", "read") })}
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

    const input = await screen.findByLabelText(/fx.label/);
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("3.75"));
    fireEvent.change(input, { target: { value: "no es un número" } });

    fireEvent.click(desktopSubmit());

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/fx.invalid/)).toBeTruthy();
  });

  it("passes a null rate for a same-currency order so nothing spurious is stored", () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft()}
        baseCurrencyCode={BASE_CURRENCY}
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

    desktopSubmit().click();

    expect(onSave.mock.calls[0][1]).toBeNull();
  });
});

/**
 * The offer to attach a product-page screenshot. It must name the row it is about, state what a
 * second read costs, and never stand between the collector and the save button.
 */
describe("IntakeReviewScreen: product page screenshot offer", () => {
  const LINKED_URL = "https://www.mercadolibre.com.pe/p/MPE123";

  function buildHostNamedDraft(): ImageIntakeDraft {
    return buildDraft({
      groups: [
        {
          sourcePhrase: "quiero este",
          reason: "sealed",
          doubtful: false,
          priceSplit: "explicit-unit",
          products: [
            { name: "mercadolibre.com.pe", unitPrice: 48000, suggestedProductTypeKey: null, referenceUrl: LINKED_URL },
          ],
        },
      ],
    });
  }

  function renderOffer(
    draft: ImageIntakeDraft,
    props: { spentPhotoCount?: number; remainingPhotos?: number | null; onAddProductSheet?: () => void } = {},
  ) {
    render(
      <IntakeReviewScreen
        initialDraft={draft}
        baseCurrencyCode={BASE_CURRENCY}
        storeOptions={STORE_OPTIONS}
        productTypeKeys={PRODUCT_TYPE_KEYS}
        isSaving={false}
        onSave={vi.fn()}
        onManualClick={vi.fn()}
        spentPhotoCount={props.spentPhotoCount ?? 2}
        remainingPhotos={props.remainingPhotos ?? null}
        onAddProductSheet={props.onAddProductSheet ?? vi.fn()}
      />,
    );
  }

  it("says nothing when every product was named from the conversation", () => {
    renderOffer(buildDraft());

    expect(screen.queryByText(/productSheet\.title/)).toBeNull();
    expect(screen.queryByRole("button", { name: /productSheet\.cta/ })).toBeNull();
  });

  it("names the product whose name is only the link's host", () => {
    renderOffer(buildHostNamedDraft());

    expect(screen.getByText(/productSheet\.title/)).toBeTruthy();
    expect(screen.getByText(/productSheet\.reasonHostOnly.*mercadolibre\.com\.pe/)).toBeTruthy();
  });

  it("uses the doubtful wording, with the host, for a linked product in a doubtful group", () => {
    const draft = buildDraft({
      groups: [
        {
          sourcePhrase: "quiero este",
          reason: "split",
          doubtful: true,
          priceSplit: "explicit-unit",
          products: [
            { name: "Figura Gojo?", unitPrice: 48000, suggestedProductTypeKey: null, referenceUrl: LINKED_URL },
          ],
        },
      ],
    });
    renderOffer(draft);

    const reason = screen.getByText(/productSheet\.reasonDoubtful/);
    expect(reason.textContent).toContain("Figura Gojo?");
    // Labelled by the bare host, matching how the row's own link is labelled.
    expect(reason.textContent).toContain("mercadolibre.com.pe");
  });

  it("states the photo cost of reading again, including the balance when a cap applies", () => {
    renderOffer(buildHostNamedDraft(), { spentPhotoCount: 3, remainingPhotos: 10 });

    const cost = screen.getByText(/productSheet\.costWithBalance/);
    // The three photos already spent, and the seven left after that read.
    expect(cost.textContent).toContain('"count":3');
    expect(cost.textContent).toContain('"remaining":7');
  });

  it("omits every photo figure for an uncapped collector", () => {
    renderOffer(buildHostNamedDraft(), { spentPhotoCount: 3, remainingPhotos: null });

    expect(screen.getByText(/productSheet\.cost:/)).toBeTruthy();
    expect(screen.queryByText(/productSheet\.costWithBalance/)).toBeNull();
  });

  it("returns to the attach surface when the offer is accepted", () => {
    const onAddProductSheet = vi.fn();
    renderOffer(buildHostNamedDraft(), { onAddProductSheet });

    screen.getByRole("button", { name: /productSheet\.cta/ }).click();

    expect(onAddProductSheet).toHaveBeenCalledTimes(1);
  });

  it("drops the button, not the notice, when the balance cannot pay for another read", () => {
    renderOffer(buildHostNamedDraft(), { spentPhotoCount: 3, remainingPhotos: 5 });

    expect(screen.queryByRole("button", { name: /productSheet\.cta/ })).toBeNull();
    const cost = screen.getByText(/productSheet\.costUnaffordable/);
    expect(cost.textContent).toContain('"needed":4');
    expect(cost.textContent).toContain('"remaining":2');
  });

  it("never blocks the save: the primary CTA is still there and still enabled", () => {
    renderOffer(buildHostNamedDraft());

    const submit = desktopSubmit();
    expect(submit.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(/productSheet\.optional/)).toBeTruthy();
  });
});

/**
 * The actions at the two widths. The screen is a long form, so it follows the repository's form
 * footer pattern rather than the detail-screen rail: inline at the end of the document from `md`
 * up, fixed to the viewport bottom below it.
 */
describe("IntakeReviewScreen action bars", () => {
  it("puts the desktop actions inline at the end of the document, hidden below md", () => {
    renderScreen(buildDraft());

    const footer = desktopSubmit().parentElement;
    expect(footer?.className).toContain("hidden");
    expect(footer?.className).toContain("md:flex");
    // Right-aligned, so the primary sits on the trailing edge with the way out before it.
    expect(footer?.className).toContain("md:justify-end");
    expect(footer?.className).not.toContain("fixed");
  });

  it("keeps the fixed bar for mobile only, hidden from md up", () => {
    renderScreen(buildDraft());

    const bar = mobileSubmit().parentElement;
    expect(bar?.className).toContain("fixed");
    expect(bar?.className).toContain("md:hidden");
  });

  /**
   * `hidden` and `md:hidden` are `display: none`, which drops the subtree from the accessibility
   * tree as well as from view. Hiding a bar with opacity or off-screen positioning would leave a
   * second "Crear pedido" announced to a screen reader at every width.
   */
  it("hides each bar with display, so only one primary is ever in the accessibility tree", () => {
    renderScreen(buildDraft());

    const [footer, bar] = [desktopSubmit().parentElement, mobileSubmit().parentElement];
    expect(footer?.className.split(/\s+/)).toContain("hidden");
    expect(bar?.className.split(/\s+/)).toContain("md:hidden");
    expect(footer?.className).not.toContain("sr-only");
    expect(bar?.className).not.toContain("sr-only");
  });

  it("reserves the strip under the content for the fixed bar only while that bar exists", () => {
    const { container } = renderScreen(buildDraft());

    const root = container.firstElementChild;
    expect(root?.className).toContain("pb-[calc(96px+env(safe-area-inset-bottom))]");
    expect(root?.className).toContain("md:pb-0");
  });

  it("runs the same save from either bar, with the same draft", () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft()}
        baseCurrencyCode={BASE_CURRENCY}
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

    desktopSubmit().click();
    mobileSubmit().click();

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[0]).toEqual(onSave.mock.calls[1]);
  });

  it("runs the same way out from either bar, with the draft as edited", () => {
    const onManualClick = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft({ orderDate: field(null, null) })}
        baseCurrencyCode={BASE_CURRENCY}
        storeOptions={STORE_OPTIONS}
        productTypeKeys={PRODUCT_TYPE_KEYS}
        isSaving={false}
        onSave={vi.fn()}
        onManualClick={onManualClick}
        spentPhotoCount={2}
        remainingPhotos={null}
        onAddProductSheet={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/fields.orderDate/), { target: { value: "2026-08-01" } });
    const [inlineManual, stickyManual] = manualButtons();
    inlineManual.click();
    stickyManual.click();

    expect(onManualClick).toHaveBeenCalledTimes(2);
    expect(onManualClick.mock.calls[0][0].orderDate.value).toBe("2026-08-01");
    expect(onManualClick.mock.calls[1][0].orderDate.value).toBe("2026-08-01");
  });

  it("puts both bars in the saving state together, so neither can be pressed twice", () => {
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft()}
        baseCurrencyCode={BASE_CURRENCY}
        storeOptions={STORE_OPTIONS}
        productTypeKeys={PRODUCT_TYPE_KEYS}
        isSaving
        onSave={vi.fn()}
        onManualClick={vi.fn()}
        spentPhotoCount={2}
        remainingPhotos={null}
        onAddProductSheet={vi.fn()}
      />,
    );

    const saving = screen.getAllByRole("button", { name: "saving" });
    expect(saving).toHaveLength(2);
    for (const button of saving) {
      expect(button.getAttribute("aria-busy")).toBe("true");
    }
  });

  /**
   * The rate is one piece of state shared by both bars, so a refusal raised from one has to be the
   * refusal the other raises too: a rate the schema would reject must never slip through because
   * the collector happened to press the button on the other side of the breakpoint.
   */
  it("refuses an invalid rate from the mobile bar exactly as from the inline footer", async () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft({ currency: field("USD", "read") })}
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

    const input = await screen.findByLabelText(/fx.label/);
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("3.75"));
    fireEvent.change(input, { target: { value: "no es un número" } });

    fireEvent.click(mobileSubmit());

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/fx.invalid/)).toBeTruthy();
  });
});

describe("IntakeReviewScreen correction mode", () => {
  it("stays a document until the collector asks for the form, then opens every read value at once", () => {
    renderScreen(buildDraft());

    expect(screen.queryByLabelText(/fields.total/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "edit.start" }));

    // One switch, not one affordance per field: the date, the currency and the total all open.
    expect(screen.getByLabelText(/fields.orderDate/)).toBeTruthy();
    expect(screen.getByLabelText(/fields.currency/)).toBeTruthy();
    expect(screen.getByLabelText(/fields.total/)).toBeTruthy();
  });

  it("closes the form again, so the screen returns to reading as a document", () => {
    renderScreen(buildDraft());

    fireEvent.click(screen.getByRole("button", { name: "edit.start" }));
    fireEvent.click(screen.getByRole("button", { name: "edit.done" }));

    expect(screen.queryByLabelText(/fields.total/)).toBeNull();
  });

  it("offers exactly one correction control for the whole screen, never one per attribute", () => {
    renderScreen(buildDraft());
    expect(screen.getAllByRole("button", { name: /^edit\.(start|done)$/ })).toHaveLength(1);
  });

  it("corrects a product name in place, without the collector splitting and re-merging the group", () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft({
          groups: [
            {
              sourcePhrase: "el box sellado de Chainsaw Man",
              reason: "sealed",
              doubtful: true,
              priceSplit: "divided-lot",
              products: [{ name: "Chainsw Man box", unitPrice: 48000, suggestedProductTypeKey: null, referenceUrl: null }],
            },
          ],
        })}
        baseCurrencyCode={BASE_CURRENCY}
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

    fireEvent.click(screen.getByRole("button", { name: "edit.start" }));
    fireEvent.change(screen.getByLabelText(/^nameFieldLabel/), { target: { value: "Chainsaw Man box" } });
    desktopSubmit().click();

    const [saved] = onSave.mock.calls[0] as [ImageIntakeDraft];
    expect(saved.groups[0].products[0].name).toBe("Chainsaw Man box");
    // The reason the correction exists is a typo, and a typo says nothing about the grouping: the
    // doubt chip `FR-11-55` puts on screen and the price-split record both survive it.
    expect(saved.groups[0].doubtful).toBe(true);
    expect(saved.groups[0].priceSplit).toBe("divided-lot");
    expect(saved.groups[0].reason).toBe("sealed");
  });

  it("corrects a unit price in place, in the draft's own minor units", () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft()}
        baseCurrencyCode={BASE_CURRENCY}
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

    fireEvent.click(screen.getByRole("button", { name: "edit.start" }));
    const priceFields = screen.getAllByLabelText(/^priceFieldLabel/);
    fireEvent.change(priceFields[0], { target: { value: "115" } });
    desktopSubmit().click();

    const [saved] = onSave.mock.calls[0] as [ImageIntakeDraft];
    expect(saved.groups[0].products[0].unitPrice).toBe(11500);
    expect(saved.groups[0].products[1].unitPrice).toBe(6000);
  });

  it("refuses to save a product left without a name, and opens the field instead of failing server-side", () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft()}
        baseCurrencyCode={BASE_CURRENCY}
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

    fireEvent.click(screen.getByRole("button", { name: "edit.start" }));
    fireEvent.change(screen.getAllByLabelText(/^nameFieldLabel/)[0], { target: { value: "  " } });
    fireEvent.click(desktopSubmit());

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("edit.blankName");
  });
});

describe("IntakeReviewScreen totals reconciliation", () => {
  it("says so when the rows do not add up to the stated total", () => {
    renderScreen(buildDraft({ totalCost: field(11000, "read") }));
    expect(screen.getByText(/totals.mismatchTitle/)).toBeTruthy();
  });

  it("stays quiet when the rows add up exactly", () => {
    renderScreen(buildDraft({ totalCost: field(15000, "read") }));
    expect(screen.queryByText(/totals.mismatchTitle/)).toBeNull();
  });

  it("counts a stated shipping cost toward the total before calling it a mismatch", () => {
    renderScreen(
      buildDraft({
        totalCost: field(17000, "read"),
        delivery: { expectedFrom: field(null, null), expectedTo: field(null, null), cost: field(2000, "read") },
      }),
    );
    expect(screen.queryByText(/totals.mismatchTitle/)).toBeNull();
  });

  it("stays quiet when a product carries no price, since the rows have no sum to compare", () => {
    renderScreen(
      buildDraft({
        totalCost: field(48000, "read"),
        groups: [
          {
            sourcePhrase: "el pack chase de Gojo",
            reason: "split",
            doubtful: false,
            priceSplit: "none",
            products: [
              { name: "Gojo", unitPrice: null, suggestedProductTypeKey: null, referenceUrl: null },
              { name: "Gojo (chase)", unitPrice: 6000, suggestedProductTypeKey: null, referenceUrl: null },
            ],
          },
        ],
      }),
    );
    expect(screen.queryByText(/totals.mismatchTitle/)).toBeNull();
  });

  it("never blocks the save over a mismatch: the total is what the chat said and it is saved as is", () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={buildDraft({ totalCost: field(11000, "read") })}
        baseCurrencyCode={BASE_CURRENCY}
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

    desktopSubmit().click();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect((onSave.mock.calls[0][0] as ImageIntakeDraft).totalCost.value).toBe(11000);
  });
});

describe("IntakeReviewScreen payments", () => {
  const assumedPaymentDraft = () =>
    buildDraft({
      payments: [{ amount: field(20000, "assumed"), paidAt: field("2026-07-20", "read") }],
    });

  it("makes an assumed payment amount a control, like every other assumed value", () => {
    renderScreen(assumedPaymentDraft());
    expect(screen.getByLabelText(/payments.amountLabel/)).toBeTruthy();
  });

  it("leaves a payment that was genuinely read as plain text", () => {
    renderScreen(buildDraft({ payments: [{ amount: field(20000, "read"), paidAt: field("2026-07-20", "read") }] }));
    expect(screen.queryByLabelText(/payments.amountLabel/)).toBeNull();
  });

  it("hands a corrected payment amount to the save handler in minor units", () => {
    const onSave = vi.fn();
    render(
      <IntakeReviewScreen
        initialDraft={assumedPaymentDraft()}
        baseCurrencyCode={BASE_CURRENCY}
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

    fireEvent.change(screen.getByLabelText(/payments.amountLabel/), { target: { value: "150" } });
    desktopSubmit().click();

    const [saved] = onSave.mock.calls[0] as [ImageIntakeDraft];
    expect(saved.payments[0].amount).toEqual({ value: 15000, source: "read" });
  });
});
