import { existsSync } from "node:fs";
import { join } from "node:path";
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
      "var(--rank-emblem-size, 148px)",
    );
  });

  it("takes its ceiling from `max-width`, never from a percentage inside the width itself", () => {
    render(<RankEmblem rankIndex={1} band="current" size="md" label="l" />);
    const emblem = screen.getByRole("img", { name: "l" }) as HTMLElement;

    // The regression this pins: `width: min(<size>, 100%)`. It reads as a harmless ceiling and
    // behaves as one in a container of known width, but in a SHRINK-TO-FIT container the percentage
    // asks for a width the container is still deriving from this very element. CSS breaks the cycle
    // by handing `min()` a zero, and the emblem collapses — 84px became 4.6px on the ladder summit,
    // silently, with the artwork gone and the ring around it left painting on bare card.
    expect(emblem.style.width).not.toContain("%");
    expect(emblem.style.maxWidth).toBe("100%");
    // Both axes definite the moment the width is, or `fill` finds a zero-height parent.
    expect(emblem.style.aspectRatio).toBe("1 / 1");
  });

  it("points every rung of the ladder at a file that actually exists in public/ranks", () => {
    // The path is convention alone, so a rank whose art nobody dropped in ships a blank box with no
    // error anywhere: the request 404s and `next/image` renders nothing. Only a check against the
    // filesystem can see that, and the types certainly cannot.
    const missing = RANK_KEYS.filter(
      (rankKey) => !existsSync(join(process.cwd(), "public", "ranks", `${rankKey}.png`)),
    );

    expect(missing).toEqual([]);
  });
});
