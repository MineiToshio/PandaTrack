import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    translate.has = () => true;
    return translate;
  },
  useLocale: () => "es",
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };

// Same stub used by OrderCancelModal.test.tsx: exercise the caller's own markup and actions
// without the adaptive dialog/sheet machinery (Portal, focus trap, Vaul on mobile).
vi.mock("@/components/modules/Modal/Modal", () => ({
  default: ({
    isOpen,
    title,
    children,
    primaryAction,
    secondaryAction,
  }: {
    isOpen: boolean;
    title: string;
    children: ReactNode;
    primaryAction: MockModalAction;
    secondaryAction: MockModalAction;
  }) =>
    isOpen ? (
      <div>
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
          {primaryAction.label}
        </button>
        <button type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
          {secondaryAction.label}
        </button>
      </div>
    ) : null,
}));

import type { ComponentProps } from "react";
import type { ExtractedGroup, ExtractedProduct } from "@/lib/imageIntake/draftSchema";
import IntakeGroupCard, { shouldArriveExpanded } from "../IntakeGroupCard";

function buildGroup(overrides: Partial<ExtractedGroup> = {}): ExtractedGroup {
  return {
    sourcePhrase: "el pack chase de Gojo",
    reason: "split",
    doubtful: false,
    priceSplit: "explicit-unit",
    products: [
      { name: "Gojo", unitPrice: 9000, suggestedProductTypeKey: null, referenceUrl: null },
      { name: "Gojo (chase)", unitPrice: 6000, suggestedProductTypeKey: null, referenceUrl: null },
    ],
    ...overrides,
  };
}

function buildProducts(count: number): ExtractedProduct[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `One Piece ${index + 1}`,
    unitPrice: 1200,
    suggestedProductTypeKey: null,
    referenceUrl: null,
  }));
}

const PRODUCT_TYPE_KEYS = ["figures", "manga"];
const noopApply = () => {};

function renderCard(props: Partial<ComponentProps<typeof IntakeGroupCard>> = {}) {
  return render(
    <IntakeGroupCard
      group={buildGroup()}
      groupKey="g0"
      currencyCode="PEN"
      productTypeKeys={PRODUCT_TYPE_KEYS}
      hasWarning={false}
      onApply={noopApply}
      {...props}
    />,
  );
}

/** The product rows are a real table now; a cell is reached by its own accessible name. */
function nameCells(): HTMLInputElement[] {
  return screen.getAllByLabelText("itemNameLabel") as HTMLInputElement[];
}

function priceCells(): HTMLInputElement[] {
  return screen.getAllByLabelText("itemUnitPriceLabel") as HTMLInputElement[];
}

describe("shouldArriveExpanded", () => {
  it("expands a group of two to five products", () => {
    expect(shouldArriveExpanded(buildGroup())).toBe(true);
  });

  it("collapses a group of six or more products", () => {
    expect(shouldArriveExpanded(buildGroup({ products: buildProducts(6) }))).toBe(false);
  });

  it("expands any size when the group carries a doubt, so a doubt is never hidden behind a summary", () => {
    expect(shouldArriveExpanded(buildGroup({ products: buildProducts(50), doubtful: true }))).toBe(true);
  });
});

describe("IntakeGroupCard", () => {
  it("renders every product as an editable table row, with no mode to discover first", () => {
    renderCard();

    // The whole point of the rewrite: the collector sees editable cells immediately. Nothing is
    // behind a "Corregir" toggle and nothing is plain text waiting to be discovered.
    expect(nameCells().map((cell) => cell.value)).toEqual(["Gojo", "Gojo (chase)"]);
    expect(priceCells().map((cell) => cell.value)).toEqual(["90.00", "60.00"]);
  });

  it("hides the quantity column, since a draft carries one product per unit by construction", () => {
    renderCard();
    expect(screen.queryByLabelText("itemQuantityLabel")).toBeNull();
  });

  it("renders a large group as a summary behind a labelled disclosure control", () => {
    renderCard({ group: buildGroup({ products: buildProducts(50), sourcePhrase: "One Piece 1 al 50" }) });

    expect(screen.queryByLabelText("itemNameLabel")).toBeNull();
    const disclosure = screen.getByRole("button", { name: /^expand:/, expanded: false });
    expect(disclosure.textContent).toContain("50");
  });

  it("quotes the source phrase verbatim, which is the evidence the user judges from", () => {
    renderCard();
    expect(screen.getByText(/sourceQuote:.*el pack chase de Gojo/)).toBeTruthy();
  });

  it("renders the doubtful state with its own word, not only a colour", () => {
    renderCard({ group: buildGroup({ doubtful: true }) });
    expect(screen.getByText("doubtful")).toBeTruthy();
  });

  it("carries a group-level warning on the group instead of repeating it per row", () => {
    renderCard({ hasWarning: true });
    expect(screen.getAllByText(/priceSplitUneven/)).toHaveLength(1);
  });
});

describe("IntakeGroupCard: editing a row", () => {
  it("renames a product straight from its cell, with no split and re-merge and no mode", () => {
    const onApply = vi.fn();
    renderCard({
      group: buildGroup({
        reason: "sealed",
        doubtful: true,
        priceSplit: "divided-lot",
        products: [{ name: "Chainsw Man", unitPrice: 48000, suggestedProductTypeKey: null, referenceUrl: null }],
      }),
      onApply,
    });

    fireEvent.change(nameCells()[0], { target: { value: "Chainsaw Man" } });

    const [updated] = onApply.mock.calls.at(-1) as [ExtractedGroup];
    expect(updated.products[0].name).toBe("Chainsaw Man");
    // Correcting a typo says nothing about the grouping, so the doubt chip `FR-11-55` keeps on
    // screen and the price-split record both survive it.
    expect(updated.doubtful).toBe(true);
    expect(updated.priceSplit).toBe("divided-lot");
    expect(updated.reason).toBe("sealed");
  });

  it("writes a corrected price back in the draft's own minor units", () => {
    const onApply = vi.fn();
    renderCard({ onApply });

    fireEvent.change(priceCells()[0], { target: { value: "115" } });

    const [updated] = onApply.mock.calls.at(-1) as [ExtractedGroup];
    expect(updated.products[0].unitPrice).toBe(11500);
    expect(updated.products[1].unitPrice).toBe(6000);
  });

  it("keeps the text a person is mid-way through typing instead of round-tripping it", () => {
    renderCard();

    // "11." is not a number yet. Deriving the cell from the draft would delete the dot as it was
    // typed, which is why the rows are the edit surface and the draft is derived from them.
    fireEvent.change(priceCells()[0], { target: { value: "11." } });
    expect(priceCells()[0].value).toBe("11.");
  });

  it("cannot be given a price the money parser refuses, because the cell sanitises as you type", () => {
    const onApply = vi.fn();
    const onPriceValidityChange = vi.fn();
    renderCard({ onApply, onPriceValidityChange });

    // A thousands separator is exactly what a person pastes out of a chat. The grid's own
    // `sanitizeDecimalInput` drops it on the keystroke, so the whole class of "typed text the
    // parser rejects, saved silently as no price" cannot occur through this surface at all.
    fireEvent.change(priceCells()[0], { target: { value: "1,500" } });

    expect(priceCells()[0].value).toBe("1500");
    expect(onPriceValidityChange).toHaveBeenLastCalledWith(false);
    const [updated] = onApply.mock.calls.at(-1) as [ExtractedGroup];
    expect(updated.products[0].unitPrice).toBe(150000);
  });

  it("keeps a captured link on its own row across an edit to that row", () => {
    const onApply = vi.fn();
    renderCard({
      group: buildGroup({
        products: [
          { name: "Gojo", unitPrice: 9000, suggestedProductTypeKey: null, referenceUrl: null },
          {
            name: "mercadolibre.com.pe",
            unitPrice: 6000,
            suggestedProductTypeKey: null,
            referenceUrl: "https://www.mercadolibre.com.pe/figura",
          },
        ],
      }),
      onApply,
    });

    fireEvent.change(nameCells()[1], { target: { value: "Figura Gojo" } });

    const [updated] = onApply.mock.calls.at(-1) as [ExtractedGroup];
    // The grid has no cell for a link, so it rides along by row id rather than being dropped the
    // first time the row it belongs to is touched.
    expect(updated.products[1].referenceUrl).toBe("https://www.mercadolibre.com.pe/figura");
    expect(updated.products[0].referenceUrl).toBeNull();
  });
});

describe("IntakeGroupCard: split and merge", () => {
  it("opens the modal in merge mode for a multi-product group", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /mergeAction/ }));
    expect(screen.getByText("merge.title")).toBeTruthy();
  });

  it("opens the modal in split mode for a single-product (sealed) group", () => {
    renderCard({
      group: buildGroup({
        reason: "sealed",
        products: [{ name: "Pack sellado", unitPrice: 48000, suggestedProductTypeKey: null, referenceUrl: null }],
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: /splitIntoAction/ }));
    expect(screen.getByText("split.title")).toBeTruthy();
  });

  it("rebuilds the table rows after a merge, not only the draft", () => {
    const onApply = vi.fn();
    renderCard({ onApply });

    fireEvent.click(screen.getByRole("button", { name: /mergeAction/ }));
    fireEvent.click(screen.getByRole("button", { name: "merge.confirm" }));

    const [updated] = onApply.mock.calls.at(-1) as [ExtractedGroup];
    expect(updated.products).toHaveLength(1);
    expect(updated.reason).toBe("sealed");
    // The rows are local state, so an operation that replaces the product list has to rebuild them
    // or the table would keep showing two rows that no longer exist.
    expect(nameCells()).toHaveLength(1);
  });
});

describe("IntakeGroupCard: suggested category", () => {
  it("says the categories are suggestions once, for the group, instead of a chip on every row", () => {
    renderCard({
      group: buildGroup({
        products: [
          { name: "Gojo", unitPrice: 9000, suggestedProductTypeKey: "figures", referenceUrl: null },
          { name: "Gojo (chase)", unitPrice: 6000, suggestedProductTypeKey: "figures", referenceUrl: null },
        ],
      }),
    });

    expect(screen.getAllByText("categorySuggestedHint")).toHaveLength(1);
  });

  it("says nothing about suggestions when the model categorised nothing", () => {
    renderCard();
    expect(screen.queryByText("categorySuggestedHint")).toBeNull();
  });

  it("offers the manual form's own picker on every row", () => {
    renderCard();
    expect(screen.getAllByRole("button", { name: /itemProductTypeLabel/ })).toHaveLength(2);
  });
});
