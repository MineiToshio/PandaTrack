import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, values?: Record<string, unknown>) =>
      key === "splitProduct"
        ? `splitProduct: ${String(values?.name ?? "")}`
        : values
          ? `${key}:${JSON.stringify(values)}`
          : key;
    translate.has = () => true;
    return translate;
  },
  useLocale: () => "es",
}));

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => viewport.mobile }));
afterEach(() => {
  viewport.mobile = false;
});

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
import posthog from "posthog-js";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { OrderItemsTable } from "../../../../_components/share/OrderItemsGrid";
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
  it("gives split and delete identical muted, centered icon controls with a split tooltip", () => {
    renderCard();
    const split = screen.getAllByRole("button", { name: /^splitProduct:/ })[0];
    const remove = screen.getByRole("button", { name: "itemDeleteLabel 1" });
    expect(split.getAttribute("title")).toBe(split.getAttribute("aria-label"));
    for (const button of [split, remove]) {
      expect(button.className).toContain("size-11");
      expect(button.className).toContain("lg:size-8");
      expect(button.className).toContain("[color:var(--text-muted)]");
      expect(button.className).toContain("focus-visible:[color:var(--text-primary)]");
      expect(button.querySelector("svg")?.getAttribute("width")).toBe("14");
      expect(button.closest("td")?.className).toContain("align-middle");
    }
  });

  it("keeps the source label and exactly its members inside one continuous table band", () => {
    render(
      <OrderItemsTable showQuantity={false} sortable={false} hasRowAction>
        <IntakeGroupCard
          group={buildGroup()}
          groupKey="bundle"
          currencyCode="PEN"
          productTypeKeys={PRODUCT_TYPE_KEYS}
          hasWarning={false}
          onApply={noopApply}
          withinTable
        />
        <IntakeGroupCard
          group={buildGroup({ sourcePhrase: "Other source", products: buildProducts(1) })}
          groupKey="other"
          currencyCode="PEN"
          productTypeKeys={PRODUCT_TYPE_KEYS}
          hasWarning={false}
          onApply={noopApply}
          withinTable
        />
      </OrderItemsTable>,
    );
    const source = screen.getByText(/bundleLabel:.*el pack chase de Gojo/);
    const band = source.closest("tbody")!;
    expect(band.getAttribute("aria-labelledby")).toBe(source.closest("summary")?.id);
    expect(band.className).toContain("[&>tr>td:first-child]:border-l-2");
    expect(within(band).getAllByLabelText("itemNameLabel")).toHaveLength(2);
    expect(nameCells()[2].closest("tbody")).not.toBe(band);
    expect(within(band).getByRole("button", { name: "mergeAction" }).className).toContain(
      "[background:color-mix(in_oklch,var(--accent)_12%,transparent)]",
    );
  });

  it("contains the mobile edit and split targets in the same bordered row and keeps delete in edit", () => {
    viewport.mobile = true;
    renderCard({ group: buildGroup({ products: buildProducts(1) }) });
    const edit = screen.getByRole("button", { name: /^One Piece 1/ });
    const split = screen.getByRole("button", { name: /^splitProduct:/ });
    const card = edit.closest("li")!;
    expect(card).toBe(split.closest("li"));
    expect(card.className).toContain("border-border");
    expect(card.className).toMatch(/\bborder\b/);
    expect(edit.className).toContain("min-h-11");
    expect(edit.className).not.toContain("border-bottom");
    expect(split.className).toContain("size-11");
    expect(split.className).toContain("before:inset-0");
    fireEvent.click(edit);
    expect(screen.getByRole("button", { name: "delete" })).toBeTruthy();
  });

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

  it("shows no provenance chrome for a clean single-product group", () => {
    renderCard({ group: buildGroup({ products: buildProducts(1) }) });
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByText(/bundleLabel/)).toBeNull();
    expect(screen.queryByText(/sourceQuote/)).toBeNull();
    expect(screen.queryByText("clean")).toBeNull();
    expect(nameCells()).toHaveLength(1);
  });

  it("shows one compact provenance disclosure for a multi-product source line", () => {
    renderCard();
    expect(screen.getAllByText(/bundleLabel/)).toHaveLength(1);
    const evidence = screen.getByText(/bundleLabel/).closest("details");
    expect(evidence?.open).toBe(false);
    expect(within(evidence!).getByText(/sourceQuote:.*el pack chase de Gojo/)).toBeTruthy();
    fireEvent.click(screen.getByText(/bundleLabel/));
    expect(evidence?.open).toBe(true);
  });

  it("omits sorting handles and keeps a split action on every row", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: "itemDragLabel" })).toBeNull();
    const actions = screen.getAllByRole("button", { name: /^splitProduct:/ });
    expect(actions).toHaveLength(2);
    expect(actions[0].closest("tr")).toBe(nameCells()[0].closest("tr"));
    expect(actions[1].closest("tr")).toBe(nameCells()[1].closest("tr"));
    fireEvent.click(actions[1]);
    expect(screen.getByText("split.title")).toBeTruthy();
  });

  it("keeps edit and split as separate accessible actions in the mobile list", () => {
    viewport.mobile = true;
    renderCard({ group: buildGroup({ products: buildProducts(1) }) });
    const edit = screen.getByRole("button", { name: /^One Piece 1/ });
    expect(edit.className).toContain("min-w-0");
    expect(screen.queryByRole("grid")).toBeNull();
    const split = screen.getByRole("button", { name: /^splitProduct:/ });
    expect(split.className).toContain("size-11");
    fireEvent.click(split);
    expect(screen.getByText("split.title")).toBeTruthy();
    expect(screen.queryByText("categorySuggestedHint")).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: /splitProduct:.*Pack sellado/ }));
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

describe("IntakeGroupCard: splitting an individual row", () => {
  it("splits only the selected product and preserves its sibling's price, category and link", () => {
    const onApply = vi.fn();
    const onCategoryOwnershipChange = vi.fn();
    const sibling = {
      name: "Manga 10",
      unitPrice: 9000,
      suggestedProductTypeKey: "figures",
      referenceUrl: "https://example.com/gojo",
    };
    renderCard({
      onApply,
      ownedCategoryIndexes: new Set([0]),
      onCategoryOwnershipChange,
      group: buildGroup({
        products: [
          sibling,
          {
            name: "Manga 1-2",
            unitPrice: 6000,
            suggestedProductTypeKey: "manga",
            referenceUrl: "https://example.com/manga",
          },
        ],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: /splitProduct:.*Manga 1-2/ }));
    fireEvent.click(screen.getByRole("button", { name: "split.confirm" }));
    const [updated] = onApply.mock.calls.at(-1) as [ExtractedGroup];
    expect(updated.products).toEqual([
      { name: "Manga 1", unitPrice: 3000, suggestedProductTypeKey: "manga", referenceUrl: "https://example.com/manga" },
      { name: "Manga 2", unitPrice: 3000, suggestedProductTypeKey: "manga", referenceUrl: null },
      sibling,
    ]);
    expect(onCategoryOwnershipChange).toHaveBeenLastCalledWith(new Set([2]));
    expect(nameCells().map((cell) => cell.value)).toEqual(["Manga 1", "Manga 2", "Manga 10"]);
  });
});

describe("IntakeGroupCard: suggested category", () => {
  it("offers the manual form's own picker on every row", () => {
    renderCard();
    expect(screen.getAllByRole("button", { name: /itemProductTypeLabel/ })).toHaveLength(2);
  });
});

describe("review regression: group evidence and metadata", () => {
  it.each(["sealed", "not-nameable"] as const)("retains compact source evidence for a %s single product", (reason) => {
    renderCard({ group: buildGroup({ reason, products: buildProducts(1) }) });
    const label = reason === "sealed" ? "sealed" : "notNameable";
    const disclosure = screen.getByText(label).closest("details");
    expect(disclosure).toBeTruthy();
    expect(disclosure?.open).toBe(false);
    expect(within(disclosure!).getByText(/sourceQuote:.*el pack chase de Gojo/)).toBeTruthy();
  });

  it("preserves doubtful and reason flags for untouched siblings after a row split", () => {
    const onApply = vi.fn();
    renderCard({
      onApply,
      group: buildGroup({
        doubtful: true,
        reason: "not-nameable",
        priceSplit: "divided-lot",
        products: [
          { name: "Manga 1-2", unitPrice: 6000, suggestedProductTypeKey: null, referenceUrl: null },
          {
            name: "Unknown link",
            unitPrice: 1000,
            suggestedProductTypeKey: null,
            referenceUrl: "https://example.com/product",
          },
        ],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: /splitProduct:.*Manga/ }));
    fireEvent.click(screen.getByRole("button", { name: "split.confirm" }));
    const [updated] = onApply.mock.calls.at(-1) as [ExtractedGroup];
    expect(updated).toMatchObject({ doubtful: true, reason: "not-nameable", priceSplit: "divided-lot" });
    expect(updated.products.at(-1)).toEqual({
      name: "Unknown link",
      unitPrice: 1000,
      suggestedProductTypeKey: null,
      referenceUrl: "https://example.com/product",
    });
  });

  it("resets source flags when splitting the only product", () => {
    const onApply = vi.fn();
    renderCard({
      onApply,
      group: buildGroup({
        doubtful: true,
        reason: "sealed",
        priceSplit: "divided-lot",
        products: [{ name: "Manga 1-2", unitPrice: 6000, suggestedProductTypeKey: null, referenceUrl: null }],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: /splitProduct:.*Manga/ }));
    fireEvent.click(screen.getByRole("button", { name: "split.confirm" }));
    expect(onApply.mock.calls.at(-1)?.[0]).toMatchObject({
      doubtful: false,
      reason: "split",
      priceSplit: "explicit-unit",
    });
  });

  it("derives provenance spans from the surrounding table column configuration", () => {
    render(
      <OrderItemsTable sortable showQuantity hasRowAction>
        <IntakeGroupCard
          withinTable
          group={buildGroup()}
          groupKey="span"
          currencyCode="PEN"
          productTypeKeys={PRODUCT_TYPE_KEYS}
          hasWarning={false}
          onApply={noopApply}
        />
      </OrderItemsTable>,
    );
    const columnCount = screen.getAllByRole("columnheader").length;
    const cell = screen.getByText(/bundleLabel/).closest("td");
    expect(columnCount).toBe(7);
    expect(cell?.colSpan).toBe(columnCount);
  });

  it("reports evidence expansion and collapse with an explicit boolean", () => {
    renderCard();
    const details = screen.getByText(/bundleLabel/).closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(posthog.capture).toHaveBeenLastCalledWith(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_EVIDENCE_TOGGLED, {
      expanded: true,
    });
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(posthog.capture).toHaveBeenLastCalledWith(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_EVIDENCE_TOGGLED, {
      expanded: false,
    });
  });

  it("reports row expansion and collapse with an explicit boolean", () => {
    renderCard({ group: buildGroup({ products: buildProducts(6) }) });
    const expand = screen.getByRole("button", { name: /^expand:/ });
    fireEvent.click(expand);
    expect(posthog.capture).toHaveBeenLastCalledWith(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_ROWS_TOGGLED, {
      expanded: true,
    });
    const collapse = screen.getByRole("button", { name: /^collapse:/ });
    fireEvent.click(collapse);
    expect(posthog.capture).toHaveBeenLastCalledWith(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_ROWS_TOGGLED, {
      expanded: false,
    });
  });

  it("gives a blank product's split action a complete name without a trailing space", () => {
    renderCard({
      group: buildGroup({
        products: [{ name: "", unitPrice: null, suggestedProductTypeKey: null, referenceUrl: null }],
      }),
    });
    const button = screen.getByRole("button", { name: "splitAction" });
    expect(button.getAttribute("aria-label")).toBe("splitAction");
    expect(button.getAttribute("title")).toBe("splitAction");
  });
});
