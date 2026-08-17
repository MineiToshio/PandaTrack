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

  it("names the matched store with no step and no confirmation to give", () => {
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

  it("shows the picker straight away for a certain match, with no read-only row to click through", () => {
    const onChange = vi.fn();
    render(
      <StoreResolutionSection
        store={buildStore({ matchedStoreId: "store-1", name: field("Pop Dealer", "read") })}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    // The match used to render as a read-only row behind a "Cambiar" link, which cost a click to
    // reach a control that was going to be shown anyway. The picker is the row now, with the match
    // already selected. Its accessible name comes from the field's own <label for> ("label", the
    // mocked "Tienda" copy).
    expect(screen.getByRole("button", { name: "label" })).toBeTruthy();
    expect(screen.queryByText("changeCta")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lets the collector switch a certain match to "create a new store instead", clearing the pick', () => {
    const onChange = vi.fn();
    render(
      <StoreResolutionSection
        store={buildStore({ matchedStoreId: "store-1", name: field("Pop Dealer", "read") })}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("switchToCreate"));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText("createSubmit")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
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
    // The list collapses into the same picker a certain match shows. (The fixture's candidate is
    // not in `OPTIONS`, so the picker renders its search shape rather than the closed button; in
    // the app the candidate is always one of the collector's stores.)
    expect(await screen.findByLabelText("label")).toBeTruthy();
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

  it("searches the existing catalog by default, before ever offering to create a new store", () => {
    // The collector must be able to rule out an existing store first: the "unknown" shape used to
    // default straight into the inline creation form, which was easier than searching but wrong
    // more often, since the extraction misses a real match far more than it invents a store that
    // does not exist.
    render(
      <StoreResolutionSection
        store={buildStore({ name: field("Nueva Tienda", "read") })}
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByText("createSubmit")).toBeNull();
    expect(screen.getByText("switchToCreate")).toBeTruthy();
  });

  it('switches to inline creation, prefilled with the extracted name, once the collector says "not this one"', () => {
    render(
      <StoreResolutionSection
        store={buildStore({ name: field("Nueva Tienda", "read") })}
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("switchToCreate"));

    expect(screen.getByDisplayValue("Nueva Tienda")).toBeTruthy();
  });

  it("blocks submission with an empty name and never calls the create action", () => {
    render(<StoreResolutionSection store={buildStore()} options={OPTIONS} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("switchToCreate"));
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

    fireEvent.click(screen.getByText("switchToCreate"));
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

    fireEvent.click(screen.getByText("switchToCreate"));
    fireEvent.click(screen.getByText("createSubmit"));
    expect(await screen.findByText("Nueva Tienda Store")).toBeTruthy();

    fireEvent.click(screen.getByText("confirmCreate"));
    expect(await screen.findByText("Nueva Tienda")).toBeTruthy();
    expect(createStoreFromIntakeActionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmDuplicate: true }),
    );
  });

  it("lets the collector switch from creating a store back to searching the existing catalog", () => {
    // Mirrors the extraction naming the wrong seller (a marketplace link mid-conversation instead
    // of who the collector was actually messaging): the true store exists, so the escape hatch out
    // of "create" must reach the same catalog search shown by default.
    const onChange = vi.fn();
    render(
      <StoreResolutionSection
        store={buildStore({ name: field("Mercari", "read") })}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("switchToCreate"));
    fireEvent.click(screen.getByText("switchToSearch"));
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /Pop Dealer/ }));

    expect(onChange).toHaveBeenCalledWith("store-1");
    expect(screen.queryByText("createSubmit")).toBeNull();
  });
});

describe("StoreResolutionSection · error state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the picker invalid and shows the required message when no store is matched", () => {
    render(<StoreResolutionSection store={buildStore()} options={OPTIONS} onChange={vi.fn()} error />);

    const combobox = screen.getByRole("combobox");
    expect(combobox.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("saveStoreRequired")).toBeTruthy();
  });

  it("marks the candidate list invalid and shows the required message", () => {
    render(
      <StoreResolutionSection
        store={buildStore({ candidates: [{ storeId: "store-1", name: "Pop Dealer" }] })}
        options={OPTIONS}
        onChange={vi.fn()}
        error
      />,
    );

    expect(screen.getByRole("radiogroup").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("saveStoreRequired")).toBeTruthy();
  });

  it("keeps explaining the missing store while the collector is still creating one", () => {
    render(<StoreResolutionSection store={buildStore()} options={OPTIONS} onChange={vi.fn()} error />);

    fireEvent.click(screen.getByText("switchToCreate"));

    // This shape has no single control to red-border (a name field plus a submit action), so the
    // message is what tells the collector a store still needs to be finished, not a border alone.
    expect(screen.getByText("saveStoreRequired")).toBeTruthy();
  });

  it("shows no required-store message at all once a store is resolved", () => {
    render(
      <StoreResolutionSection
        store={buildStore({ matchedStoreId: "store-1", name: field("Pop Dealer", "read") })}
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("saveStoreRequired")).toBeNull();
  });
});
