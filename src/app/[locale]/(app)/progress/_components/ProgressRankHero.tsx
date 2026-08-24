import Card from "@/components/core/Card";
import Chip from "@/components/core/Chip";
import Eyebrow from "@/components/core/Eyebrow";
import ProgressBar from "@/components/core/ProgressBar";
import RankEmblem from "@/components/core/RankEmblem";
import type { ProgressSummary } from "@/lib/data/progression/progressionQueries";

export type ProgressRankHeroProps = {
  summary: ProgressSummary;
  rankName: string;
  rankLore: string;
  copy: {
    eyebrow: string;
    pointsCaption: string;
    monthChip: string;
    barLabel: string;
    barValue: string;
    barNote: string;
    toNextRank: string;
    atTop: string;
    emblemLabel: string;
  };
};

/**
 * The `Resumen` tab's rank hero.
 *
 * The eyebrow says "solo tú lo ves" out loud rather than leaving privacy to be inferred: this is
 * the one screen where a collector might reasonably wonder who else is looking (`FR-12-18`).
 *
 * The bar measures the current rung, not the whole ladder from zero. The thresholds are
 * superlinear, so a bar drawn from zero would show a rank-nine collector as nearly finished and a
 * rank-two one as nearly nowhere, which is the opposite of what either of them is doing.
 */
export default function ProgressRankHero({ summary, rankName, rankLore, copy }: ProgressRankHeroProps) {
  return (
    <Card
      as="section"
      variant="elevated"
      padding="lg"
      className="flex flex-col items-center gap-[var(--space-4)] text-center sm:flex-row sm:items-center sm:text-left"
    >
      <RankEmblem
        rankIndex={summary.currentRankIndex}
        band="current"
        size="lg"
        label={copy.emblemLabel}
        className="sm:[width:min(148px,100%)]"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-2)]">
        <Eyebrow as="p">{copy.eyebrow}</Eyebrow>
        <h2 className="text-text-title m-0 [font-family:var(--font-display)] [font-size:var(--text-title)] [line-height:var(--text-title--line-height)] [letter-spacing:var(--text-title--letter-spacing)]">
          {rankName}
        </h2>
        <p className="text-text-secondary m-0 [font-size:var(--text-body)]">{rankLore}</p>

        <div className="mt-[var(--space-2)] flex flex-col gap-[var(--space-2)]">
          <ProgressBar value={summary.nextRankProgressPercent} label={copy.barLabel} valueText={copy.barValue} />
          <p className="text-text-muted m-0 flex flex-wrap justify-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] [font-size:var(--text-caption)] sm:justify-between">
            <span className="[font-family:var(--font-mono)]">{copy.barNote}</span>
            <span>{summary.nextRank ? copy.toNextRank : copy.atTop}</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-[var(--space-2)] sm:items-end">
        <p className="m-0 flex flex-col items-center sm:items-end">
          <span className="text-text-title [font-family:var(--font-mono)] [font-size:var(--text-display)] [line-height:1] font-bold">
            {/* Grouped with `"en"` like the dashboard's own figure, so the same total reads the
                same way on both surfaces. */}
            {summary.totalPoints.toLocaleString("en")}
          </span>
          <span className="text-text-muted [font-size:var(--text-caption)]">{copy.pointsCaption}</span>
        </p>
        {summary.pointsThisMonth > 0 && <Chip variant="success">{copy.monthChip}</Chip>}
      </div>
    </Card>
  );
}
