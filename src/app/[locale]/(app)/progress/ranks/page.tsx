import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import Card from "@/components/core/Card";
import Eyebrow from "@/components/core/Eyebrow";
import { getSession } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";
import { getProgressSummary } from "@/lib/data/progression/progressionQueries";
import RankLadder from "./_components/RankLadder";
import RankLadderViewedCapture from "./_components/RankLadderViewedCapture";

type RankLadderPageProps = {
  params: Promise<{ locale: string }>;
};

/** The three bands of the ladder, each with the token that paints its dot and its own copy key. */
const LEGEND_BANDS = [
  { key: "legendConquered", color: "var(--rank-band-conquered)" },
  { key: "legendCurrent", color: "var(--rank-band-current)" },
  { key: "legendLocked", color: "var(--rank-band-locked)" },
] as const;

export async function generateMetadata({ params }: RankLadderPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "progress" });
  return { title: t("meta.ranksTitle"), robots: { index: false, follow: false } };
}

/**
 * The `"Rangos"` tab: the whole ten-rank ladder, summit first.
 *
 * The legend's permanence line is not decoration. It states, in the collector's own words, the rule
 * the data layer enforces (`BR-12-06`): a rank reached is kept, so a total that falls back moves the
 * bar and never the title. Keeping it verbatim is what makes a conquered rung above the current one
 * legible instead of looking like a bug.
 *
 * Server-rendered end to end; the only client island is the analytics capture. The tab bar and the
 * visibility gate belong to the section layout, so this page renders neither.
 */
export default async function RankLadderPage({ params }: RankLadderPageProps) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/${locale}${ROUTES.signIn}`);
  }

  const t = await getTranslations({ locale, namespace: "progress" });
  const summary = await getProgressSummary(session.user.id);

  return (
    <>
      <SetHeaderTitle title={t("meta.ranksTitle")} />
      <RankLadderViewedCapture currentRankIndex={summary.currentRankIndex} />

      <p className="text-text-secondary m-0 [font-size:var(--text-body)]">{t("ranksTab.intro")}</p>

      <Card as="section" variant="subtle" padding="sm" className="flex flex-col gap-[var(--space-2)]">
        <Eyebrow as="h2">{t("ranksTab.legendLabel")}</Eyebrow>
        <ul className="m-0 flex list-none flex-wrap gap-x-[var(--space-4)] gap-y-[var(--space-1)] p-0">
          {LEGEND_BANDS.map((legendBand) => (
            <li
              key={legendBand.key}
              className="text-text-secondary flex items-center gap-[var(--space-2)] [font-size:var(--text-caption)]"
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: legendBand.color }}
              />
              {t(`ranksTab.${legendBand.key}`)}
            </li>
          ))}
        </ul>
        <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("ranksTab.legendPermanence")}</p>
      </Card>

      <RankLadder
        totalPoints={summary.totalPoints}
        currentRankIndex={summary.currentRankIndex}
        highestRankIndex={summary.highestRankIndex}
        nextRank={summary.nextRank}
        pointsToNextRank={summary.pointsToNextRank}
        nextRankProgressPercent={summary.nextRankProgressPercent}
      />
    </>
  );
}
