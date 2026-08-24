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
import { getSession } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";
import { getMedalShowcase } from "@/lib/data/progression/medalQueries";
import { getProgressSummary } from "@/lib/data/progression/progressionQueries";
import { recomputeUserProgress } from "@/lib/data/progression/recompute";
import MedalGrid from "./medals/_components/MedalGrid";
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
 * blocking them.
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

      {summary.stale && (
        <p
          role="status"
          className="text-text-secondary m-0 rounded-[var(--radius-lg)] border border-dashed [border-color:var(--border-strong)] px-[var(--space-3)] py-[var(--space-2)] [font-size:var(--text-caption)]"
        >
          {t("section.staleNotice")}
        </p>
      )}

      {!summary.hasPoints ? (
        <Card as="section" variant="outlined" padding="lg" className="flex flex-col gap-[var(--space-3)]">
          <Eyebrow as="h2">{t("summary.emptyTitle")}</Eyebrow>
          <p className="text-text-secondary m-0 [font-size:var(--text-body)]">{t("summary.emptyBody")}</p>
          <Button as="a" href={`/${locale}${ROUTES.ordersNew}`} variant="primary" size="md" className="self-start">
            {t("summary.emptyCta")}
          </Button>
        </Card>
      ) : (
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
      )}

      <div className="grid gap-[var(--space-4)] lg:grid-cols-2 lg:items-start">
        <Card as="section" variant="outlined" padding="md" className="flex flex-col gap-[var(--space-3)]">
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
        </Card>

        {summary.meritLock && (
          <Card as="section" variant="outlined" padding="md" className="flex flex-col gap-[var(--space-3)]">
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

      <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("summary.honesty")}</p>

      {/* Disabled on purpose: it names a surface that does not exist yet, links nowhere, and
          collects nothing, not even an opt-in (FR-12-39, BR-12-21). */}
      <Card as="section" variant="subtle" padding="md" className="flex flex-col gap-[var(--space-1)] border-dashed">
        <Eyebrow as="h2">{t("summary.soonTitle")}</Eyebrow>
        <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("summary.soonCaption")}</p>
      </Card>

      <section className="flex flex-col gap-[var(--space-3)]">
        <header className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <h2 className="text-text-title m-0 [font-family:var(--font-display)] [font-size:var(--text-subtitle)] [line-height:var(--text-subtitle--line-height)]">
              {t("summary.medalsTitle")}
            </h2>
            <Chip variant="neutral" className="[font-family:var(--font-mono)]">
              {t("summary.medalsCounter", { unlocked: showcase.unlockedCount, total: showcase.shippedCount })}
            </Chip>
          </div>
          <Button
            as="a"
            href={`/${locale}${ROUTES.progressMedals}`}
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
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

      <Card as="section" variant="outlined" padding="md" className="flex flex-col gap-[var(--space-3)]">
        <header className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
          <Eyebrow as="h2">{t("summary.ranksTitle")}</Eyebrow>
          <Button
            as="a"
            href={`/${locale}${ROUTES.progressRanks}`}
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            {t("summary.ranksLink")}
          </Button>
        </header>
        <ProgressMiniLadder locale={locale} currentRankIndex={summary.currentRankIndex} />
      </Card>
    </>
  );
}
