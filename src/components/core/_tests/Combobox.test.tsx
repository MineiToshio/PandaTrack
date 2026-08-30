import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Combobox from "@/components/core/Combobox";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma", disabled: true },
];

/** `placeholder`/`searchPlaceholder` are required props; tests that don't assert on their text
 *  still need a value to pass. */
const REQUIRED_LABELS = { placeholder: "Choose one", searchPlaceholder: "Search…" };

describe("Combobox — trigger rendering", () => {
  it("shows placeholder when no value is selected", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeTruthy();
  });

  it("shows selected option label (single mode)", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value="a" onChange={vi.fn()} />);
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("has role=combobox on the trigger button", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeTruthy();
  });
});

describe("Combobox — popover open/close", () => {
  it("opens popover on trigger click", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("shows all non-disabled options in popover", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("Gamma")).toBeTruthy();
  });
});

describe("Combobox — search filtering", () => {
  it("filters options based on search input", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    const search = screen.getByRole("textbox");
    fireEvent.change(search, { target: { value: "al" } });
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.queryByText("Beta")).toBeNull();
  });

  it("shows no results message when filter finds nothing", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    const search = screen.getByRole("textbox");
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No results.")).toBeTruthy();
  });
});

describe("Combobox — single mode selection", () => {
  it("calls onChange with selected value", () => {
    const onChange = vi.fn();
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    const option = screen.getByRole("option", { name: "Alpha" });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith("a");
  });
});

describe("Combobox — multi mode", () => {
  it("renders chips for selected values", () => {
    render(<Combobox {...REQUIRED_LABELS} mode="multi" options={OPTIONS} value={["a", "b"]} onChange={vi.fn()} />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("removes chip on x button click", () => {
    const onChange = vi.fn();
    render(<Combobox {...REQUIRED_LABELS} mode="multi" options={OPTIONS} value={["a", "b"]} onChange={onChange} />);
    const removeAlpha = screen.getByRole("button", { name: "Remove Alpha" });
    fireEvent.click(removeAlpha);
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("adds value when option selected in multi mode", () => {
    const onChange = vi.fn();
    render(<Combobox {...REQUIRED_LABELS} mode="multi" options={OPTIONS} value={["a"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    const option = screen.getByRole("option", { name: "Beta" });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
  });
});

describe("Combobox — inlineAction", () => {
  it("renders inlineAction label in popover", () => {
    const onClick = vi.fn();
    render(
      <Combobox
        {...REQUIRED_LABELS}
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        inlineAction={{ label: "Create new store", onClick }}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Create new store")).toBeTruthy();
  });

  it("calls inlineAction.onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <Combobox
        {...REQUIRED_LABELS}
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        inlineAction={{ label: "Create new store", onClick }}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Create new store"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Combobox — disabled state", () => {
  it("does not open popover when disabled", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} disabled />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Combobox — error/helper", () => {
  it("renders error message", () => {
    render(<Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} error="Required field." />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Required field.")).toBeTruthy();
  });

  it("renders helper text when no error", () => {
    render(
      <Combobox {...REQUIRED_LABELS} options={OPTIONS} value={null} onChange={vi.fn()} helperText="Pick up to 3." />,
    );
    expect(screen.getByText("Pick up to 3.")).toBeTruthy();
  });
});
