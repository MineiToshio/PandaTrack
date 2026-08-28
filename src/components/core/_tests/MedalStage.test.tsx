import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MedalStage, { resolveMedalArtSrc } from "@/components/core/MedalStage";

// `next/image` needs a Next request context to build its optimizer URL, which jsdom has not got.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} data-testid="medal-art" />
  ),
}));

const BASE = {
  medalKey: "first-order",
  grade: "normal" as const,
  imageSrc: "/medals/first-order.png",
  label: "Primer pedido, Tirada normal",
};

/** The stage the caller sees, whatever wraps it. */
function getStage(): HTMLElement {
  return screen.getByRole("img", { name: BASE.label }) as HTMLElement;
}

describe("MedalStage", () => {
  it("resolves an imageKey to its file, and a catalogue row without one to nothing", () => {
    expect(resolveMedalArtSrc("first-order")).toBe("/medals/first-order.png");
    expect(resolveMedalArtSrc(null)).toBeNull();
    expect(resolveMedalArtSrc(undefined)).toBeNull();
  });

  it("draws the artwork full bleed, with no plate and no rarity ring around it", () => {
    render(<MedalStage {...BASE} />);
    const stage = getStage();
    const art = screen.getByTestId("medal-art");

    // The pieces carry their own frame, and their rarity IS that frame (rim, rivets, light per print
    // run). The ring was a flatter second statement of it, drawn on top (owner feedback,
    // 2026-08-26). Nothing may draw one back: no border, no plate colour, no glow.
    expect(stage.style.borderColor).toBe("");
    expect(stage.style.background).toBe("");
    expect(stage.style.boxShadow).toBe("");
    expect(stage.className).not.toMatch(/rounded|border/);
    // A direct child, so `fill` resolves against the stage itself rather than a ring inside it.
    expect(art.parentElement).toBe(stage);
  });

  it("contains the artwork rather than covering it, because the set is not all circles", () => {
    render(<MedalStage {...BASE} />);

    // `object-cover` inside the old round mask is what trimmed the corners off the shields, the
    // pentagon and the star of the set: the "borde raro" the owner reported.
    const className = screen.getByTestId("medal-art").className;
    expect(className).toContain("object-contain");
    expect(className).not.toContain("object-cover");
  });

  it("drains a locked piece through the themed token and marks it with a padlock", () => {
    const { container, rerender } = render(<MedalStage {...BASE} locked />);

    expect(getStage()).toHaveAttribute("data-locked", "true");
    expect(screen.getByTestId("medal-art").className).toContain("[filter:var(--locked-art-filter)]");
    // The padlock is a corner chip, not a veil over the middle: an album whose job is to show the
    // collector what is waiting cannot cover the motif to say they have not got it. `ADR 0006` still
    // holds — the drain is never the only carrier, the chip and the card's own copy say it too.
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(<MedalStage {...BASE} />);
    expect(getStage()).not.toHaveAttribute("data-locked");
    expect(screen.getByTestId("medal-art").className).not.toContain("filter");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("falls back to the medallion glyph for a catalogue row with no artwork yet", () => {
    const { container } = render(<MedalStage {...BASE} imageSrc={null} />);

    expect(screen.queryByTestId("medal-art")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("publishes the catalogue key, and never the rarity as colour without the word", () => {
    render(<MedalStage {...BASE} grade="holo" label="La espera imposible, Holográfica" />);

    const stage = screen.getByRole("img", { name: "La espera imposible, Holográfica" });
    expect(stage).toHaveAttribute("data-medal", "first-order");
    // With the ring gone, this label is what carries the grade at the sizes where no chip sits
    // beside the piece (the dashboard strip, the toast).
    expect(stage.getAttribute("aria-label")).toContain("Holográfica");
  });

  it("takes its ceiling from `max-width`, never from a percentage inside the width itself", () => {
    render(<MedalStage {...BASE} size="lg" />);
    const stage = getStage();

    // The same declaration shape `RankEmblem` had to learn: `min(<size>, 100%)` collapses to zero in
    // a shrink-to-fit container, because the percentage asks for a width that container is still
    // deriving from this element. The ceiling exists for the narrow mobile grid cell; it must not
    // cost the stage its size everywhere else.
    expect(stage.style.width).not.toContain("%");
    expect(stage.style.width).toBe("var(--medal-stage-size, 168px)");
    expect(stage.style.maxWidth).toBe("100%");
    expect(stage.style.aspectRatio).toBe("1 / 1");
  });
});
