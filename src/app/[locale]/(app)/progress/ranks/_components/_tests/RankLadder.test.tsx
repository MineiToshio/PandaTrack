import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RankLadder from "../RankLadder";

const messages: Record<string, string> = {
  "ranksTab.ladderLabel": "Rank ladder",
  "ranksTab.summit": "The summit",
  "ranksTab.here": "You are here",
  "ranksTab.conquered": "Conquered",
  "ranksTab.locked": "Locked",
  "ranksTab.threshold": "{points} pts",
  "ranksTab.missing": "You need {points} pts",
  "ranksTab.meritNote": "Also asks for {percent} % of the album.",
  "ranksTab.collapsedSummary": "{count} more ranks between the summit and you",
  "rank.emblemLabel": "Emblem of {rank}",
  "summary.barLabel": "Progress toward {rank}",
  "summary.barValue": "{current} of {threshold} points toward {rank}",
  "summary.barNote": "{current} of {threshold} pts",
  "summary.toNextRank": "You need {points} pts for {rank}",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const template = messages[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ""));
  },
}));

/** The approved threshold curve, hardcoded so a silent recalibration fails this spec too. */
const THRESHOLDS = [0, 200, 670, 1370, 2260, 3340, 4600, 6020, 7610, 9350];

const RANK_KEYS = [
  "kohai",
  "preorder-hunter",
  "volume-keeper",
  "guild-senpai",
  "first-print-hunter",
  "limited-run-curator",
  "club-sensei",
  "rare-edition-archivist",
  "collection-shisho",
  "guild-legend",
];

const TOTAL_POINTS = 1842;
const CURRENT_RANK_INDEX = 4;

const ladderProps = {
  totalPoints: TOTAL_POINTS,
  currentRankIndex: CURRENT_RANK_INDEX,
  highestRankIndex: CURRENT_RANK_INDEX,
  nextRank: { rankKey: "first-print-hunter" as const, rankIndex: 5, threshold: 2260 },
  pointsToNextRank: 418,
  nextRankProgressPercent: 53,
};

/** The name copy a rank renders, given the mock falls through to the key for the `ranks.*` group. */
function rankName(rankIndex: number): string {
  return `ranks.${RANK_KEYS[rankIndex - 1]}.name`;
}

/** The ten rungs of the flat list, in document order, without the mobile disclosure row. */
function getFlatRungs(): HTMLElement[] {
  const ladder = screen.getByRole("list", { name: "Rank ladder" });
  return Array.from(ladder.children).filter((child): child is HTMLElement => !child.querySelector("details"));
}

describe("RankLadder", () => {
  it("renders all ten rungs, summit first", () => {
    render(<RankLadder {...ladderProps} />);

    const rungs = getFlatRungs();
    expect(rungs).toHaveLength(10);
    expect(rungs[0]).toHaveTextContent("The summit");

    rungs.forEach((rung, position) => {
      expect(rung).toHaveTextContent(rankName(10 - position));
    });
  });

  it("shows the threshold and the gap of every locked rank", () => {
    render(<RankLadder {...ladderProps} />);

    const rungs = getFlatRungs();
    for (let rankIndex = CURRENT_RANK_INDEX + 1; rankIndex <= 10; rankIndex += 1) {
      const rung = rungs[10 - rankIndex];
      const threshold = THRESHOLDS[rankIndex - 1];

      expect(rung).toHaveTextContent(`${threshold} pts`);
      expect(rung).toHaveTextContent(`You need ${threshold - TOTAL_POINTS} pts`);
      expect(rung).toHaveTextContent("Locked");
    }
  });

  it("marks the current rung and measures it against the next rank", () => {
    const { container } = render(<RankLadder {...ladderProps} />);

    const currentRung = getFlatRungs()[10 - CURRENT_RANK_INDEX];
    expect(currentRung).toHaveTextContent("You are here");
    // `RankLadderScrollToCurrent` finds its target through this marker, and only this one rung
    // should ever carry it (`RankLadder.test.tsx` scroll-anchor coverage).
    expect(container.querySelectorAll("[data-rank-current='true']")).toHaveLength(1);
    expect(currentRung).toHaveAttribute("data-rank-current", "true");
    expect(currentRung).toHaveTextContent("1370 pts");
    expect(within(currentRung).getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "1842 of 2260 points toward ranks.first-print-hunter.name",
    );
    expect(currentRung).toHaveTextContent("You need 418 pts for ranks.first-print-hunter.name");
  });

  it("marks every rank below the current one as conquered", () => {
    render(<RankLadder {...ladderProps} />);

    const rungs = getFlatRungs();
    for (let rankIndex = 1; rankIndex < CURRENT_RANK_INDEX; rankIndex += 1) {
      const rung = rungs[10 - rankIndex];
      expect(rung).toHaveTextContent("Conquered");
      expect(rung).toHaveTextContent(`${THRESHOLDS[rankIndex - 1]} pts`);
      expect(rung).not.toHaveTextContent("Locked");
    }
  });

  it("keeps the collapsed ranks' thresholds inside the mobile disclosure", () => {
    const { container } = render(<RankLadder {...ladderProps} />);

    const disclosure = container.querySelector("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure?.querySelector("summary")).toHaveTextContent("3 more ranks between the summit and you");

    for (const rankIndex of [7, 8, 9]) {
      const threshold = THRESHOLDS[rankIndex - 1];
      expect(disclosure).toHaveTextContent(rankName(rankIndex));
      expect(disclosure).toHaveTextContent(`${threshold} pts`);
      expect(disclosure).toHaveTextContent(`You need ${threshold - TOTAL_POINTS} pts`);
    }
  });

  it("carries the merit-lock note on the two ranks that require the album", () => {
    render(<RankLadder {...ladderProps} />);

    const rungs = getFlatRungs();
    expect(rungs[0]).toHaveTextContent("Also asks for 60 % of the album.");
    expect(rungs[1]).toHaveTextContent("Also asks for 45 % of the album.");
  });

  it("keeps the summit locked until it is reached, so its artwork is not the one reward on show", () => {
    const { container, rerender } = render(<RankLadder {...ladderProps} />);
    const summitEmblem = () => container.querySelector<HTMLElement>('figure[data-rank="10"]')!;

    // Unreached: a locked rung like any other, desaturated art and the locked ring.
    expect(summitEmblem().style.borderColor).toBe("var(--rank-band-locked)");
    expect(summitEmblem().querySelector("img")?.className).toContain("grayscale");

    rerender(
      <RankLadder
        {...ladderProps}
        totalPoints={9350}
        currentRankIndex={10}
        highestRankIndex={10}
        nextRank={null}
        pointsToNextRank={0}
        nextRankProgressPercent={100}
      />,
    );

    expect(summitEmblem().style.borderColor).toBe("var(--rank-band-top)");
    expect(summitEmblem().querySelector("img")?.className).not.toContain("grayscale");
  });

  it("centers the summit aura on the emblem it belongs to, not with auto margins", () => {
    const { container } = render(<RankLadder {...ladderProps} />);
    const summitEmblem = container.querySelector<HTMLElement>('figure[data-rank="10"]')!;
    const aura = summitEmblem.previousElementSibling as HTMLElement;

    // The aura is deliberately wider than the plate, and `inset-0` + `m-auto` cannot center a box
    // wider than its container on the INLINE axis: auto margins are forbidden from resolving
    // negative there, so the browser pins it left and hangs the whole surplus off the right. That
    // is how it came to read as a red smudge beside the summit's name rather than as light behind
    // its emblem, while looking perfectly centered vertically, where CSS has no such rule.
    expect(aura.className).not.toContain("m-auto");
    expect(aura.className).toContain("-translate-x-1/2");
    expect(aura.className).toContain("-translate-y-1/2");
    // Before the emblem in document order, so the plate's own art paints over it.
    expect(aura.nextElementSibling).toBe(summitEmblem);
  });
});
