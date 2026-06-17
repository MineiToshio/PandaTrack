import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchableSelect from "@/components/core/SearchableSelect";

const OPTIONS = [
  { value: "AR", label: "Argentina" },
  { value: "BR", label: "Brazil" },
  { value: "CL", label: "Chile" },
];

const BASE_PROPS = {
  id: "test-select",
  options: OPTIONS,
  placeholder: "Pick a country",
  clearLabel: "Clear selection",
  noResultsLabel: "No results",
};

describe("SearchableSelect — rendering", () => {
  it("shows placeholder when no value is selected", () => {
    render(<SearchableSelect {...BASE_PROPS} value={null} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Pick a country")).toBeTruthy();
  });

  it("shows the selected option label on the closed trigger", () => {
    render(<SearchableSelect {...BASE_PROPS} value="AR" onChange={vi.fn()} />);
    expect(screen.getByText("Argentina")).toBeTruthy();
  });

  it("emits a hidden input with the value when name is provided", () => {
    const { container } = render(<SearchableSelect {...BASE_PROPS} name="countryCode" value="BR" onChange={vi.fn()} />);
    const hidden = container.querySelector('input[type="hidden"][name="countryCode"]');
    expect(hidden?.getAttribute("value")).toBe("BR");
  });

  it("emits an empty hidden input when value is null", () => {
    const { container } = render(
      <SearchableSelect {...BASE_PROPS} name="countryCode" value={null} onChange={vi.fn()} />,
    );
    const hidden = container.querySelector('input[type="hidden"][name="countryCode"]');
    expect(hidden?.getAttribute("value")).toBe("");
  });
});

describe("SearchableSelect — filtering", () => {
  it("filters options by label as the user types", () => {
    render(<SearchableSelect {...BASE_PROPS} value={null} onChange={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "arg" } });
    expect(screen.getByText("Argentina")).toBeTruthy();
    expect(screen.queryByText("Brazil")).toBeNull();
  });

  it("filters options by value code", () => {
    render(<SearchableSelect {...BASE_PROPS} value={null} onChange={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "CL" } });
    expect(screen.getByText("Chile")).toBeTruthy();
    expect(screen.queryByText("Argentina")).toBeNull();
  });

  it("shows the no-results message when nothing matches", () => {
    render(<SearchableSelect {...BASE_PROPS} value={null} onChange={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("No results")).toBeTruthy();
  });
});

describe("SearchableSelect — selection and clearing", () => {
  it("calls onChange with the option value on click", () => {
    const onChange = vi.fn();
    render(<SearchableSelect {...BASE_PROPS} value={null} onChange={onChange} />);
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Brazil"));
    expect(onChange).toHaveBeenCalledWith("BR");
  });

  it("calls onChange with null when the clear button is pressed", () => {
    const onChange = vi.fn();
    render(<SearchableSelect {...BASE_PROPS} value="AR" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("hides the clear button when clearable is false", () => {
    render(<SearchableSelect {...BASE_PROPS} value="AR" onChange={vi.fn()} clearable={false} />);
    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
  });

  it("selects the active option with Enter", () => {
    const onChange = vi.fn();
    render(<SearchableSelect {...BASE_PROPS} value={null} onChange={onChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "chi" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("CL");
  });
});
