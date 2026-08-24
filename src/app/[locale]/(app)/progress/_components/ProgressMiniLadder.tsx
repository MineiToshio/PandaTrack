import { getTranslations } from "next-intl/server";
import RankEmblem, { type RankBand } from "@/components/core/RankEmblem";
import { RANK_LADDER, type RankLadderEntry } from "@/lib/data/progression/rankLadder";
import { cn } from "@/lib/styles";

export type ProgressMiniLadderProps = {
  locale: string;
  currentRankIndex: number;
};

/**
 * Three rungs of the ladder, the way the `Resumen` tab previews it: the one below, the current one,
 * and the one above.
 *
 * Only three, on purpose. This is a doorway into the `Rangos` tab, not a second copy of it, and a
 * ten-row list here would make the tab it links to redundant. At the ends of the ladder the window
 * slides rather than shrinking, so the preview is always three rows tall.
 */
export default async function ProgressMiniLadder({ locale, currentRankIndex }: ProgressMiniLadderProps) {
  const t = await getTranslations({ locale, namespace: "progress" });
  const rungs = selectRungs(currentRankIndex);

  return (
    <ol className="m-0 flex list-none flex-col gap-[var(--space-2)] p-0">
      {[...rungs].reverse().map((rung) => {
        const band = resolveBand(rung.rankIndex, currentRankIndex);
        const isCurrent = rung.rankIndex === currentRankIndex;

        return (
          <li
            key={rung.rankKey}
            className={cn(
              "flex items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border px-[var(--space-3)] py-[var(--space-2)]",
              isCurrent ? "[background:var(--surface-elevated)]" : "border-transparent",
            )}
            style={isCurrent ? { borderColor: "color-mix(in oklch, var(--accent) 28%, var(--surface))" } : undefined}
          >
            <RankEmblem
              rankIndex={rung.rankIndex}
              band={band}
              size="xs"
              label={t("rank.emblemLabel", { rank: t(`ranks.${rung.rankKey}.name`) })}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-text-title truncate [font-size:var(--text-body)] font-medium">
                {t(`ranks.${rung.rankKey}.name`)}
              </span>
              <span className="text-text-muted [font-family:var(--font-mono)] [font-size:var(--text-caption)]">
                {t("ranksTab.threshold", { points: rung.threshold })}
              </span>
            </span>
            {isCurrent && (
              <span className="text-accent shrink-0 [font-size:var(--text-caption)] font-medium">
                {t("ranksTab.here")}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The three-rung window around the current rank, clamped to the ends of the ladder. */
function selectRungs(currentRankIndex: number): RankLadderEntry[] {
  const windowSize = 3;
  const lowest = Math.min(Math.max(1, currentRankIndex - 1), RANK_LADDER.length - windowSize + 1);
  return RANK_LADDER.slice(lowest - 1, lowest - 1 + windowSize);
}

function resolveBand(rankIndex: number, currentRankIndex: number): RankBand {
  if (rankIndex === currentRankIndex) return "current";
  return rankIndex < currentRankIndex ? "conquered" : "locked";
}
