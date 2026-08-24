import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MedalCard from "@/components/modules/MedalCard";

/**
 * The card's three states, which are the whole point of it.
 *
 * The risks worth a test are the ones a screenshot would not catch: a locked medal whose state is
 * carried only by desaturation, a secret medal whose name leaks through the accessible name, and a
 * rarity that renders as a colour with no word beside it.
 */

const BASE = {
  medalKey: "first-order",
  grade: "normal" as const,
  rarityLabel: "Tirada normal",
  href: "/es/progress/medals/first-order",
};

describe("MedalCard", () => {
  it("names the medal, its condition and its unlock date once it is held", () => {
    render(
      <MedalCard
        {...BASE}
        title="Primer pedido"
        description="Registra tu primer pedido."
        artLabel="Primer pedido, Tirada normal"
        linkLabel="Ver el detalle de Primer pedido"
        locked={false}
        unlockedOn="3 feb 2026"
      />,
    );

    expect(screen.getByRole("heading", { name: "Primer pedido" })).toBeTruthy();
    expect(screen.getByText("Registra tu primer pedido.")).toBeTruthy();
    expect(screen.getByText("3 feb 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver el detalle de Primer pedido" })).toBeTruthy();
  });

  it("spells the rarity out in words, never as colour alone (ADR 0006)", () => {
    render(
      <MedalCard
        {...BASE}
        grade="holo"
        rarityLabel="Holográfica"
        title="La espera imposible"
        description="Recibe un pedido 200 días o más después de haberlo hecho."
        artLabel="La espera imposible, Holográfica"
        linkLabel="Ver el detalle de La espera imposible"
        locked={false}
      />,
    );

    expect(screen.getByText("Holográfica")).toBeTruthy();
    // The art slot carries the grade too, for the sizes where the chip is not beside it.
    expect(screen.getByRole("img", { name: "La espera imposible, Holográfica" })).toBeTruthy();
  });

  it("states a locked medal's condition as an instruction, not as a dimmed illustration", () => {
    render(
      <MedalCard
        {...BASE}
        medalKey="first-review"
        title="Primera reseña"
        description="Reseña una tienda de la que ya recibiste un producto."
        hintLabel="Cómo conseguirla"
        artLabel="Primera reseña, Tirada normal"
        linkLabel="Ver el detalle de Primera reseña"
        locked
      />,
    );

    expect(screen.getByText("Cómo conseguirla")).toBeTruthy();
    expect(screen.getByText("Reseña una tienda de la que ya recibiste un producto.")).toBeTruthy();
    // No date on a medal nobody has: an empty "unlocked on" would read as a bug.
    expect(screen.queryByText(/\d{4}/)).toBeNull();
  });

  it("leaks neither the name nor the condition of a locked secret medal (FR-12-25)", () => {
    render(
      <MedalCard
        {...BASE}
        medalKey="midnight-order"
        grade="first-print"
        rarityLabel="Primera edición"
        title="Medalla bloqueada"
        description="Sin pista todavía"
        hintLabel="Cómo conseguirla"
        artLabel="Medalla bloqueada, Primera edición"
        linkLabel="Ver el detalle de una medalla bloqueada"
        locked
      />,
    );

    expect(screen.getByRole("heading", { name: "Medalla bloqueada" })).toBeTruthy();
    expect(screen.getByText("Sin pista todavía")).toBeTruthy();
    // Not through the visible copy, and not through the accessible name of the link either.
    expect(screen.queryByText(/madrugada/i)).toBeNull();
    expect(screen.getByRole("link").getAttribute("aria-label")).toBe("Ver el detalle de una medalla bloqueada");
  });

  it("publishes the catalogue key on the art slot, so real artwork can be dropped in per medal", () => {
    const { container } = render(
      <MedalCard
        {...BASE}
        medalKey="patience-60"
        title="Dos meses de espera"
        description="Recibe un pedido 60 días o más después de haberlo hecho."
        artLabel="Dos meses de espera, Tirada normal"
        linkLabel="Ver el detalle de Dos meses de espera"
        locked={false}
      />,
    );

    expect(container.querySelector('[data-medal="patience-60"]')).toBeTruthy();
  });

  it("says out loud that a stateful medal is no longer current, without hiding it", () => {
    render(
      <MedalCard
        {...BASE}
        medalKey="first-order-closed"
        title="Círculo cerrado"
        description="Cierra un pedido: pagado por completo y con todo recibido."
        artLabel="Círculo cerrado, Tirada normal"
        linkLabel="Ver el detalle de Círculo cerrado"
        locked={false}
        unlockedOn="3 feb 2026"
        statusLabel="Ya no vigente"
      />,
    );

    expect(screen.getByRole("heading", { name: "Círculo cerrado" })).toBeTruthy();
    expect(screen.getByText("Ya no vigente")).toBeTruthy();
    expect(screen.getByText("3 feb 2026")).toBeTruthy();
  });
});
