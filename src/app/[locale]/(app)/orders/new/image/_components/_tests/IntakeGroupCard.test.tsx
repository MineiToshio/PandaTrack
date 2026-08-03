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

describe("shouldArriveExpanded", () => {
  it("expands a group of two to five products", () => {
    expect(shouldArriveExpanded(buildGroup({ products: buildProducts(2) }))).toBe(true);
    expect(shouldArriveExpanded(buildGroup({ products: buildProducts(5) }))).toBe(true);
  });

  it("collapses a group of six or more products", () => {
    expect(shouldArriveExpanded(buildGroup({ products: buildProducts(6) }))).toBe(false);
    expect(shouldArriveExpanded(buildGroup({ products: buildProducts(50) }))).toBe(false);
  });

  it("expands any size when the group carries a doubt, so a doubt is never hidden behind a summary", () => {
    expect(shouldArriveExpanded(buildGroup({ products: buildProducts(50), doubtful: true }))).toBe(true);
  });
});

/** Stands in for the live catalog the page reads: two seeded keys are enough to pick between. */
const PRODUCT_TYPE_KEYS = ["figures", "manga"];

const noopApply = () => {};

describe("IntakeGroupCard", () => {
  it("renders every row of a small group and no disclosure control", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup()}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );

    expect(screen.getByText("Gojo")).toBeTruthy();
    expect(screen.getByText("Gojo (chase)")).toBeTruthy();
    expect(screen.queryByRole("button", { expanded: false })).toBeNull();
  });

  it("renders a large group as a summary behind a labelled disclosure control", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup({ products: buildProducts(50), sourcePhrase: "One Piece 1 al 50" })}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );

    expect(screen.queryByText("One Piece 1")).toBeNull();
    const disclosure = screen.getByRole("button", { expanded: false });
    expect(disclosure.textContent).toContain("50");
  });

  it("quotes the source phrase verbatim, which is the evidence the user judges from", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup()}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );
    expect(screen.getByText(/el pack chase de Gojo/)).toBeTruthy();
  });

  it("renders the doubtful state with its own word, not only a colour", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup({ doubtful: true })}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );
    expect(screen.getByText("doubtful")).toBeTruthy();
  });

  it("carries a group-level warning on the group instead of repeating it per row", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup({ products: buildProducts(4) })}
        currencyCode="PEN"
        hasWarning
        onApply={noopApply}
      />,
    );

    expect(screen.getByText("warning")).toBeTruthy();
    expect(screen.getAllByText(/priceSplitUneven/)).toHaveLength(1);
  });

  it("renders the reverting control enabled now that split and merge are wired", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup()}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );

    const revert = screen.getByRole("button", { name: /mergeAction/ });
    expect(revert.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("comingSoon")).toBeNull();
  });

  it("opens the split/merge modal in merge mode for a multi-product group", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup()}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mergeAction/ }));
    expect(screen.getByText("merge.title")).toBeTruthy();
  });

  it("opens the split/merge modal in split mode for a single-product (sealed) group", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup({
          reason: "sealed",
          products: [{ name: "Gojo sellado", unitPrice: 9000, suggestedProductTypeKey: null, referenceUrl: null }],
        })}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /splitIntoAction/ }));
    expect(screen.getByText("split.title")).toBeTruthy();
  });

  it("calls onApply with a merged product when the merge modal is confirmed", () => {
    const onApply = vi.fn();
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup()}
        currencyCode="PEN"
        hasWarning={false}
        onApply={onApply}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mergeAction/ }));
    fireEvent.click(screen.getByRole("button", { name: "merge.confirm" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const updatedGroup = onApply.mock.calls[0][0];
    expect(updatedGroup.products).toHaveLength(1);
    expect(updatedGroup.reason).toBe("sealed");
    expect(updatedGroup.doubtful).toBe(false);
    // Both source products were priced, so the merged price is their sum.
    expect(updatedGroup.products[0].unitPrice).toBe(15000);
  });
});

/**
 * A category is inferred, never read, so the review screen has two jobs here: never present one as
 * something the chat said, and always let the collector overrule it.
 */
describe("IntakeGroupCard: suggested category", () => {
  function renderCard(group: ExtractedGroup, onApply = noopApply) {
    return render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={group}
        currencyCode="PEN"
        hasWarning={false}
        onApply={onApply}
      />,
    );
  }

  function buildCategorisedGroup(...keys: (string | null)[]): ExtractedGroup {
    return buildGroup({
      products: keys.map((key, index) => ({
        name: `Producto ${index + 1}`,
        unitPrice: 1000,
        suggestedProductTypeKey: key,
        referenceUrl: null,
      })),
    });
  }

  it("shows the suggested category per row, marked as a suggestion and not as a reading", () => {
    renderCard(buildCategorisedGroup("manga", null));

    expect(screen.getByRole("button", { name: /categoryProductAria.*manga/ })).toBeTruthy();
    // The marker carries a word, so the provenance never depends on colour alone.
    expect(screen.getAllByText("categorySuggested")).toHaveLength(1);
  });

  it("offers a control on a product the model could not categorise, without calling it a suggestion", () => {
    renderCard(buildCategorisedGroup(null));

    expect(screen.getByRole("button", { name: /categoryProductAria.*categoryNone/ })).toBeTruthy();
    expect(screen.queryByText("categorySuggested")).toBeNull();
  });

  it("lets the collector correct one row's category, leaving the other rows alone", () => {
    const onApply = vi.fn();
    renderCard(buildCategorisedGroup("manga", null), onApply);

    fireEvent.click(screen.getByRole("button", { name: /categoryProductAria.*categoryNone/ }));
    fireEvent.click(screen.getByRole("option", { name: /figures/ }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const updatedGroup = onApply.mock.calls[0][0];
    expect(updatedGroup.products[0].suggestedProductTypeKey).toBe("manga");
    expect(updatedGroup.products[1].suggestedProductTypeKey).toBe("figures");
  });

  it("only offers catalog keys the page passed in, so no invented category can be picked", () => {
    renderCard(buildCategorisedGroup(null));

    fireEvent.click(screen.getByRole("button", { name: /categoryProductAria/ }));

    expect(screen.getAllByRole("option")).toHaveLength(PRODUCT_TYPE_KEYS.length);
    expect(screen.queryByRole("option", { name: /blu_rays/ })).toBeNull();
  });

  it("stops calling a category a suggestion once the collector has chosen it", () => {
    // The group is re-rendered with the collector's own answer, exactly as the parent would.
    const { rerender } = renderCard(buildCategorisedGroup(null));

    fireEvent.click(screen.getByRole("button", { name: /categoryProductAria/ }));
    fireEvent.click(screen.getByRole("option", { name: /manga/ }));
    rerender(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildCategorisedGroup("manga")}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );

    expect(screen.queryByText("categorySuggested")).toBeNull();
  });

  it("serves a collapsed group with one control for the whole group, keeping the summary dense", () => {
    const products = buildProducts(50).map((product) => ({ ...product, suggestedProductTypeKey: "manga" }));
    const onApply = vi.fn();
    renderCard(buildGroup({ products, sourcePhrase: "One Piece 1 al 50" }), onApply);

    fireEvent.click(screen.getByRole("button", { name: /categoryGroupAria/ }));
    fireEvent.click(screen.getByRole("option", { name: /figures/ }));

    const updatedGroup = onApply.mock.calls[0][0];
    expect(updatedGroup.products).toHaveLength(50);
    expect(
      updatedGroup.products.every(
        (product: { suggestedProductTypeKey: string }) => product.suggestedProductTypeKey === "figures",
      ),
    ).toBe(true);
  });

  it("says the categories differ instead of picking one of them for a collapsed group", () => {
    const products = buildProducts(6).map((product, index) => ({
      ...product,
      suggestedProductTypeKey: index === 0 ? "manga" : "figures",
    }));
    renderCard(buildGroup({ products }));

    expect(screen.getByText("categoryMixed")).toBeTruthy();
  });
});

describe("IntakeGroupCard: reference link", () => {
  it("renders a captured link as an openable anchor showing its host, not the whole URL", () => {
    const group = buildGroup({
      products: [
        {
          name: "mercadolibre.com.pe",
          unitPrice: null,
          suggestedProductTypeKey: null,
          referenceUrl: "https://www.mercadolibre.com.pe/MPE-1234567-figura-gojo-satoru?ref=chat&pos=3",
        },
      ],
    });
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={group}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "https://www.mercadolibre.com.pe/MPE-1234567-figura-gojo-satoru?ref=chat&pos=3",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    // A new tab opened from an untrusted address must not reach back into this one, and must send
    // no referrer.
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain("mercadolibre.com.pe");
    expect(link.textContent).not.toContain("MPE-1234567");
  });

  it("renders no link for a product that was not identified by one", () => {
    render(
      <IntakeGroupCard
        productTypeKeys={PRODUCT_TYPE_KEYS}
        group={buildGroup()}
        currencyCode="PEN"
        hasWarning={false}
        onApply={noopApply}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });
});
