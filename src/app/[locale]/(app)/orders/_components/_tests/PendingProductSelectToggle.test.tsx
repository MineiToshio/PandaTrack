import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PendingProductSelectToggle from "../PendingProductSelectToggle";

function renderToggle(overrides: Partial<React.ComponentProps<typeof PendingProductSelectToggle>> = {}) {
  const onToggle = vi.fn();
  render(
    <PendingProductSelectToggle
      itemId="item-1"
      label="Seleccionar Nendoroid Miku"
      checked={false}
      selectable
      armed={false}
      variant="row"
      onToggle={onToggle}
      {...overrides}
    />,
  );
  return { onToggle };
}

describe("PendingProductSelectToggle", () => {
  it("is a real checkbox with its own accessible name", () => {
    renderToggle();

    const input = screen.getByRole("checkbox", { name: "Seleccionar Nendoroid Miku" }) as HTMLInputElement;
    // A native input is what makes `Space`, the announced role and the checked state free. The
    // product name cannot be the visible label: it shares its block with the link into the order,
    // and a `<label>` around an `<a>` is invalid markup that swallows the link's click.
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("checkbox");
    expect(input.closest("label")).not.toBeNull();
  });

  it("reports the checked state through the input, not through a painted class", () => {
    renderToggle({ checked: true });

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("reports a plain click as a non-range toggle", () => {
    const { onToggle } = renderToggle();
    const input = screen.getByRole("checkbox");

    fireEvent.mouseDown(input.closest("label") as HTMLElement, { shiftKey: false });
    fireEvent.click(input);

    expect(onToggle).toHaveBeenCalledWith("item-1", false);
  });

  it("carries the Shift modifier from the label's mousedown into the toggle", () => {
    // A click on a `<label>` reaches the input as a synthetic click that does not reliably carry
    // the modifier keys, so reading it off the input's own event would silently never extend.
    const { onToggle } = renderToggle();
    const input = screen.getByRole("checkbox");

    fireEvent.mouseDown(input.closest("label") as HTMLElement, { shiftKey: true });
    fireEvent.click(input);

    expect(onToggle).toHaveBeenCalledWith("item-1", true);
  });

  it("forgets the modifier after one toggle, so a later keyboard Space is not a range", () => {
    const { onToggle } = renderToggle();
    const input = screen.getByRole("checkbox");

    fireEvent.mouseDown(input.closest("label") as HTMLElement, { shiftKey: true });
    fireEvent.click(input);
    fireEvent.click(input);

    expect(onToggle).toHaveBeenNthCalledWith(2, "item-1", false);
  });

  it("forgets a Shift press that never became a toggle", () => {
    // Shift + press on the tile, drag off it and release elsewhere: no `change` ever fires, so
    // `onChange` never gets to clear the flag. Left up, it turns the next activation of this same
    // tile into a range the collector did not ask for.
    const { onToggle } = renderToggle();
    const input = screen.getByRole("checkbox");
    const label = input.closest("label") as HTMLElement;

    fireEvent.mouseDown(label, { shiftKey: true });
    fireEvent.mouseLeave(label);
    fireEvent.click(input);

    expect(onToggle).toHaveBeenCalledWith("item-1", false);
  });

  it("reads the modifier off the key that activates it, not off an earlier pointer press", () => {
    // `Space` activates a checkbox from its own keydown, so the keyboard path can state its intent
    // instead of inheriting whatever a previous press on the same tile left behind.
    const { onToggle } = renderToggle();
    const input = screen.getByRole("checkbox");

    fireEvent.mouseDown(input.closest("label") as HTMLElement, { shiftKey: true });
    fireEvent.keyDown(input, { key: " ", shiftKey: false });
    fireEvent.click(input);

    expect(onToggle).toHaveBeenCalledWith("item-1", false);
  });

  it("still extends the range from a Shift + Space", () => {
    const { onToggle } = renderToggle();
    const input = screen.getByRole("checkbox");

    fireEvent.keyDown(input, { key: " ", shiftKey: true });
    fireEvent.click(input);

    expect(onToggle).toHaveBeenCalledWith("item-1", true);
  });

  it("shrinks the PAINT, never the box: the box holds the column alignment and the tap target", () => {
    // The two things the `<label>`'s box is load-bearing for are invisible in a screenshot and
    // trivial to break by "just making the check smaller": the column-header strip indents its
    // master checkbox by exactly this box so "Producto" sits over the product names, and on touch
    // the box plus its `::before` is what reaches 44×44. So the box is asserted separately from
    // what is drawn inside it — the selected state went from a 32px block of accent to a 16px
    // checkbox without either of those moving.
    renderToggle({ checked: true });
    const label = screen.getByRole("checkbox").closest("label") as HTMLElement;

    expect(label.className).toContain("h-8 w-8");
    expect(label.className).toContain("before:absolute");

    const faces = label.querySelectorAll("span[aria-hidden]");
    // Rest fills the tile (it is the row's icon chip); the two checkbox faces are 16px, the box of
    // `Checkbox size="sm"` — the same control that heads this column and the mobile "Marcar todo".
    expect(faces[0].className).toContain("h-full w-full");
    expect(faces[1].className).toContain("size-4");
    expect(faces[2].className).toContain("size-4");
  });

  it("keeps the touch tile's own box at 36px, so the paint size is not breakpoint-dependent", () => {
    renderToggle({ variant: "card", checked: true });
    const label = screen.getByRole("checkbox").closest("label") as HTMLElement;

    expect(label.className).toContain("h-9 w-9");
    expect((label.querySelectorAll("span[aria-hidden]")[2] as HTMLElement).className).toContain("size-4");
  });

  it("renders no control at all for a product that cannot enter a delivery", () => {
    // A checkbox that can never be enabled from here is noise in the tab order; the row's own
    // state chip already says "En camino" in text, and the reason is on the tile for a pointer.
    renderToggle({ selectable: false, disabledReason: "En camino en otra entrega." });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(document.querySelector('[title="En camino en otra entrega."]')).not.toBeNull();
  });
});
