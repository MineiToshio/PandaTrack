import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const { createStoreFromIntakeActionMock, confirmStoreMatchActionMock } = vi.hoisted(() => ({
  createStoreFromIntakeActionMock: vi.fn(),
  confirmStoreMatchActionMock: vi.fn(),
}));

vi.mock("../../../../_actions/imageIntakeStoreActions", () => ({
  createStoreFromIntakeAction: createStoreFromIntakeActionMock,
  confirmStoreMatchAction: confirmStoreMatchActionMock,
}));

import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import StoreResolutionSection from "../StoreResolutionSection";

function field<T>(value: T | null, source: "read" | "assumed" | null) {
  return { value, source };
}

function buildStore(overrides: Partial<ImageIntakeDraft["store"]> = {}): ImageIntakeDraft["store"] {
  return {
    matchedStoreId: null,
    name: field<string>(null, null),
    phone: field<string>(null, null),
    candidates: [],
    ...overrides,
  };
}

const OPTIONS = [{ id: "store-1", name: "Pop Dealer" }];

describe("StoreResolutionSection · certain", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders an attribute row with no step and no selection control", () => {
    const onChange = vi.fn();
    render(
      <StoreResolutionSection
        store={buildStore({ matchedStoreId: "store-1", name: field("Pop Dealer", "read") })}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("Pop Dealer")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it('reveals the store picker on "Cambiar" without changing the store yet', () => {
    const onChange = vi.fn();
    render(
      <StoreResolutionSection
        store={buildStore({ matchedStoreId: "store-1", name: field("Pop Dealer", "read") })}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("changeCta"));

    // The combobox opens with the current match already selected, so it renders its closed-select
    // button shape (not the search input) until the user reopens it. The field's own <label for>
    // association gives that toggle button its accessible name ("label", the mocked "Tienda" copy).
    expect(screen.getByRole("button", { name: "label" })).toBeTruthy();
    expect(screen.queryByText("changeCta")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("StoreResolutionSection · ambiguous", () => {
  beforeEach(() => vi.clearAllMocks());

  const CANDIDATES = [
    { storeId: "store-1", name: "Pop Dealer" },
    { storeId: "store-2", name: "Pop Dealer PE" },
  ];

  it('shows every candidate plus "none of these", with nothing preselected', () => {
    render(
      <StoreResolutionSection store={buildStore({ candidates: CANDIDATES })} options={OPTIONS} onChange={vi.fn()} />,
    );

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.every((radio) => !radio.checked)).toBe(true);
    expect(screen.getByText("noneOption")).toBeTruthy();
  });

  it("picking a candidate resolves the store and remembers the match", async () => {
    const onChange = vi.fn();
    confirmStoreMatchActionMock.mockResolvedValue({ ok: true });

    render(
      <StoreResolutionSection
        store={buildStore({ candidates: CANDIDATES, phone: field("987654321", "read") })}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Pop Dealer PE"));

    expect(onChange).toHaveBeenCalledWith("store-2");
    expect(confirmStoreMatchActionMock).toHaveBeenCalledWith({
      storeId: "store-2",
      phone: "987654321",
      candidateCount: 2,
    });
    // The list collapses into the same attribute-row shape a certain match uses.
    expect(await screen.findByText("Pop Dealer PE")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it('picking "none of these" opens the inline creation form instead of resolving a store', () => {
    const onChange = vi.fn();
    render(
      <StoreResolutionSection store={buildStore({ candidates: CANDIDATES })} options={OPTIONS} onChange={onChange} />,
    );

    fireEvent.click(screen.getByText("noneOption"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("createSubmit")).toBeTruthy();
    expect(screen.getByText("backToCandidates")).toBeTruthy();
  });
});

describe("StoreResolutionSection · unknown", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers inline creation prefilled with the extracted name, with no way to leave the screen", () => {
    render(
      <StoreResolutionSection
        store={buildStore({ name: field("Nueva Tienda", "read") })}
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Nueva Tienda")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("blocks submission with an empty name and never calls the create action", () => {
    render(<StoreResolutionSection store={buildStore()} options={OPTIONS} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("createSubmit"));

    expect(screen.getByText("createNameRequired")).toBeTruthy();
    expect(createStoreFromIntakeActionMock).not.toHaveBeenCalled();
  });

  it("creates the store and resolves to the attribute row on success", async () => {
    const onChange = vi.fn();
    createStoreFromIntakeActionMock.mockResolvedValue({
      ok: true,
      storeId: "store-9",
      name: "Nueva Tienda",
      status: "PENDING",
    });

    render(
      <StoreResolutionSection
        store={buildStore({ name: field("Nueva Tienda", "read"), phone: field("987654321", "read") })}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("createSubmit"));

    expect(await screen.findByText("Nueva Tienda")).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith("store-9");
    expect(createStoreFromIntakeActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nueva Tienda", phone: "987654321", wasAmbiguous: false }),
    );
  });

  it("shows near-duplicate candidates instead of creating, and lets the user create anyway", async () => {
    createStoreFromIntakeActionMock.mockResolvedValueOnce({
      ok: false,
      code: "possible-duplicate",
      candidates: [{ storeId: "store-5", name: "Nueva Tienda Store" }],
    });
    createStoreFromIntakeActionMock.mockResolvedValueOnce({
      ok: true,
      storeId: "store-9",
      name: "Nueva Tienda",
      status: "PENDING",
    });

    render(
      <StoreResolutionSection
        store={buildStore({ name: field("Nueva Tienda", "read") })}
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("createSubmit"));
    expect(await screen.findByText("Nueva Tienda Store")).toBeTruthy();

    fireEvent.click(screen.getByText("confirmCreate"));
    expect(await screen.findByText("Nueva Tienda")).toBeTruthy();
    expect(createStoreFromIntakeActionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmDuplicate: true }),
    );
  });
});
