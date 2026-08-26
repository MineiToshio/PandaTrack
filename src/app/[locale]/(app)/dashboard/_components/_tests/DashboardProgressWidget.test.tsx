import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MedalShowcase } from "@/lib/data/progression/medalQueries";
import type { ProgressSummary } from "@/lib/data/progression/progressionQueries";
import DashboardProgressWidget from "../DashboardProgressWidget";

const translationMap: Record<string, string> = {
  "widget.eyebrow": "Tu rango",
  "widget.pointsCaption": "puntos",
  "widget.monthChip": "+{points} este mes",
  "widget.recentTitle": "Últimas medallas",
  "widget.albumLink": "Ver el álbum {unlocked} de {total}",
  "widget.open": "Ver mi progreso",
  "widget.medalLabel": "Medalla {name}, {rarity}",
  "widget.empty": "Registra tu primer pedido y empieza a sumar puntos.",
  "rank.position": "Rango {index} de 10",
  "rank.emblemLabel": "Emblema de {rank}",
  "summary.barLabel": "Progreso hacia {rank}",
  "summary.barValue": "{current} de {threshold} puntos hacia {rank}",
  "summary.barNote": "{current} de {threshold} pts",
  "summary.toNextRank": "Te faltan {points} pts para {rank}",
  "summary.atTop": "Llegaste al último rango de la escalera.",
  "ranks.guild-senpai.name": "Senpai del gremio",
  "ranks.first-print-hunter.name": "Portador del filo",
  "ranks.guild-legend.name": "Leyenda viva, Rango S",
  "rarity.normal": "Tirada normal",
  "rarity.holo": "Holográfica",
  "medals.first-order.name": "Primer pedido",
  "medals.first-payment.name": "Primer pago",
  "medals.first-arrival.name": "Primera llegada",
  "medals.first-review.name": "Primera reseña",
  "medals.first-store.name": "Puerta nueva",
  "medals.split-arrival.name": "Llega por partes",
};

/** Interpolates `{token}` the way next-intl does, so assertions read the real rendered sentence. */
function translate(key: string, values?: Record<string, string | number>): string {
  const template = translationMap[key] ?? key;
  if (!values) return template;
  return Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template,
  );
}

vi.mock("next-intl", () => ({
  useTranslations: () => translate,
}));

const baseSummary: ProgressSummary = {
  hasPoints: true,
  hasHistoricalProgress: true,
  totalPoints: 1500,
  currentRankIndex: 4,
  currentRankKey: "guild-senpai",
  highestRankIndex: 4,
  nextRank: { rankKey: "first-print-hunter", rankIndex: 5, threshold: 2260 },
  pointsToNextRank: 760,
  nextRankProgressPercent: 14.6,
  pointsThisMonth: 120,
  monthlyGroups: [],
  meritLock: null,
  stale: false,
  lastRecomputedAt: new Date("2026-08-20T00:00:00.000Z"),
};

const UNLOCKED_AT = new Date("2026-08-01T00:00:00.000Z");

const showcaseEntry = (
  medalKey: string,
  overrides: Partial<MedalShowcase["entries"][number]> = {},
): MedalShowcase["entries"][number] => ({
  medalKey,
  series: "first-steps",
  rarity: "normal",
  secret: false,
  shipped: true,
  unlocked: true,
  unlockedAt: UNLOCKED_AT,
  numbered: false,
  serialNumber: null,
  imageKey: null,
  isCurrentlyValid: null,
  ...overrides,
});

const baseMedals: MedalShowcase = {
  entries: [
    showcaseEntry("first-order"),
    showcaseEntry("first-payment"),
    showcaseEntry("first-arrival"),
    showcaseEntry("first-review"),
    showcaseEntry("first-store", { rarity: "holo" }),
    showcaseEntry("split-arrival"),
  ],
  unlockedCount: 6,
  shippedCount: 24,
};

const renderWidget = (summary: ProgressSummary = baseSummary, medals: MedalShowcase = baseMedals) =>
  render(<DashboardProgressWidget locale="es" summary={summary} medals={medals} />);

describe("DashboardProgressWidget", () => {
  it("renders the rank, its ladder position and the points still missing", () => {
    renderWidget();

    expect(screen.getByRole("heading", { name: "Senpai del gremio" })).toBeInTheDocument();
    expect(screen.getByText("Rango 4 de 10")).toBeInTheDocument();
    // Literal, and grouped the app's way rather than the UI locale's: number layout in PandaTrack
    // is locale-independent, so a Spanish reader sees `1,500` here exactly as they see `1,500.00`
    // on the amount beside it. Asserting `toLocaleString("es")` would have re-encoded the bug.
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("puntos")).toBeInTheDocument();
    expect(screen.getByText("+120 este mes")).toBeInTheDocument();
    expect(screen.getByText("1500 de 2260 pts")).toBeInTheDocument();
    expect(screen.getByText("Te faltan 760 pts para Portador del filo")).toBeInTheDocument();
  });

  it("draws the progress bar without motion and announces the denominator", () => {
    renderWidget();

    const bar = screen.getByRole("progressbar", { name: "Progreso hacia Portador del filo" });
    expect(bar).toHaveAttribute("aria-valuetext", "1500 de 2260 puntos hacia Portador del filo");
    expect(bar.querySelector("span")?.className).not.toContain("transition-transform");
  });

  it("caps the tick row at five medals and labels each one with its rarity", () => {
    renderWidget();

    const ticks = screen.getAllByRole("img", { name: /^Medalla/ });
    expect(ticks).toHaveLength(5);
    expect(screen.getByRole("img", { name: "Medalla Primer pedido, Tirada normal" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Medalla Puerta nueva, Holográfica" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Llega por partes/ })).not.toBeInTheDocument();
  });

  it("names a secret medal once it is held, like the album does", () => {
    renderWidget(baseSummary, {
      ...baseMedals,
      entries: [showcaseEntry("first-order", { secret: true, rarity: "holo" })],
      unlockedCount: 1,
    });

    // Secrecy ends at the unlock (`FR-12-25`); every tick here is a medal the collector holds, so
    // hiding the name would be a second, stricter rule for the same piece.
    expect(screen.getByRole("img", { name: "Medalla Primer pedido, Holográfica" })).toBeInTheDocument();
  });

  it("links the album with its unlocked counter", () => {
    renderWidget();

    const albumLink = screen.getByRole("link", { name: "Ver el álbum 6 de 24" });
    expect(albumLink).toHaveAttribute("href", "/es/progress/medals");
  });

  it("clicks through to the progress section and reports the rank to analytics", () => {
    renderWidget();

    const link = screen.getByRole("link", { name: "Ver mi progreso" });
    expect(link).toHaveAttribute("href", "/es/progress");
    expect(link).toHaveAttribute("data-ph-event", "progress_widget_clicked");
    expect(link).toHaveAttribute("data-ph-props", JSON.stringify({ current_rank_index: 4 }));
  });

  it("exposes exactly one rank emblem to assistive tech", () => {
    renderWidget();

    expect(screen.getAllByRole("img", { name: "Emblema de Senpai del gremio" })).toHaveLength(1);
  });

  it("states the empty progression honestly instead of showing a zero figure", () => {
    renderWidget(
      {
        ...baseSummary,
        hasPoints: false,
        totalPoints: 0,
        currentRankIndex: 1,
        currentRankKey: "kohai",
        highestRankIndex: 1,
        pointsThisMonth: 0,
      },
      { entries: [], unlockedCount: 0, shippedCount: 24 },
    );

    expect(screen.getByText("Registra tu primer pedido y empieza a sumar puntos.")).toBeInTheDocument();
    expect(screen.queryByText("puntos")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver el álbum 0 de 24" })).toBeInTheDocument();
  });

  it("says the ladder is finished at the top rank instead of counting down", () => {
    renderWidget({
      ...baseSummary,
      totalPoints: 9800,
      currentRankIndex: 10,
      currentRankKey: "guild-legend",
      highestRankIndex: 10,
      nextRank: null,
      pointsToNextRank: 0,
      nextRankProgressPercent: 100,
    });

    expect(screen.getByText("Llegaste al último rango de la escalera.")).toBeInTheDocument();
    expect(screen.queryByText(/Te faltan/)).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
