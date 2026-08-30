import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FilterDrawer, { type FilterDrawerValues, type FilterSection } from "@/components/modules/FilterDrawer";

const PILL_SECTIONS: FilterSection[] = [
  {
    id: "status",
    type: "pills",
    label: "Estado",
    options: [
      { value: "open", label: "Abierto" },
      { value: "closed", label: "Cerrado" },
    ],
  },
];

const SWITCH_SECTIONS: FilterSection[] = [
  {
    id: "flags",
    type: "switches",
    label: "Opciones",
    options: [{ value: "active", label: "Activo" }],
  },
];

const AUTOCOMPLETE_SECTIONS: FilterSection[] = [
  {
    id: "countries",
    type: "autocomplete",
    label: "País",
    placeholder: "Buscar país…",
    options: [
      { value: "co", label: "Colombia" },
      { value: "mx", label: "México" },
      { value: "jp", label: "Japón" },
    ],
  },
];

const BASE_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  title: "Filtrar",
  sections: PILL_SECTIONS,
  values: {} as FilterDrawerValues,
  onChange: vi.fn(),
  onApply: vi.fn(),
  onClear: vi.fn(),
  applyLabel: "Aplicar",
  clearLabel: "Limpiar",
};

describe("FilterDrawer — open/closed state", () => {
  it("renders when open=true", () => {
    render(<FilterDrawer {...BASE_PROPS} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Filtrar")).toBeTruthy();
  });

  it("renders nothing when open=false", () => {
    render(<FilterDrawer {...BASE_PROPS} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("FilterDrawer — pills section", () => {
  it("renders pill options", () => {
    render(<FilterDrawer {...BASE_PROPS} />);
    expect(screen.getByText("Abierto")).toBeTruthy();
    expect(screen.getByText("Cerrado")).toBeTruthy();
  });

  it("pills have role=checkbox with aria-checked=false initially", () => {
    render(<FilterDrawer {...BASE_PROPS} />);
    const pills = screen.getAllByRole("checkbox");
    expect(pills[0].getAttribute("aria-checked")).toBe("false");
  });

  it("toggles aria-checked when pill is clicked", () => {
    const onChange = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} onChange={onChange} />);
    fireEvent.click(screen.getByText("Abierto"));
    expect(onChange).toHaveBeenCalledWith({ status: ["open"] });
  });

  it("selected pill gets aria-checked=true", () => {
    render(<FilterDrawer {...BASE_PROPS} values={{ status: ["open"] }} />);
    const pills = screen.getAllByRole("checkbox");
    expect(pills[0].getAttribute("aria-checked")).toBe("true");
    expect(pills[1].getAttribute("aria-checked")).toBe("false");
  });

  it("deselects a selected pill on second click", () => {
    const onChange = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} values={{ status: ["open"] }} onChange={onChange} />);
    fireEvent.click(screen.getByText("Abierto"));
    expect(onChange).toHaveBeenCalledWith({ status: [] });
  });
});

describe("FilterDrawer — switches section", () => {
  it("renders switch rows", () => {
    render(<FilterDrawer {...BASE_PROPS} sections={SWITCH_SECTIONS} />);
    expect(screen.getByText("Activo")).toBeTruthy();
    expect(screen.getByRole("switch")).toBeTruthy();
  });

  it("calls onChange when switch is toggled on", () => {
    const onChange = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} sections={SWITCH_SECTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith({ flags: ["active"] });
  });
});

describe("FilterDrawer — autocomplete section", () => {
  it("renders search input and unselected options as pills", () => {
    render(<FilterDrawer {...BASE_PROPS} sections={AUTOCOMPLETE_SECTIONS} />);
    expect(screen.getByPlaceholderText("Buscar país…")).toBeTruthy();
    expect(screen.getByText("Colombia")).toBeTruthy();
    expect(screen.getByText("México")).toBeTruthy();
    expect(screen.getByText("Japón")).toBeTruthy();
  });

  it("clicking an option adds it as a chip and calls onChange", () => {
    const onChange = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} sections={AUTOCOMPLETE_SECTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByText("Colombia"));
    expect(onChange).toHaveBeenCalledWith({ countries: ["co"] });
  });

  it("selected values appear as chips with remove button", () => {
    render(<FilterDrawer {...BASE_PROPS} sections={AUTOCOMPLETE_SECTIONS} values={{ countries: ["co"] }} />);
    expect(screen.getByLabelText("Remove Colombia")).toBeTruthy();
    // Colombia should not appear as an option pill anymore
    const optionPills = screen.queryAllByRole("button", { name: /Colombia/ });
    const removeBtns = screen.getAllByLabelText("Remove Colombia");
    expect(removeBtns.length).toBe(1);
    // only the remove button for Colombia should exist, not a selectable pill
    const allColombiaButtons = optionPills.filter((btn) => !btn.hasAttribute("aria-label"));
    expect(allColombiaButtons.length).toBe(0);
  });

  it("clicking chip X removes the selected value and calls onChange", () => {
    const onChange = vi.fn();
    render(
      <FilterDrawer
        {...BASE_PROPS}
        sections={AUTOCOMPLETE_SECTIONS}
        values={{ countries: ["co"] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Remove Colombia"));
    expect(onChange).toHaveBeenCalledWith({ countries: [] });
  });

  it("search input filters available options", () => {
    render(<FilterDrawer {...BASE_PROPS} sections={AUTOCOMPLETE_SECTIONS} />);
    const input = screen.getByPlaceholderText("Buscar país…");
    fireEvent.change(input, { target: { value: "Méx" } });
    expect(screen.queryByText("Colombia")).toBeNull();
    expect(screen.getByText("México")).toBeTruthy();
  });

  it("shows empty message when search yields no results", () => {
    render(<FilterDrawer {...BASE_PROPS} sections={AUTOCOMPLETE_SECTIONS} />);
    const input = screen.getByPlaceholderText("Buscar país…");
    fireEvent.change(input, { target: { value: "xyz" } });
    expect(screen.getByText("No matches.")).toBeTruthy();
  });
});

describe("FilterDrawer — footer", () => {
  it("shows applyCountLabel when resultsCount is provided", () => {
    render(<FilterDrawer {...BASE_PROPS} resultsCount={12} applyCountLabel={(n) => `Aplicar (${n})`} />);
    expect(screen.getByText("Aplicar (12)")).toBeTruthy();
  });

  it("calls onApply when apply button is clicked", () => {
    const onApply = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} onApply={onApply} applyLabel="Aplicar" />);
    fireEvent.click(screen.getByText("Aplicar"));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} onClear={onClear} clearLabel="Limpiar" />);
    fireEvent.click(screen.getByText("Limpiar"));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("FilterDrawer — a11y and keyboard", () => {
  it("dialog has aria-modal=true and aria-labelledby pointing to title", () => {
    render(<FilterDrawer {...BASE_PROPS} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const titleId = dialog.getAttribute("aria-labelledby");
    expect(titleId).toBeTruthy();
    const titleEl = document.getElementById(titleId!);
    expect(titleEl?.textContent).toBe("Filtrar");
  });

  it("closes on Escape key", () => {
    const onOpenChange = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does NOT close on backdrop click (only X button and Esc close)", () => {
    const onOpenChange = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} onOpenChange={onOpenChange} />);
    const backdrop = screen.getByRole("presentation");
    fireEvent.click(backdrop);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("close button calls onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<FilterDrawer {...BASE_PROPS} onOpenChange={onOpenChange} closeLabel="Cerrar" />);
    fireEvent.click(screen.getByLabelText("Cerrar"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
