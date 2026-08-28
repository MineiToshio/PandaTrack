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
    // Source order is summit-first, which is how the stacked list has to read. Laid out in a row it
    // has to climb left to right instead, and reversing the flex direction gets that without giving
    // the two layouts two different DOM orders to keep in step.
    <ol className="m-0 flex list-none flex-col gap-[var(--space-2)] p-0 sm:flex-row-reverse sm:items-stretch sm:gap-[var(--space-3)]">
      {[...rungs].reverse().map((rung) => {
        const band = resolveBand(rung.rankIndex, currentRankIndex);
        const isCurrent = rung.rankIndex === currentRankIndex;

        return (
          <li
            key={rung.rankKey}
            className={cn(
              "flex items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border px-[var(--space-3)] py-[var(--space-2)]",
              // Three abreast from `sm` up, the way the approved prototype draws this doorway, and
              // stacked below it, where three columns would leave every rank name in a 100px well.
              "sm:min-w-0 sm:flex-1 sm:flex-col sm:gap-[var(--space-2)] sm:px-[var(--space-2)] sm:py-[var(--space-3)] sm:text-center",
              isCurrent ? "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]" : "border-transparent",
            )}
            style={isCurrent ? { borderColor: "color-mix(in oklch, var(--accent) 28%, var(--surface))" } : undefined}
          >
            <RankEmblem
              rankIndex={rung.rankIndex}
              band={band}
              size="xs"
              label={t("rank.emblemLabel", { rank: t(`ranks.${rung.rankKey}.name`) })}
            />
            <span className="flex min-w-0 flex-1 flex-col sm:w-full sm:flex-none sm:items-center">
              {/* One line with an ellipsis in the stacked row, two wrapped lines in the narrow
                  column, where an ellipsis would eat most of a rank name. */}
              <span className="text-text-title truncate [font-size:var(--text-body)] font-medium sm:overflow-visible sm:text-center sm:[font-size:var(--text-caption)] sm:leading-tight sm:whitespace-normal">
                {t(`ranks.${rung.rankKey}.name`)}
              </span>
              <span className="text-text-muted [font-family:var(--font-mono)] [font-size:var(--text-caption)]">
                {t("ranksTab.threshold", { points: rung.threshold })}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 [font-size:var(--text-caption)] font-medium",
                isCurrent ? "text-accent" : "text-text-muted max-sm:hidden",
              )}
            >
              {isCurrent ? t("ranksTab.here") : t(`ranksTab.${band === "conquered" ? "conquered" : "locked"}`)}
            </span>
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
