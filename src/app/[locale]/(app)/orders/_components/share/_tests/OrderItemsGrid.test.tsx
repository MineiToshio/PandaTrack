import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderItemsGrid, { createEmptyRow } from "../OrderItemsGrid";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../ItemTypePicker", () => ({
  default: ({ onKeyDown }: { onKeyDown: React.KeyboardEventHandler }) => (
    <button type="button" onKeyDown={onKeyDown}>
      Category
    </button>
  ),
}));

const rows = [
  { ...createEmptyRow("a"), name: "Manga 1" },
  { ...createEmptyRow("b"), name: "Manga 2" },
];

function renderGrid(sortable?: boolean) {
  const onChange = vi.fn();
  render(
    <OrderItemsGrid
      rows={rows}
      onChange={onChange}
      productTypeKeys={[]}
      tProductTypes={(key) => key}
      createNewRow={() => createEmptyRow("c")}
      sortable={sortable}
    />,
  );
  return onChange;
}

describe("OrderItemsGrid sorting", () => {
  it("keeps handles and keyboard sorting enabled by default for manual forms", () => {
    const onChange = renderGrid();
    expect(screen.getAllByRole("button", { name: "itemDragLabel" })).toHaveLength(2);
    fireEvent.keyDown(screen.getAllByLabelText("itemNameLabel")[0], { key: "ArrowDown", altKey: true, shiftKey: true });
    expect(onChange).toHaveBeenCalledWith([rows[1], rows[0]]);
  });

  it("removes handles and disables keyboard reordering when sorting is disabled", () => {
    const onChange = renderGrid(false);
    expect(screen.queryByRole("button", { name: "itemDragLabel" })).toBeNull();
    fireEvent.keyDown(screen.getAllByLabelText("itemNameLabel")[0], { key: "ArrowDown", altKey: true, shiftKey: true });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByLabelText("itemNameLabel")[0], { target: { value: "Edited" } });
    expect(onChange).toHaveBeenCalledWith([{ ...rows[0], name: "Edited" }, rows[1]]);
  });

  it("still appends a new row on Tab from the final category by default", () => {
    const onChange = renderGrid();
    fireEvent.keyDown(screen.getAllByRole("button", { name: "Category" })[1], { key: "Tab" });
    expect(onChange).toHaveBeenCalledWith([...rows, createEmptyRow("c")]);
  });

  it("assigns independent drag-context descriptions to multiple manual grids", () => {
    renderGrid();
    renderGrid();
    const handles = screen.getAllByRole("button", { name: "itemDragLabel" });
    const firstDescription = handles[0].getAttribute("aria-describedby");
    const secondDescription = handles[2].getAttribute("aria-describedby");
    expect(firstDescription).toBeTruthy();
    expect(secondDescription).toBeTruthy();
    expect(firstDescription).not.toBe(secondDescription);
    expect(document.getElementById(firstDescription!)).toBeTruthy();
    expect(document.getElementById(secondDescription!)).toBeTruthy();
  });
});
