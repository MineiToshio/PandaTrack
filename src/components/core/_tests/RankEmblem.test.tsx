import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RankEmblem, { resolveRankArtSrc, type RankBand } from "@/components/core/RankEmblem";
import { RANK_KEYS } from "@/lib/data/progression/rankLadder";

// `next/image` needs a Next request context to build its optimizer URL, which jsdom has not got.
// The stand-in keeps the two attributes this suite is about: what was requested, and how it is
// painted.
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} data-testid="rank-art" />
  ),
}));

describe("RankEmblem", () => {
  it("resolves every rung of the ladder to its own file by convention alone", () => {
    expect(RANK_KEYS.map((_, index) => resolveRankArtSrc(index + 1))).toEqual(
      RANK_KEYS.map((key) => `/ranks/${key}.png`),
    );
    // Off the ladder there is no artwork to invent, and the emblem falls back to the numeral.
    expect(resolveRankArtSrc(0)).toBeNull();
    expect(resolveRankArtSrc(RANK_KEYS.length + 1)).toBeNull();
  });

  it("draws the rank's own artwork and never the numeral over it", () => {
    render(<RankEmblem rankIndex={10} band="top" label="Emblema de Leyenda viva" />);

    const art = screen.getByTestId("rank-art");
    expect(art).toHaveAttribute("src", "/ranks/guild-legend.png");
    // Decorative: the accessible name comes from the figure, so the artwork must not repeat it.
    expect(art).toHaveAttribute("alt", "");
    expect(screen.getByRole("img", { name: "Emblema de Leyenda viva" })).toHaveAttribute("data-rank", "10");
    expect(screen.queryByText("10")).not.toBeInTheDocument();
  });

  it("desaturates a locked rank instead of hiding it, and only a locked one", () => {
    const { rerender } = render(<RankEmblem rankIndex={7} band="locked" label="Emblema de Invocador" />);
    expect(screen.getByTestId("rank-art").className).toContain("grayscale");

    rerender(<RankEmblem rankIndex={7} band="conquered" label="Emblema de Invocador" />);
    expect(screen.getByTestId("rank-art").className).not.toContain("grayscale");
  });

  it("carries the ladder state as the plate's own ring token, one per band", () => {
    const bands: RankBand[] = ["conquered", "current", "locked", "top"];
    const rings = bands.map((band) => {
      const { unmount } = render(<RankEmblem rankIndex={4} band={band} label="l" />);
      const ring = (screen.getByRole("img", { name: "l" }) as HTMLElement).style.borderColor;
      unmount();
      return ring;
    });

    expect(rings).toEqual([
      "var(--rank-band-conquered)",
      "var(--rank-band-current)",
      "var(--rank-band-locked)",
      "var(--rank-band-top)",
    ]);
  });

  it("keeps the size a redeclarable custom property rather than a fixed inline width", () => {
    render(<RankEmblem rankIndex={1} band="current" size="xl" label="l" />);

    // The fallback carries the size; a caller raising `--rank-emblem-size` at a breakpoint has to
    // win, which an inline width would never let it do.
    expect((screen.getByRole("img", { name: "l" }) as HTMLElement).style.width).toBe(
      "min(var(--rank-emblem-size, 148px), 100%)",
    );
  });
});
