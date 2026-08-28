import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorksLink from "../HowItWorksLink";

/**
 * The entry point the `Resumen` tab offers into the rules.
 *
 * Two things can quietly break it: a locale prefix dropped from the href, which sends a Spanish
 * reader to the default locale, and the trailing arrow leaking into the accessible name, which is
 * what turns a two-word link into "Cómo funciona " for a screen reader.
 */

describe("HowItWorksLink", () => {
  it("points at the explainer under the reader's own locale", () => {
    render(<HowItWorksLink locale="es" label="Cómo funciona" />);

    const link = screen.getByRole("link", { name: "Cómo funciona" });
    expect(link.getAttribute("href")).toBe("/es/progress/how-it-works");
  });

  it("keeps the arrow out of the accessible name", () => {
    render(<HowItWorksLink locale="en" label="How it works" />);

    const link = screen.getByRole("link", { name: "How it works" });
    expect(link.textContent).toBe("How it works");
    expect(link.getAttribute("href")).toBe("/en/progress/how-it-works");
  });
});
