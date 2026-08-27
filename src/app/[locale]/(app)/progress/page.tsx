import type { Metadata } from "next";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import Button from "@/components/core/Button/Button";
import Card from "@/components/core/Card";
import Chip from "@/components/core/Chip";
import Eyebrow from "@/components/core/Eyebrow";
import ProgressBar from "@/components/core/ProgressBar";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import { getSession } from "@/lib/auth/auth-server";
import { cn } from "@/lib/styles";
import { ROUTES } from "@/lib/constants";
import { getMedalShowcase } from "@/lib/data/progression/medalQueries";
import { getProgressSummary } from "@/lib/data/progression/progressionQueries";
import { recomputeUserProgress } from "@/lib/data/progression/recompute";
import MedalGrid from "./medals/_components/MedalGrid";
import HowItWorksLink from "./_components/HowItWorksLink";
import ProgressMiniLadder from "./_components/ProgressMiniLadder";
import ProgressRankHero from "./_components/ProgressRankHero";

type ProgressPageProps = {
  params: Promise<{ locale: string }>;
};

/** Medals the `Resumen` showcase previews. The album itself is one click away. */
const SHOWCASE_MEDAL_COUNT = 4;

/** Whole percentage the merit-lock copy prints, so the collector reads "60 %" and not "0.6". */
const PERCENT = 100;

export async function generateMetadata({ params }: ProgressPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "progress" });
  return { title: t("meta.title"), robots: { index: false, follow: false } };
}

/**
 * The `Resumen` tab: the whole progression layer read at a glance.
 *
 * Rendered from the cache, never from a recompute the collector has to wait for. When the cache is
 * older than its staleness window the page still paints the stored figures immediately and
 * schedules the recompute with `after()`, so the refresh happens once the response is already on
 * its way instead of adding its own latency to a page whose whole job is to be glanced at
 * (`FR-12-11`). The "may be a few minutes old" notice renders over those cached values rather than
 * blocking them, and only when there are values to qualify: a collector with no points has an empty
 * cache, which is always "stale", so the notice would otherwise greet every new account with a
 * warning about figures the same screen says do not exist yet. The recompute is still scheduled.
 */
export default async function ProgressSummaryPage({ params }: ProgressPageProps) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/${locale}${ROUTES.signIn}`);
  }

  const userId = session.user.id;
  const t = await getTranslations({ locale, namespace: "progress" });
  const [summary, showcase] = await Promise.all([
    getProgressSummary(userId),
    getMedalShowcase(userId, SHOWCASE_MEDAL_COUNT),
  ]);

  if (summary.stale) {
    after(() => recomputeUserProgress(userId));
  }

  const rankName = t(`ranks.${summary.currentRankKey}.name`);
  const nextRankName = summary.nextRank ? t(`ranks.${summary.nextRank.rankKey}.name`) : null;
  const nextThreshold = summary.nextRank?.threshold ?? summary.totalPoints;

  return (
    <>
      <SetHeaderTitle title={t("section.title")} />
      {/* The section name lives in the topbar and the tab name in the bar above, so a visible one
          would say twice what the chrome already says. The document still needs its top heading. */}
      <h1 className="sr-only">{t("section.headingSummary")}</h1>

      {summary.stale && summary.hasPoints && (
        <p
          role="status"
          className="text-text-secondary m-0 rounded-[var(--radius-lg)] border border-dashed [border-color:var(--border-strong)] px-[var(--space-3)] py-[var(--space-2)] [font-size:var(--text-caption)]"
        >
          {t("section.staleNotice")}
        </p>
      )}

      {!summary.hasPoints && !summary.hasHistoricalProgress ? (
        <Card as="section" variant="elevated" padding="lg" className="flex flex-col gap-[var(--space-3)]">
          <Eyebrow as="h2">{t("summary.emptyTitle")}</Eyebrow>
          <p className="text-text-secondary m-0 [font-size:var(--text-body)]">{t("summary.emptyBody")}</p>
          <Button as="a" href={`/${locale}${ROUTES.ordersNew}`} variant="primary" size="md" className="self-start">
            {t("summary.emptyCta")}
          </Button>
        </Card>
      ) : (
        <>
          {/* A collector whose live total was voided down to zero (`BR-12-06`) still has a rank or a
              medal from before, so the summary below renders normally instead of the "first ever
              action" empty state above. No separate zero-points line is needed: the hero card right
              below already prints the current total, so a bare "0" there reads as the true figure,
              not as a display bug, once the rank ladder and album beneath it show that history. */}
          <ProgressRankHero
            summary={summary}
            rankName={rankName}
            rankLore={t(`ranks.${summary.currentRankKey}.lore`)}
            copy={{
              eyebrow: t("summary.eyebrow", { index: summary.currentRankIndex }),
              pointsCaption: t("summary.pointsCaption"),
              monthChip: t("summary.monthChip", { points: summary.pointsThisMonth }),
              barLabel: t("summary.barLabel", { rank: nextRankName ?? rankName }),
              barValue: t("summary.barValue", {
                current: summary.totalPoints,
                threshold: nextThreshold,
                rank: nextRankName ?? rankName,
              }),
              barNote: t("summary.barNote", { current: summary.totalPoints, threshold: nextThreshold }),
              toNextRank: t("summary.toNextRank", {
                points: summary.pointsToNextRank,
                rank: nextRankName ?? rankName,
              }),
              atTop: t("summary.atTop"),
              emblemLabel: t("rank.emblemLabel", { rank: rankName }),
            }}
          />
        </>
      )}

      {/* Two columns only when there IS a second card. The merit lock is gated on rank 6, so below
          it the single-child grid was reserving half the row for nothing. */}
      <div className={cn("grid gap-[var(--space-6)]", summary.meritLock && "lg:grid-cols-2 lg:items-start")}>
        <Card as="section" variant="elevated" padding="lg" className="flex flex-col gap-[var(--space-3)]">
          <header className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
            <Eyebrow as="h2">{t("summary.monthTitle")}</Eyebrow>
            {summary.pointsThisMonth > 0 && (
              <Chip variant="success">{t("summary.monthChip", { points: summary.pointsThisMonth })}</Chip>
            )}
          </header>

          {summary.monthlyGroups.length === 0 ? (
            <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("summary.monthEmpty")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-[var(--space-2)] p-0">
              {summary.monthlyGroups.map((line) => (
                <li
                  key={line.group}
                  className="border-border flex items-baseline justify-between gap-[var(--space-3)] border-b pb-[var(--space-2)] last:border-b-0 last:pb-0"
                >
                  <span className="text-text-body [font-size:var(--text-body)]">{t(`groups.${line.group}`)}</span>
                  <span className="text-text-title [font-family:var(--font-mono)] [font-size:var(--text-mono)] font-medium">
                    {t("summary.monthChip", { points: line.points })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* The honesty line belongs to the figures it qualifies (`FR-12-41`). Standing on its own
              between two cards it read as a stray caption belonging to neither.

              The way into the rules explainer rides with it: the line is the one-sentence version of
              the same rules, so the reader who pauses on it is the one who wants the rest. */}
          <div className="border-border flex flex-wrap items-baseline justify-between gap-x-[var(--space-4)] gap-y-[var(--space-1)] border-t pt-[var(--space-3)]">
            <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("summary.honesty")}</p>
            <HowItWorksLink locale={locale} label={t("summary.howItWorksLink")} />
          </div>
        </Card>

        {summary.meritLock && (
          <Card as="section" variant="elevated" padding="lg" className="flex flex-col gap-[var(--space-3)]">
            <Eyebrow as="h2">{t("summary.meritTitle")}</Eyebrow>
            <p className="text-text-body m-0 [font-size:var(--text-body)]">
              {summary.meritLock.satisfied
                ? t("summary.meritDone", { rank: t(`ranks.${summary.meritLock.rankKey}.name`) })
                : t("summary.meritCopy", {
                    rank: t(`ranks.${summary.meritLock.rankKey}.name`),
                    percent: Math.round(summary.meritLock.requiredFraction * PERCENT),
                    unlocked: summary.meritLock.unlockedMedalCount,
                    total: summary.meritLock.denominator,
                  })}
            </p>
            <ProgressBar
              size="xs"
              value={
                summary.meritLock.requiredMedalCount > 0
                  ? (summary.meritLock.unlockedMedalCount / summary.meritLock.requiredMedalCount) * PERCENT
                  : 0
              }
              label={t("summary.meritBarLabel", { rank: t(`ranks.${summary.meritLock.rankKey}.name`) })}
              valueText={t("summary.meritBarValue", {
                unlocked: summary.meritLock.unlockedMedalCount,
                required: summary.meritLock.requiredMedalCount,
                rank: t(`ranks.${summary.meritLock.rankKey}.name`),
              })}
            />
          </Card>
        )}
      </div>

      <section className="flex flex-col gap-[var(--space-4)]">
        <header className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
          <SectionTitleWithAccent as="h2" className="gap-[var(--space-2)]">
            <span className="flex flex-wrap items-center gap-[var(--space-2)]">
              {t("summary.medalsTitle")}
              <Chip variant="neutral" className="[font-family:var(--font-mono)]">
                {t("summary.medalsCounter", { unlocked: showcase.unlockedCount, total: showcase.shippedCount })}
              </Chip>
            </span>
          </SectionTitleWithAccent>
          <Button
            as="a"
            href={`/${locale}${ROUTES.progressMedals}`}
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
            className="max-sm:w-full max-sm:justify-center"
          >
            {t("summary.medalsLink")}
          </Button>
        </header>

        {showcase.entries.length === 0 ? (
          <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("summary.medalsEmpty")}</p>
        ) : (
          <MedalGrid entries={showcase.entries} size="md" />
        )}
      </section>

      <Card as="section" variant="elevated" padding="lg" className="flex flex-col gap-[var(--space-4)]">
        <header className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
          <Eyebrow as="h2">{t("summary.ranksTitle")}</Eyebrow>
          <Button
            as="a"
            href={`/${locale}${ROUTES.progressRanks}`}
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
            className="max-sm:w-full max-sm:justify-center"
          >
            {t("summary.ranksLink")}
          </Button>
        </header>
        <ProgressMiniLadder locale={locale} currentRankIndex={summary.currentRankIndex} />
      </Card>

      {/* Disabled on purpose: it names a surface that does not exist yet, links nowhere, and
          collects nothing, not even an opt-in (FR-12-39, BR-12-21). Last on the page for the same
          reason: what is switched off must not sit between two things that work.

          The dashed border is declared whole rather than as `border-dashed`, because the `subtle`
          variant already sets a transparent 1px border and the shorthand-less class loses to it. */}
      <Card
        as="section"
        variant="subtle"
        padding="md"
        className="flex flex-col gap-[var(--space-1)] [border:1px_dashed_var(--border-strong)]"
      >
        <Eyebrow as="h2">{t("summary.soonTitle")}</Eyebrow>
        <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("summary.soonCaption")}</p>
      </Card>
    </>
  );
}
