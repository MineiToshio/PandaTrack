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

  it("drops the row variant's hit-area pseudo entirely at `lg`, instead of leaving a same-size no-op box", () => {
    // Hygiene, not the fix for the batch-arrival bug below (that one is the input's own hiding
    // technique). The row variant is the only one that ever renders at `lg` (its container is
    // `hidden lg:block`) and has nothing to expand into there, so `lg:before:inset-0` (still a
    // real, absolutely positioned, generated `::before` box the exact size of the label) is
    // replaced with `lg:before:content-none`, which drops the pseudo's box entirely instead of
    // merely resizing it to a same-size no-op.
    renderToggle({ checked: true });
    const label = screen.getByRole("checkbox").closest("label") as HTMLElement;

    expect(label.className).toContain("before:absolute");
    expect(label.className).toContain("before:[inset:-4px]");
    expect(label.className).toContain("lg:before:content-none");
    expect(label.className).not.toContain("lg:before:inset-0");
  });

  it("hides the input with an opaque, full-size box rather than a clip-based `sr-only` one", () => {
    // Regression for the actual root cause of the store-view batch-arrival checkbox failing 3/3
    // under Playwright: `sr-only` hides via `clip-path: inset(50%)` on a 1x1px box, which zeroes
    // the element's HIT-TESTABLE area, not merely its visible one (confirmed live:
    // `getComputedStyle(input).clipPath === "inset(50%)"`, and `document.elementFromPoint` at the
    // input's own reported center resolving to the `<label>`, never the input, at every
    // breakpoint). A pointing human never notices, because clicking anywhere in the label's box
    // activates the input through the browser's native `<label>` association, which never
    // hit-tests the input itself. Playwright's `.check()` does the opposite: it hit-tests the
    // target locator's own box directly, so a clip-based hide makes a control that IS the click
    // target (unlike an ordinary decorative `sr-only` node elsewhere in the app) permanently
    // unreachable by automation, no matter how clean the stacking above it is. `absolute inset-0
    // opacity-0` keeps the input invisible and same-footprint as the label while leaving a real,
    // hit-testable box at its reported position.
    //
    // jsdom has no layout engine and cannot reproduce `clip-path` hit-testing or
    // `elementFromPoint`, so this asserts the class that controls the technique rather than the
    // click actually landing on the input. That is the honest ceiling of a jsdom test here; the
    // real defect and the fix were both verified live via `page.evaluate`, referenced in the fix.
    renderToggle({ checked: true });
    const input = screen.getByRole("checkbox") as HTMLInputElement;

    expect(input.className).not.toContain("sr-only");
    expect(input.className).toContain("absolute");
    expect(input.className).toContain("inset-0");
    expect(input.className).toContain("opacity-0");
    // `peer` selectors elsewhere in this file (the three decorative layers' `peer-checked:` /
    // `peer-focus-visible:`) key off this class name, unrelated to how the input is hidden.
    expect(input.className).toContain("peer");
  });

  it("keeps every decorative glyph layer out of hit-testing", () => {
    // Regression for a Playwright-confirmed bug: the three `aria-hidden` glyph layers (package,
    // empty checkbox, filled checkbox) share one grid cell and cross only in opacity, and
    // `opacity-0` does NOT disable hit-testing. Without `pointer-events-none` the invisible glyph
    // stacked on top intercepts clicks meant for the real `<input>` underneath, which is exactly
    // what made the store-scoped batch arrival checklist fail to select reliably.
    //
    // jsdom has no layout engine and cannot do real hit-testing (no `elementFromPoint` that
    // reflects paint order), so this asserts the class is present on every decorative layer
    // instead of asserting the click actually reaches the input through a stacked sibling. That is
    // the honest ceiling of a jsdom test here; the real crossing was verified via a Playwright
    // trace, referenced in the fix.
    renderToggle({ checked: true });
    const label = screen.getByRole("checkbox").closest("label") as HTMLElement;
    const decorativeLayers = label.querySelectorAll("span[aria-hidden]");

    expect(decorativeLayers.length).toBe(3);
    decorativeLayers.forEach((layer) => {
      expect((layer as HTMLElement).className).toContain("pointer-events-none");
    });
  });
});
