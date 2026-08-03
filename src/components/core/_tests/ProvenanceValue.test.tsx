import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProvenanceValue, { resolveProvenanceState } from "../ProvenanceValue";

describe("resolveProvenanceState", () => {
  it("treats a value the source actually stated as read", () => {
    expect(resolveProvenanceState({ value: "PEN", source: "read" })).toBe("read");
  });

  it("treats a value filled in by convention as assumed", () => {
    expect(resolveProvenanceState({ value: "PEN", source: "assumed" })).toBe("assumed");
  });

  it("treats an absent value as missing whichever half of the pair is null", () => {
    expect(resolveProvenanceState({ value: null, source: null })).toBe("missing");
    expect(resolveProvenanceState({ value: null, source: "read" })).toBe("missing");
  });
});

describe("ProvenanceValue", () => {
  it("renders a read value as plain text with nothing focusable", () => {
    const { container } = render(
      <ProvenanceValue
        id="currency"
        label="Moneda"
        state="read"
        readText="PEN"
        control={() => <input id="currency" />}
      />,
    );

    expect(screen.getByText("PEN")).toBeTruthy();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders an assumed value as a control whose accessible name carries the marker word", () => {
    render(
      <ProvenanceValue
        id="currency"
        label="Moneda"
        state="assumed"
        markerLabel="asumido"
        control={({ id }) => <input id={id} defaultValue="PEN" />}
      />,
    );

    const control = screen.getByLabelText(/Moneda/);
    expect(control.tagName).toBe("INPUT");
    // The word, not only the amber tint, is what communicates the state (ADR 0006).
    expect(screen.getByText("asumido")).toBeTruthy();
    expect(control.getAttribute("id")).toBe("currency");
  });

  it("renders a missing value as a control and marks it with its own word", () => {
    render(
      <ProvenanceValue
        id="total"
        label="Total"
        state="missing"
        markerLabel="falta"
        control={({ id }) => <input id={id} />}
      />,
    );

    expect(screen.getByLabelText(/Total/).tagName).toBe("INPUT");
    expect(screen.getByText("falta")).toBeTruthy();
  });

  it("renders the supporting hint under any state", () => {
    render(<ProvenanceValue id="store" label="Tienda" state="read" readText="Pop Dealer" hint='Del chat: "pop"' />);
    expect(screen.getByText('Del chat: "pop"')).toBeTruthy();
  });
});
