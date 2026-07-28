import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminAccessDenied from "../AdminAccessDenied";

describe("AdminAccessDenied", () => {
  it("announces the refusal with a heading and supporting copy", () => {
    render(<AdminAccessDenied title="Acceso restringido" description="Esta área es solo para administradores." />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Acceso restringido" })).toBeTruthy();
    expect(screen.getByText("Esta área es solo para administradores.")).toBeTruthy();
  });
});
