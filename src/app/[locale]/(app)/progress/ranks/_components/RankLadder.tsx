import { Check, Lock, Sparkles, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import ProgressBar from "@/components/core/ProgressBar";
import RankEmblem, { type RankBand } from "@/components/core/RankEmblem";
import { cn } from "@/lib/styles";
import type { ProgressSummary } from "@/lib/data/progression/progressionQueries";
import { RANK_COUNT, RANK_LADDER, type RankLadderEntry } from "@/lib/data/progression/rankLadder";

/** How a single rung reads: already earned, standing on it, or still ahead. */
type RungState = "conquered" | "current" | "locked";

/**
 * Opacity steps for the locked band, dimmest toward the summit. An explicit per-rung value rather
 * than a blanket `opacity` on the list: the threshold of a distant rank still has to be readable,
 * so this is a depth cue, not a disabled state.
 */
const LOCKED_DIM_OPACITY = [0.94, 0.86, 0.78, 0.7, 0.62] as const;

/** Locked rungs kept beside the current one on mobile; the band above them collapses. */
const ADJACENT_LOCKED_RUNGS = 2;

const PERCENT = 100;

const BAND_STRIP: Readonly<Record<RankBand, string>> = {
  conquered: "var(--rank-band-conquered)",
  current: "var(--rank-band-current)",
  locked: "var(--rank-band-locked)",
  top: "var(--rank-band-top)",
};

const STATE_TEXT_COLOR: Readonly<Record<RungState, string>> = {
  conquered: "var(--rank-band-conquered-text)",
  current: "var(--accent)",
  locked: "var(--text-muted)",
};

const STATE_ICON = { conquered: Check, current: Sparkles, locked: Lock } as const;

const FACT_CLASSNAME = "[font-family:var(--font-mono)] [font-size:var(--text-mono)]";

const STATE_CLASSNAME = cn(
  "inline-flex items-center gap-[var(--space-1)] uppercase",
  "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)]",
  "[letter-spacing:var(--text-eyebrow--letter-spacing)] [font-weight:var(--font-weight-mono)]",
);

/**
 * Which reading a rung gets. A rank at or below the permanent high-water mark stays conquered even
 * when the live total has fallen back below it: the ladder never withdraws a title it granted
 * (`BR-12-06`), which is exactly what the legend's permanence line promises the collector.
 */
function resolveRungState(rankIndex: number, currentRankIndex: number, highestRankIndex: number): RungState {
  if (rankIndex === currentRankIndex) return "current";
  if (rankIndex <= highestRankIndex) return "conquered";
  return "locked";
}

/** The rung the dimming is measured from: the highest one this collector has ever stood on. */
function resolveReachedIndex(currentRankIndex: number, highestRankIndex: number): number {
  return Math.max(currentRankIndex, highestRankIndex);
}

function resolveLockedOpacity(rankIndex: number, reachedIndex: number): number {
  const step = Math.min(LOCKED_DIM_OPACITY.length, Math.max(1, rankIndex - reachedIndex));
  return LOCKED_DIM_OPACITY[step - 1];
}

export type RankLadderProps = {
  totalPoints: number;
  currentRankIndex: number;
  highestRankIndex: number;
  nextRank: ProgressSummary["nextRank"];
  pointsToNextRank: number;
  nextRankProgressPercent: number;
};

/**
 * The ten rungs of the ladder, summit first.
 *
 * Two constraints shape this list and must survive any refactor:
 *
 *  - **Every threshold stays readable, at every width** (`FR-12-33`). A ladder whose next step is
 *    unknown cannot be planned against, so nothing here ever trades a number away for room. What
 *    mobile collapses is the DISTANCE between the summit and the collector, and it collapses it
 *    into a native `<details>` whose content carries those same thresholds, not into a summary line
 *    that swallows them.
 *  - **The band is never the only carrier of state.** Each rung pairs its colour with a word and an
 *    icon (`ADR 0006`), so the ladder reads the same to somebody who cannot separate the hues.
 *
 * Server-rendered, and deliberately without a client boundary: the only interaction is the
 * disclosure, which the platform already implements, and the breakpoint that decides whether the
 * disclosure or the flat list is shown is a CSS question, not a JavaScript one.
 */
export default function RankLadder({
  totalPoints,
  currentRankIndex,
  highestRankIndex,
  nextRank,
  pointsToNextRank,
  nextRankProgressPercent,
}: RankLadderProps) {
  const t = useTranslations("progress");

  const reachedIndex = resolveReachedIndex(currentRankIndex, highestRankIndex);
  const descending = [...RANK_LADDER].reverse();
  const [summit, ...lowerRungs] = descending;

  // The band mobile folds away: locked ranks far enough above the collector that the intermediate
  // steps are not the ones they are planning against, the summit excluded (it always stays).
  const firstCollapsedIndex = reachedIndex + ADJACENT_LOCKED_RUNGS + 1;
  const isCollapsed = (entry: RankLadderEntry) =>
    entry.rankIndex < RANK_COUNT && entry.rankIndex >= firstCollapsedIndex;
  const collapsedEntries = lowerRungs.filter(isCollapsed);

  const currentProgress = nextRank !== null ? { percent: nextRankProgressPercent, nextRank, pointsToNextRank } : null;

  const renderRung = (entry: RankLadderEntry, options: { isSummit?: boolean; className?: string } = {}) => {
    const state = resolveRungState(entry.rankIndex, currentRankIndex, highestRankIndex);
    return (
      <LadderRung
        key={entry.rankKey}
        entry={entry}
        state={state}
        totalPoints={totalPoints}
        isSummit={options.isSummit}
        className={options.className}
        dimOpacity={
          state === "locked" && !options.isSummit ? resolveLockedOpacity(entry.rankIndex, reachedIndex) : undefined
        }
        progress={state === "current" ? currentProgress : null}
      />
    );
  };

  return (
    <ol aria-label={t("ranksTab.ladderLabel")} className="m-0 flex list-none flex-col gap-[var(--space-2)] p-0">
      {renderRung(summit, { isSummit: true })}

      {collapsedEntries.length > 0 ? (
        <li className="list-none md:hidden">
          <details className="[&_summary::-webkit-details-marker]:hidden">
            <summary
              className={cn(
                "cursor-pointer list-none rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-center uppercase",
                "text-text-muted [border:1px_dashed_var(--border-strong)]",
                "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)]",
                "[letter-spacing:var(--text-eyebrow--letter-spacing)]",
                "focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]",
              )}
            >
              {t("ranksTab.collapsedSummary", { count: collapsedEntries.length })}
            </summary>
            <ol className="m-0 mt-[var(--space-2)] flex list-none flex-col gap-[var(--space-2)] p-0">
              {collapsedEntries.map((entry) => renderRung(entry))}
            </ol>
          </details>
        </li>
      ) : null}

      {lowerRungs.map((entry) => renderRung(entry, { className: isCollapsed(entry) ? "hidden md:flex" : undefined }))}
    </ol>
  );
}

type LadderRungProps = {
  entry: RankLadderEntry;
  state: RungState;
  totalPoints: number;
  isSummit?: boolean;
  /** Depth cue for the locked band. Absent on the summit, which stays at full strength. */
  dimOpacity?: number;
  className?: string;
  /** Only ever set on the rung the collector is standing on, and only below the top of the ladder. */
  progress?: { percent: number; nextRank: NonNullable<ProgressSummary["nextRank"]>; pointsToNextRank: number } | null;
};

/**
 * One rung. The band colour rides a strip at the leading edge rather than the rung's own background,
 * so a dimmed locked rung never dims its own text against the surface behind it.
 */
function LadderRung({ entry, state, totalPoints, isSummit, dimOpacity, className, progress }: LadderRungProps) {
  const t = useTranslations("progress");

  const band: RankBand = isSummit ? "top" : state;
  const name = t(`ranks.${entry.rankKey}.name`);
  const lore = t(`ranks.${entry.rankKey}.lore`);
  const missingPoints = Math.max(0, entry.threshold - totalPoints);
  const StateIcon = STATE_ICON[state];

  const stateLabel = (
    <span className={STATE_CLASSNAME} style={{ color: STATE_TEXT_COLOR[state] }}>
      <StateIcon aria-hidden="true" className="size-3.5 shrink-0" />
      {t(`ranksTab.${state === "current" ? "here" : state}`)}
    </span>
  );

  const meritNote =
    entry.meritLockFraction !== undefined ? (
      <span className="text-text-muted [font-size:var(--text-caption)]">
        {t("ranksTab.meritNote", { percent: Math.round(entry.meritLockFraction * PERCENT) })}
      </span>
    ) : null;

  const facts = (
    <>
      <span className={cn(FACT_CLASSNAME, "text-text-title font-bold")}>
        {t("ranksTab.threshold", { points: entry.threshold })}
      </span>
      {state === "locked" ? (
        <span className={cn(FACT_CLASSNAME, "text-text-muted")}>
          {t("ranksTab.missing", { points: missingPoints })}
        </span>
      ) : null}
      {stateLabel}
    </>
  );

  const rungClassName = cn(
    "relative flex flex-wrap items-center gap-[var(--space-3)] overflow-hidden",
    "rounded-[var(--radius-md)] p-[var(--space-3)] md:p-[var(--space-4)]",
    "[background:var(--surface)] [border:1px_solid_var(--border)]",
    state === "current" && "[border:1.5px_solid_var(--accent)]",
    isSummit && "[border:1px_solid_color-mix(in_oklch,var(--rank-band-top)_45%,var(--border))]",
    className,
  );

  const bandStrip = (
    <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ background: BAND_STRIP[band] }} />
  );

  if (isSummit) {
    return (
      <li className={rungClassName} style={dimOpacity ? { opacity: dimOpacity } : undefined}>
        {bandStrip}
        <div className="flex w-full flex-col items-center gap-[var(--space-2)] text-center">
          <span className={cn(STATE_CLASSNAME, "[color:var(--accent-warm)]")}>
            <Trophy aria-hidden="true" className="size-3.5 shrink-0" />
            {t("ranksTab.summit")}
          </span>

          <RankEmblem rankIndex={entry.rankIndex} band="top" size="md" label={t("rank.emblemLabel", { rank: name })} />

          <span className="text-text-title [font-family:var(--font-display)] [font-size:var(--text-subtitle)] [line-height:var(--text-subtitle--line-height)]">
            {name}
          </span>
          <span className="text-text-secondary max-w-[44ch] [font-size:var(--text-caption)]">{lore}</span>
          {meritNote}

          <div className="flex flex-wrap items-center justify-center gap-x-[var(--space-3)] gap-y-[var(--space-1)]">
            {facts}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={rungClassName} style={dimOpacity ? { opacity: dimOpacity } : undefined}>
      {bandStrip}

      <RankEmblem
        rankIndex={entry.rankIndex}
        band={band}
        size="sm"
        label={t("rank.emblemLabel", { rank: name })}
        className="ml-[var(--space-1)]"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-0_5)]">
        {state === "current" ? (
          <span className={cn(STATE_CLASSNAME, "self-start")} style={{ color: STATE_TEXT_COLOR.current }}>
            <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
            {t("ranksTab.here")}
          </span>
        ) : null}
        <span
          className={cn(
            "[font-size:var(--text-body)] font-bold",
            state === "locked" ? "text-text-secondary" : "text-text-title",
          )}
        >
          {name}
        </span>
        <span className="text-text-secondary [font-size:var(--text-caption)]">{lore}</span>
        {meritNote}
      </div>

      <div className="flex flex-col items-start gap-[var(--space-1)] md:items-end md:text-right">
        {state === "current" ? (
          <span className={cn(FACT_CLASSNAME, "text-text-title font-bold")}>
            {t("ranksTab.threshold", { points: entry.threshold })}
          </span>
        ) : (
          facts
        )}
      </div>

      {progress ? (
        <div className="basis-full">
          <ProgressBar
            value={progress.percent}
            label={t("summary.barLabel", { rank: t(`ranks.${progress.nextRank.rankKey}.name`) })}
            valueText={t("summary.barValue", {
              current: totalPoints,
              threshold: progress.nextRank.threshold,
              rank: t(`ranks.${progress.nextRank.rankKey}.name`),
            })}
          />
          <p className="text-text-muted m-0 mt-[var(--space-2)] flex flex-wrap justify-between gap-[var(--space-2)] [font-size:var(--text-caption)]">
            <span>{t("summary.barNote", { current: totalPoints, threshold: progress.nextRank.threshold })}</span>
            <span>
              {t("summary.toNextRank", {
                points: progress.pointsToNextRank,
                rank: t(`ranks.${progress.nextRank.rankKey}.name`),
              })}
            </span>
          </p>
        </div>
      ) : null}
    </li>
  );
}
