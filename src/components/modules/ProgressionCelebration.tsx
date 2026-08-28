"use client";

import { ArrowUp, Award, PartyPopper, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import MedalStage, { resolveMedalArtSrc } from "@/components/core/MedalStage";
import ProgressBar from "@/components/core/ProgressBar";
import RankEmblem from "@/components/core/RankEmblem";
import RarityChip, { getRarityRingVar, type RarityGrade } from "@/components/core/RarityChip";
import { Modal } from "@/components/modules/Modal";
import { findMedal } from "@/lib/data/progression/medalCatalogue";
import { cn } from "@/lib/styles";
import type { RankCelebrationContent, WelcomeCelebrationContent } from "@/lib/data/progression/progressionQueries";

/**
 * The full-screen celebration, in its three variants.
 *
 * All three are the SAME canonical `Modal` (`ADR 0008`): the rank-up of `FR-12-37`, the medal
 * variant `FR-12-47` reserves for the two highest print-run tiers, and the one-time aggregated
 * welcome the migrated history earns (`FR-12-43`). A hand-rolled overlay with its own `role` and its
 * own focus trap would not be the same guarantee every other dialog in the app already gives, and
 * this is not the component that gets to be the exception.
 *
 * What the prototype paints outside the panel (rays over the scrim) is painted INSIDE it here. The
 * canonical modal owns the backdrop, and reaching around it to decorate the scrim would be forking
 * it by another name; the halo, the confetti and the oversized art carry the same celebratory
 * register from within the panel. There is no mascot on any celebratory surface (`ADR 0013 D5`).
 *
 * Only one instance is ever mounted. The caller queues the second surface behind the first rather
 * than opening two dialogs, because only one may own focus at a time.
 */

/** Confetti pieces. Fixed rather than random so server and client render the same thing. */
const CONFETTI_PIECE_COUNT = 33;
const CONFETTI_MIN_DURATION_MS = 1800;
const CONFETTI_DURATION_SPREAD_MS = 1400;
const CONFETTI_DELAY_STEP_MS = 55;
const CONFETTI_DRIFT_RANGE_PX = 120;
const CONFETTI_SPIN_RANGE_DEG = 540;

/** Rarity tiers that earn the full-screen surface. Every other tier stays on the toast. */
const CELEBRATED_RARITIES: readonly RarityGrade[] = ["holo", "signed"];

/** Whether a newly unlocked medal's rarity escalates past the toast (`FR-12-47`). */
export function isCelebratedRarity(rarity: string): rarity is RarityGrade {
  return CELEBRATED_RARITIES.includes(rarity as RarityGrade);
}

export type ProgressionCelebrationItem =
  | { kind: "rank"; content: RankCelebrationContent }
  | { kind: "medal"; medalKey: string; rarity: RarityGrade; series: string }
  | { kind: "welcome"; content: WelcomeCelebrationContent };

export type ProgressionCelebrationProps = {
  item: ProgressionCelebrationItem | null;
  onClose: () => void;
  /** Opens the album on the medal variant's primary action; absent variants keep a plain dismiss. */
  onOpenAlbum?: (medalKey: string) => void;
  onOpenProgress?: () => void;
};

/**
 * The decorative layer: a pulsing halo behind the art and the confetti falling over the panel.
 *
 * `aria-hidden` in full. Nothing here carries a fact, which is precisely why reduced motion is
 * allowed to remove it outright rather than merely slow it down.
 */
function CelebrationDecor({ tintVar }: { tintVar: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="celebration-halo pointer-events-none absolute top-0 left-1/2 -z-10 size-56 -translate-x-1/2 rounded-full blur-2xl"
        style={{ background: `color-mix(in oklch, ${tintVar} 42%, transparent)` }}
      />
      <span
        aria-hidden="true"
        className="celebration-confetti pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {Array.from({ length: CONFETTI_PIECE_COUNT }, (_, index) => {
          const spread = index / CONFETTI_PIECE_COUNT;
          const style: CSSProperties = {
            left: `${(index * 97) % 100}%`,
            background:
              index % 3 === 0
                ? "var(--accent-warm)"
                : index % 3 === 1
                  ? tintVar
                  : "color-mix(in oklch, var(--accent) 80%, transparent)",
            ["--confetti-duration" as string]: `${CONFETTI_MIN_DURATION_MS + spread * CONFETTI_DURATION_SPREAD_MS}ms`,
            ["--confetti-delay" as string]: `${(index % 8) * CONFETTI_DELAY_STEP_MS}ms`,
            ["--confetti-drift" as string]: `${(spread - 0.5) * CONFETTI_DRIFT_RANGE_PX}px`,
            ["--confetti-spin" as string]: `${(spread - 0.5) * CONFETTI_SPIN_RANGE_DEG}deg`,
          };
          return (
            <span
              key={index}
              className={cn(
                "celebration-confetti-piece absolute top-0 block h-2.5 w-1.5",
                index % 2 === 0 ? "rounded-[1px]" : "rounded-full",
              )}
              style={style}
            />
          );
        })}
      </span>
    </>
  );
}

export default function ProgressionCelebration({
  item,
  onClose,
  onOpenAlbum,
  onOpenProgress,
}: ProgressionCelebrationProps) {
  const t = useTranslations("progress");

  if (!item) return null;

  if (item.kind === "medal") {
    const ring = getRarityRingVar(item.rarity);
    const medalName = t(`medals.${item.medalKey}.name` as never);
    const rarityLabel = t(`rarity.${item.rarity}` as never);

    return (
      <Modal
        isOpen
        onClose={onClose}
        title={medalName}
        subtitle={t(`medals.${item.medalKey}.lore` as never)}
        icon={<Award size={22} aria-hidden="true" />}
        tone="success"
        bodyClassName="relative isolate overflow-hidden"
        primaryAction={
          onOpenAlbum
            ? { label: t("celebration.medal.cta"), onClick: () => onOpenAlbum(item.medalKey), variant: "success" }
            : undefined
        }
        secondaryAction={{ label: t("celebration.dismiss"), onClick: onClose }}
        closeButtonLabel={t("celebration.dismiss")}
      >
        <CelebrationDecor tintVar={ring} />
        <div className="flex flex-col items-center gap-3 text-center">
          <p
            className="[font-family:var(--font-mono)] [font-size:var(--text-mono)] font-bold [letter-spacing:var(--text-mono--letter-spacing)] uppercase"
            style={{ color: ring }}
          >
            {t("celebration.medal.kicker", { rarity: rarityLabel })}
          </p>
          <MedalStage
            className="celebration-rise"
            medalKey={item.medalKey}
            grade={item.rarity}
            size="xl"
            imageSrc={resolveMedalArtSrc(findMedal(item.medalKey)?.imageKey)}
            label={t("detail.artLabel", { name: medalName, rarity: rarityLabel })}
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <RarityChip grade={item.rarity} label={rarityLabel} />
            <span className="text-[13px] [color:var(--text-secondary)]">
              {t(`series.${item.series}.name` as never)}
            </span>
          </div>
        </div>
      </Modal>
    );
  }

  if (item.kind === "welcome") {
    const { content } = item;
    const rankName = t(`ranks.${content.rankKey}.name` as never);

    return (
      <Modal
        isOpen
        onClose={onClose}
        title={t("celebration.welcome.title")}
        subtitle={t("celebration.welcome.subtitle")}
        icon={<PartyPopper size={22} aria-hidden="true" />}
        tone="success"
        bodyClassName="relative isolate overflow-hidden"
        primaryAction={
          onOpenProgress
            ? { label: t("celebration.welcome.cta"), onClick: onOpenProgress, variant: "success" }
            : undefined
        }
        secondaryAction={{ label: t("celebration.dismiss"), onClick: onClose }}
        closeButtonLabel={t("celebration.dismiss")}
      >
        <CelebrationDecor tintVar="var(--accent-warm)" />
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="block w-[120px]">
            <RankEmblem
              className="celebration-rise"
              rankIndex={content.rankIndex}
              band="current"
              size="lg"
              label={t("rank.emblemLabel", { rank: rankName })}
            />
          </span>
          <p className="text-[15px] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">{rankName}</p>
          <p className="text-[13px] [color:var(--text-secondary)]">
            {t("celebration.welcome.medals", { count: content.medalCount })}
          </p>
        </div>
      </Modal>
    );
  }

  const { content } = item;
  const rankName = t(`ranks.${content.rankKey}.name` as never);
  const nextRankName = content.nextRank ? t(`ranks.${content.nextRank.rankKey}.name` as never) : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={rankName}
      subtitle={t(`ranks.${content.rankKey}.lore` as never)}
      icon={<Sparkles size={22} aria-hidden="true" />}
      tone="success"
      bodyClassName="relative isolate overflow-hidden"
      primaryAction={{ label: t("celebration.rank.cta"), onClick: onClose, variant: "success" }}
      closeButtonLabel={t("celebration.dismiss")}
    >
      <CelebrationDecor tintVar="var(--accent-warm)" />
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="[font-family:var(--font-mono)] [font-size:var(--text-mono)] font-bold [letter-spacing:var(--text-mono--letter-spacing)] [color:var(--accent)] uppercase">
          {t("celebration.rank.kicker")}
        </p>
        {/*
          Both emblems are sized by this row, not by themselves. The emblem carries a
          `max-width: 100%` ceiling for the narrow rung it also has to fit, and a flex row gives its
          children no width for that percentage to resolve against.
        */}
        <div className="flex items-center justify-center gap-3">
          <span className="block w-14 shrink-0">
            <RankEmblem
              rankIndex={content.previousRankIndex}
              band="conquered"
              size="sm"
              label={t("rank.position", { index: content.previousRankIndex })}
              className="opacity-45"
            />
          </span>
          <ArrowUp size={20} aria-hidden="true" className="shrink-0 [color:var(--accent)]" />
          <span className="block w-[120px] shrink-0">
            <RankEmblem
              className="celebration-rise"
              rankIndex={content.rankIndex}
              band="current"
              size="lg"
              label={t("rank.emblemLabel", { rank: rankName })}
            />
          </span>
        </div>
        <p className="text-[13px] [color:var(--text-secondary)]">
          {t("celebration.rank.permanence", { index: content.rankIndex })}
        </p>
        {nextRankName && content.nextRank ? (
          <div className="w-full">
            <ProgressBar
              value={content.nextRankProgressPercent}
              label={t("summary.barLabel", { rank: nextRankName })}
              valueText={t("summary.barValue", {
                current: content.totalPoints,
                threshold: content.nextRank.threshold,
                rank: nextRankName,
              })}
            />
            <p className="mt-1.5 text-[12px] [color:var(--text-muted)]">
              {t("summary.barNote", { current: content.totalPoints, threshold: content.nextRank.threshold })}
            </p>
          </div>
        ) : (
          <p className="text-[13px] [color:var(--text-secondary)]">{t("summary.atTop")}</p>
        )}
      </div>
    </Modal>
  );
}
