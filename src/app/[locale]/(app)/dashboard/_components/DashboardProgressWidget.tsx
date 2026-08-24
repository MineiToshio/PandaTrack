import Link from "next/link";
import { Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import Chip from "@/components/core/Chip";
import Eyebrow from "@/components/core/Eyebrow";
import MedalStage, { resolveMedalArtSrc } from "@/components/core/MedalStage";
import ProgressBar from "@/components/core/ProgressBar";
import RankEmblem from "@/components/core/RankEmblem";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { MedalShowcase } from "@/lib/data/progression/medalQueries";
import type { ProgressSummary } from "@/lib/data/progression/progressionQueries";
import DashboardZoneCard from "./DashboardZoneCard";
import DashboardZoneLink from "./DashboardZoneLink";

export type DashboardProgressWidgetProps = {
  locale: string;
  summary: ProgressSummary;
  medals: MedalShowcase;
};

const PROGRESS_TITLE_ID = "dashboard-progress-title";

/** Ticks the row draws at all widths, and how many of them survive the phone (`FR-12-35`). */
const TICK_COUNT = 5;
const MOBILE_TICK_COUNT = 4;

/**
 * The dashboard's `"Tu rango"` glance: the calm instance of the progression layer.
 *
 * Read-only by contract (`FR-12-35`, and the dashboard's own `FR-06-15`): the card mutates nothing
 * and its single job is to hand the collector over to `/{locale}/progress`. Nothing here animates
 * either, which is why the bar is drawn with `transition={false}` and the emblem is rendered in the
 * `current` band with no sheen: the widget sits beside the money zones, and a surface that pulses
 * next to `Caja` would claim a priority the points do not have.
 *
 * The whole card is the click target, implemented as one absolutely-positioned link rather than a
 * wrapper: the foot carries a second link into the album, and an anchor inside an anchor is invalid
 * HTML. The overlay is first in the DOM so it also comes first in the tab order; the tick row is
 * `pointer-events-none` so clicking a medal falls through to it, and the album link is lifted above
 * it instead of nested inside it.
 */
export default function DashboardProgressWidget({ locale, summary, medals }: DashboardProgressWidgetProps) {
  const t = useTranslations("progress");

  const rankName = t(`ranks.${summary.currentRankKey}.name`);
  const nextRankName = summary.nextRank ? t(`ranks.${summary.nextRank.rankKey}.name`) : null;
  const emblemLabel = t("rank.emblemLabel", { rank: rankName });
  const ticks = medals.entries.slice(0, TICK_COUNT);

  return (
    <DashboardZoneCard
      titleId={PROGRESS_TITLE_ID}
      eyebrow={t("widget.eyebrow")}
      eyebrowIcon={Trophy}
      title={rankName}
      tone="accent"
      className="relative"
      trailing={
        <Chip variant="neutral" size="sm" className="[font-family:var(--font-mono)]">
          {t("rank.position", { index: summary.currentRankIndex })}
        </Chip>
      }
    >
      <Link
        href={`/${locale}${ROUTES.progress}`}
        aria-label={t("widget.open")}
        data-ph-event={POSTHOG_EVENTS.PROGRESSION.PROGRESS_WIDGET_CLICKED}
        data-ph-props={JSON.stringify({ current_rank_index: summary.currentRankIndex })}
        className="absolute inset-0 rounded-[var(--radius-xl)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
      />

      <div className="flex flex-1 flex-col gap-[14px]">
        <div className="flex items-center gap-3.5">
          {/*
            Two plates, one exposed. The phone reads the 56px emblem and the wider viewport the 84px
            one; the small copy is hidden from assistive tech rather than announced twice, and
            nothing is lost by it, since the heading and the "Rango N de 10" chip already carry the
            rank in words at every width.
          */}
          <span aria-hidden="true" className="sm:hidden">
            <RankEmblem rankIndex={summary.currentRankIndex} band="current" size="sm" label={emblemLabel} />
          </span>
          <span className="hidden sm:block">
            <RankEmblem rankIndex={summary.currentRankIndex} band="current" size="md" label={emblemLabel} />
          </span>

          {summary.hasPoints ? (
            <div className="flex min-w-0 flex-1 flex-col items-end gap-1.5">
              <p className="flex flex-wrap items-baseline justify-end gap-x-1.5">
                <span className="[font-family:var(--font-mono)] [font-size:clamp(26px,4vw,34px)] [line-height:1] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.02em] [color:var(--text-primary)] tabular-nums">
                  {/* `"en"` explicitly, never the UI locale: number layout in this app is
                      locale-independent (comma thousands, period decimal), so a Spanish reader
                      would otherwise see `9.360` here and `9,360.00` on every amount beside it. */}
                  {summary.totalPoints.toLocaleString("en")}
                </span>
                <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                  {t("widget.pointsCaption")}
                </span>
              </p>
              {summary.pointsThisMonth > 0 && (
                <Chip variant="success" size="sm">
                  {t("widget.monthChip", { points: summary.pointsThisMonth })}
                </Chip>
              )}
            </div>
          ) : (
            /* No fake zero: an untouched ledger says so in words rather than posing as a score. */
            <p className="min-w-0 flex-1 [font-size:var(--text-body)] [line-height:1.55] [color:var(--text-secondary)]">
              {t("widget.empty")}
            </p>
          )}
        </div>

        {summary.hasPoints && (
          <div>
            <ProgressBar
              value={summary.nextRankProgressPercent}
              label={t("summary.barLabel", { rank: nextRankName ?? rankName })}
              valueText={
                summary.nextRank && nextRankName
                  ? t("summary.barValue", {
                      current: summary.totalPoints,
                      threshold: summary.nextRank.threshold,
                      rank: nextRankName,
                    })
                  : t("summary.atTop")
              }
              transition={false}
            />
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 [font-size:12.5px]">
              {summary.nextRank && nextRankName ? (
                <>
                  <span className="[font-family:var(--font-mono)] [color:var(--text-muted)] tabular-nums">
                    {t("summary.barNote", { current: summary.totalPoints, threshold: summary.nextRank.threshold })}
                  </span>
                  <span className="[color:var(--text-secondary)]">
                    {t("summary.toNextRank", { points: summary.pointsToNextRank, rank: nextRankName })}
                  </span>
                </>
              ) : (
                <span className="[color:var(--text-secondary)]">{t("summary.atTop")}</span>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col items-start gap-2.5 pt-3.5 [border-top:1px_solid_var(--border)]">
          <Eyebrow tone="muted" size="sm">
            {t("widget.recentTitle")}
          </Eyebrow>

          {ticks.length > 0 ? (
            <ul className="pointer-events-none flex list-none flex-wrap items-center gap-2 p-0">
              {ticks.map((entry, index) => {
                // Every tick is a medal the collector already holds, and a held secret piece is a
                // revealed one everywhere else in the album (`FR-12-25`). The dashboard follows the
                // same rule rather than inventing a second, stricter one for the same medal.
                const label = t("widget.medalLabel", {
                  name: t(`medals.${entry.medalKey}.name`),
                  rarity: t(`rarity.${entry.rarity}`),
                });

                return (
                  <li
                    key={entry.medalKey}
                    className={cn("flex w-8 sm:w-[38px]", index >= MOBILE_TICK_COUNT && "hidden sm:flex")}
                  >
                    <MedalStage
                      medalKey={entry.medalKey}
                      grade={entry.rarity}
                      size="sm"
                      imageSrc={resolveMedalArtSrc(entry.imageKey)}
                      label={label}
                      className="w-full"
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            /* Said once. With no points the body above is already the same sentence. */
            summary.hasPoints && (
              <p className="[font-size:var(--text-caption)] [line-height:1.5] [color:var(--text-muted)]">
                {t("widget.empty")}
              </p>
            )
          )}

          <DashboardZoneLink
            href={`/${locale}${ROUTES.progressMedals}`}
            label={t("widget.albumLink", { unlocked: medals.unlockedCount, total: medals.shippedCount })}
            className="relative z-10"
          />
        </div>
      </div>
    </DashboardZoneCard>
  );
}
