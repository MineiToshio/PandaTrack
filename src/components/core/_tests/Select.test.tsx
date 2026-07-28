import { render, screen, fireEvent } from "@testing-library/react";
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
