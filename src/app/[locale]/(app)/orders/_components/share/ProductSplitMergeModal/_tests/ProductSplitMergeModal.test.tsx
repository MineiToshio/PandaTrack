import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

type MockModalAction = { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };

// Same stub pattern as OrderCancelModal.test.tsx / IntakeGroupCard.test.tsx: exercise the caller's
// own body markup and actions without the adaptive dialog/sheet machinery.
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

import ProductSplitMergeModal from "../ProductSplitMergeModal";

describe("ProductSplitMergeModal — split mode", () => {
  it("pre-fills proposed names and deterministic price shares when a range is detected", () => {
    render(
      <ProductSplitMergeModal
        isOpen
        onClose={vi.fn()}
        mode="split"
        currencyCode="PEN"
        sourceItems={[{ id: "item-1", name: "Pack One Piece 1 al 3", unitPrice: 9000 }]}
        onConfirmSplit={vi.fn()}
      />,
    );

    // No count selector — the range was detected.
    expect(screen.queryByLabelText("split.partCountLabel")).toBeNull();

    const nameInputs = screen.getAllByLabelText(/split.rowNameLabel/) as HTMLInputElement[];
    expect(nameInputs.map((input) => input.value)).toEqual(["One Piece 1", "One Piece 2", "One Piece 3"]);

    const priceInputs = screen.getAllByLabelText(/split.rowPriceLabel/) as HTMLInputElement[];
    // 9000 / 3 = 3000 each, evenly.
    expect(priceInputs.map((input) => input.value)).toEqual(["30.00", "30.00", "30.00"]);
  });

  it("shows the part-count selector and empty rows when no range is detected", () => {
    render(
      <ProductSplitMergeModal
        isOpen
        onClose={vi.fn()}
        mode="split"
        currencyCode="PEN"
        sourceItems={[{ id: "item-1", name: "Pack chase de Gojo", unitPrice: 9000 }]}
        onConfirmSplit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("split.partCountLabel")).toBeTruthy();
    const nameInputs = screen.getAllByLabelText(/split.rowNameLabel/) as HTMLInputElement[];
    expect(nameInputs).toHaveLength(2);
    expect(nameInputs.every((input) => input.value === "")).toBe(true);
  });

  it("blocks confirm and shows an inline error when a row name is left empty", () => {
    const onConfirmSplit = vi.fn();
    render(
      <ProductSplitMergeModal
        isOpen
        onClose={vi.fn()}
        mode="split"
        currencyCode="PEN"
        sourceItems={[{ id: "item-1", name: "Pack chase de Gojo", unitPrice: 9000 }]}
        onConfirmSplit={onConfirmSplit}
      />,
    );

    fireEvent.click(screen.getByText("split.confirm"));

    expect(onConfirmSplit).not.toHaveBeenCalled();
    expect(screen.getByText("split.nameRequiredError")).toBeTruthy();
  });

  it("confirms with the edited names and prices, parsed to minor units", () => {
    const onConfirmSplit = vi.fn();
    render(
      <ProductSplitMergeModal
        isOpen
        onClose={vi.fn()}
        mode="split"
        currencyCode="PEN"
        sourceItems={[{ id: "item-1", name: "Pack One Piece 1 al 3", unitPrice: 9000 }]}
        onConfirmSplit={onConfirmSplit}
      />,
    );

    const priceInputs = screen.getAllByLabelText(/split.rowPriceLabel/);
    fireEvent.change(priceInputs[0], { target: { value: "40.00" } });

    fireEvent.click(screen.getByText("split.confirm"));

    expect(onConfirmSplit).toHaveBeenCalledWith([
      { name: "One Piece 1", unitPrice: 4000 },
      { name: "One Piece 2", unitPrice: 3000 },
      { name: "One Piece 3", unitPrice: 3000 },
    ]);
  });

  it("does not render the equal-split note when the source item has no price", () => {
    render(
      <ProductSplitMergeModal
        isOpen
        onClose={vi.fn()}
        mode="split"
        currencyCode="PEN"
        sourceItems={[{ id: "item-1", name: "Pack One Piece 1 al 3", unitPrice: null }]}
        onConfirmSplit={vi.fn()}
      />,
    );

    expect(screen.queryByText(/split.priceNote/)).toBeNull();
  });
});

describe("ProductSplitMergeModal — merge mode", () => {
  it("shows every source item and the priced consequence copy, confirming with the summed price", () => {
    const onConfirmMerge = vi.fn();
    render(
      <ProductSplitMergeModal
        isOpen
        onClose={vi.fn()}
        mode="merge"
        currencyCode="PEN"
        sourceItems={[
          { id: "a", name: "Gojo", unitPrice: 9000 },
          { id: "b", name: "Gojo (chase)", unitPrice: 6000 },
        ]}
        onConfirmMerge={onConfirmMerge}
      />,
    );

    expect(screen.getByText("Gojo")).toBeTruthy();
    expect(screen.getByText("Gojo (chase)")).toBeTruthy();
    expect(screen.getByText(/merge.consequenceWithPrice/)).toBeTruthy();

    fireEvent.click(screen.getByText("merge.confirm"));

    expect(onConfirmMerge).toHaveBeenCalledWith("Gojo", 15000);
  });

  it("shows the no-price consequence copy and a null merged price when any source item has no price", () => {
    const onConfirmMerge = vi.fn();
    render(
      <ProductSplitMergeModal
        isOpen
        onClose={vi.fn()}
        mode="merge"
        currencyCode="PEN"
        sourceItems={[
          { id: "a", name: "Gojo", unitPrice: 9000 },
          { id: "b", name: "Gojo (chase)", unitPrice: null },
        ]}
        onConfirmMerge={onConfirmMerge}
      />,
    );

    expect(screen.getByText("merge.consequenceNoPrice")).toBeTruthy();

    fireEvent.click(screen.getByText("merge.confirm"));

    expect(onConfirmMerge).toHaveBeenCalledWith("Gojo", null);
  });

  it("blocks confirm when the merged name is cleared", () => {
    const onConfirmMerge = vi.fn();
    render(
      <ProductSplitMergeModal
        isOpen
        onClose={vi.fn()}
        mode="merge"
        currencyCode="PEN"
        sourceItems={[
          { id: "a", name: "Gojo", unitPrice: 9000 },
          { id: "b", name: "Gojo (chase)", unitPrice: 6000 },
        ]}
        onConfirmMerge={onConfirmMerge}
      />,
    );

    fireEvent.change(screen.getByLabelText("merge.nameLabel"), { target: { value: "  " } });
    fireEvent.click(screen.getByText("merge.confirm"));

    expect(onConfirmMerge).not.toHaveBeenCalled();
    expect(screen.getByText("merge.nameRequiredError")).toBeTruthy();
  });
});
