import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import Select from "@/components/core/Select";

// jsdom does not implement scrollIntoView; the active-option scroll effect calls it defensively.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const OPTIONS = [
  { value: "AR", label: "Argentina" },
  { value: "BR", label: "Brazil" },
  { value: "CL", label: "Chile", disabled: true },
  { value: "PE", label: "Peru" },
];

const BASE_PROPS = {
  id: "test-select",
  options: OPTIONS,
  placeholder: "Pick a country",
  clearLabel: "Clear selection",
};

describe("ControlledSelect — keyboard navigation", () => {
  it("opens with Enter and highlights the first option on ArrowDown", async () => {
    const user = userEvent.setup();
    render(<Select {...BASE_PROPS} value={null} onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}");

    const activeDescendant = trigger.getAttribute("aria-activedescendant");
    expect(activeDescendant).toBeTruthy();
    const activeOption = screen.getByRole("option", { name: "Argentina" });
    expect(activeOption.id).toBe(activeDescendant);
    expect(activeOption).toHaveAttribute("aria-selected", "false");
  });

  it("moves the highlight down and up with ArrowDown/ArrowUp", async () => {
    const user = userEvent.setup();
    render(<Select {...BASE_PROPS} value={null} onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}"); // Argentina
    await user.keyboard("{ArrowDown}"); // Brazil

    expect(trigger.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: "Brazil" }).id);

    await user.keyboard("{ArrowUp}"); // back to Argentina

    expect(trigger.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: "Argentina" }).id);
  });

  it("selects the active option with Enter and closes the dropdown", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select {...BASE_PROPS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}"); // Argentina
    await user.keyboard("{ArrowDown}"); // Brazil
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("BR");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  it("selects the active option with Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select {...BASE_PROPS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}"); // Argentina
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledWith("AR");
  });

  it("closes with Escape without selecting and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select {...BASE_PROPS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  it("does not select a disabled option reached via keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select {...BASE_PROPS} value={null} onChange={onChange} />);

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}"); // Argentina
    await user.keyboard("{ArrowDown}"); // Brazil
    await user.keyboard("{ArrowDown}"); // Chile (disabled)
    await user.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
    // Dropdown stays open since nothing was selected.
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("still supports mouse click selection", () => {
    const onChange = vi.fn();
    render(<Select {...BASE_PROPS} value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Peru" }));

    expect(onChange).toHaveBeenCalledWith("PE");
  });
});

describe("ControlledSelect — grouped options heading", () => {
  // Every listing-page select (Orders/Deliveries/Stores sort, Orders group-by) passes a single
  // `SelectGroup` so the listbox names what the user is choosing when it opens — see
  // `docs/design/interface-patterns.md` §3 "Toggle choice groups, switches, selects". This test
  // covers the shared mechanism all of those callers rely on.
  const GROUPED_OPTIONS = [{ heading: "Sort by", options: OPTIONS }];

  it("shows the group heading in the listbox when opened", () => {
    render(<Select {...BASE_PROPS} options={GROUPED_OPTIONS} value={null} onChange={vi.fn()} />);

    // The invisible width sizer also stacks the heading text (see the sizer test below), so once
    // the listbox is open two "Sort by" text nodes exist in the DOM; scope the query to the real
    // listbox to assert on the *visible* heading, not the hidden measuring copy.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox"));

    const listbox = within(screen.getByRole("listbox"));
    expect(listbox.getByText("Sort by")).toBeInTheDocument();
    expect(listbox.getByRole("option", { name: "Argentina" })).toBeInTheDocument();
  });

  it("keeps the visible heading on a single line", () => {
    render(<Select {...BASE_PROPS} options={GROUPED_OPTIONS} value={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("combobox"));

    expect(within(screen.getByRole("listbox")).getByText("Sort by")).toHaveClass("whitespace-nowrap");
  });

  it("includes the group heading, in its own typography, in the invisible width sizer", () => {
    // A heading (mono, uppercase eyebrow) is often visually wider per character than a plain
    // option label, so it needs its own sizer entry — otherwise a heading longer than every
    // option (e.g. "Agrupar por" over "Pedidos"/"Tiendas") wraps to two lines once the listbox
    // opens, even though every individual option fits on one line. See `docs/design/interface-
    // patterns.md` §3 "Every listing-page select declares its own heading".
    const { container } = render(<Select {...BASE_PROPS} options={GROUPED_OPTIONS} value={null} onChange={vi.fn()} />);

    const sizer = container.querySelector('[data-testid="select-width-sizer"]');
    expect(sizer).not.toBeNull();

    const headingSizerEntry = sizer?.querySelector('[data-testid="select-width-sizer-heading"]');
    expect(headingSizerEntry).not.toBeNull();
    expect(headingSizerEntry).toHaveTextContent("Sort by");
    expect(headingSizerEntry).toHaveClass("whitespace-nowrap");
    // Rendered with the heading's own typography (mono, uppercase eyebrow), not the body option
    // font a plain sizer span uses — otherwise the measured width still doesn't match what the
    // listbox actually paints.
    expect(headingSizerEntry?.className).toContain("uppercase");
    expect(headingSizerEntry?.className).toContain("font-mono");
  });

  it("omits the heading sizer entry for plain, non-grouped options", () => {
    const { container } = render(<Select {...BASE_PROPS} value={null} onChange={vi.fn()} />);

    const sizer = container.querySelector('[data-testid="select-width-sizer"]');
    expect(sizer?.querySelector('[data-testid="select-width-sizer-heading"]')).toBeNull();
  });
});
