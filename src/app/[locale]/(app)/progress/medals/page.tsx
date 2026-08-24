import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import Card from "@/components/core/Card";
import Eyebrow from "@/components/core/Eyebrow";
import ProgressBar from "@/components/core/ProgressBar";
import RarityChip from "@/components/core/RarityChip";
import { getSession } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";
import { MEDAL_RARITY_ORDER } from "@/lib/data/progression/medalCatalogue";
import { getMedalAlbum } from "@/lib/data/progression/medalQueries";
import MedalAlbumViewedCapture from "./_components/MedalAlbumViewedCapture";
import MedalGrid from "./_components/MedalGrid";

type MedalAlbumPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: MedalAlbumPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "progress" });
  return { title: t("meta.medalsTitle"), robots: { index: false, follow: false } };
}

/** Share of the shipped catalogue this collector holds, guarding the empty-catalogue divisor. */
function toPercentage(unlocked: number, shipped: number): number {
  return shipped > 0 ? (unlocked / shipped) * 100 : 0;
}

/**
 * The `"Medallas"` album: one page per series, every medal in the catalogue, and two levels of
 * counter.
 *
 * The counters divide by what this build can actually AWARD, not by the twenty-four the catalogue
 * describes. The twelve pieces of a later phase still render, as silhouettes labelled as such, so
 * half the album reads as a promise rather than as missing content, but counting them would tell a
 * collector they are behind on medals nobody can earn yet.
 *
 * Server-rendered end to end; the only client island is the analytics capture.
 */
export default async function MedalAlbumPage({ params }: MedalAlbumPageProps) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/${locale}${ROUTES.signIn}`);
  }

  const t = await getTranslations({ locale, namespace: "progress" });
  const album = await getMedalAlbum(session.user.id);
  const remaining = Math.max(0, album.shippedCount - album.unlockedCount);

  return (
    <>
      <SetHeaderTitle title={t("album.title")} />
      <MedalAlbumViewedCapture unlockedCount={album.unlockedCount} shippedCount={album.shippedCount} />

      <Card as="section" variant="outlined" padding="md" className="flex flex-wrap items-center gap-[var(--space-5)]">
        <p className="m-0 flex flex-col items-center text-center">
          <span className="text-text-title [font-family:var(--font-mono)] [font-size:var(--text-title)] [line-height:var(--text-title--line-height)] font-bold">
            {album.unlockedCount}
          </span>
          <span className="text-text-muted [font-size:var(--text-caption)]">
            {t("album.countCaption", { total: album.shippedCount })}
          </span>
        </p>

        <div className="min-w-[min(100%,14rem)] flex-1">
          <ProgressBar
            value={toPercentage(album.unlockedCount, album.shippedCount)}
            label={t("album.title")}
            valueText={t("album.progressLabel", { unlocked: album.unlockedCount, total: album.shippedCount })}
          />
          <p className="text-text-muted m-0 mt-[var(--space-2)] flex flex-wrap justify-between gap-[var(--space-2)] [font-size:var(--text-caption)]">
            <span>{t("album.pagesNote", { count: album.pages.length })}</span>
            <span>{t("album.remainingNote", { count: remaining })}</span>
          </p>
        </div>
      </Card>

      <Card as="section" variant="subtle" padding="sm" className="flex flex-wrap items-center gap-[var(--space-2)]">
        <Eyebrow as="h2" className="mr-[var(--space-1)]">
          {t("album.legendTitle")}
        </Eyebrow>
        {MEDAL_RARITY_ORDER.map((rarity) => (
          <RarityChip key={rarity} grade={rarity} label={t(`rarity.${rarity}`)} />
        ))}
        <span className="text-text-muted basis-full [font-size:var(--text-caption)] sm:min-w-[12rem] sm:flex-1 sm:basis-auto">
          {t("album.legendCaption")}
        </span>
      </Card>

      {album.pages.map((page) => (
        <section key={page.series} className="flex flex-col gap-[var(--space-3)]">
          <header className="flex flex-wrap items-end justify-between gap-[var(--space-3)]">
            <div className="min-w-0">
              <h2 className="text-text-title m-0 [font-family:var(--font-display)] [font-size:var(--text-subtitle)] [line-height:var(--text-subtitle--line-height)] [letter-spacing:var(--text-subtitle--letter-spacing)]">
                {t(`series.${page.series}.name`)}
              </h2>
              <p className="text-text-secondary m-0 [font-size:var(--text-caption)]">
                {t(`series.${page.series}.caption`)}
              </p>
            </div>

            {page.shippedCount > 0 ? (
              <div className="w-40 shrink-0">
                <ProgressBar
                  value={toPercentage(page.unlockedCount, page.shippedCount)}
                  label={t(`series.${page.series}.name`)}
                  valueText={t("album.seriesProgressLabel", {
                    unlocked: page.unlockedCount,
                    total: page.shippedCount,
                  })}
                />
                <p className="text-text-muted m-0 mt-[var(--space-1)] [font-family:var(--font-mono)] [font-size:var(--text-mono)]">
                  {t("album.seriesCounter", { unlocked: page.unlockedCount, total: page.shippedCount })}
                </p>
              </div>
            ) : (
              <p className="text-text-muted m-0 shrink-0 [font-family:var(--font-mono)] [font-size:var(--text-mono)] uppercase">
                {t("album.seriesUpcoming")}
              </p>
            )}
          </header>

          <MedalGrid entries={page.medals} />
        </section>
      ))}
    </>
  );
}
