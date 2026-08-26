import { Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import BackNavLink from "@/components/core/BackNavLink";
import Card from "@/components/core/Card";
import Eyebrow from "@/components/core/Eyebrow";
import MedalStage, { resolveMedalArtSrc } from "@/components/core/MedalStage";
import RarityChip, { getRarityRingVar } from "@/components/core/RarityChip";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import { getSession } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";
import { MEDAL_SERIES } from "@/lib/data/progression/medalCatalogue";
import { getMedalDetail, type MedalAlbumEntry } from "@/lib/data/progression/medalQueries";
import MedalDetailViewedCapture from "../_components/MedalDetailViewedCapture";
import MedalGrid, { isMedalRevealed } from "../_components/MedalGrid";

type MedalDetailPageProps = {
  params: Promise<{ locale: string; medalKey: string }>;
};

/** `unlockedAt` is a real instant, not a civil day, so it renders in the viewer's own time. */
const LONG_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };

export async function generateMetadata({ params }: MedalDetailPageProps): Promise<Metadata> {
  const { locale, medalKey } = await params;
  const t = await getTranslations({ locale, namespace: "progress" });
  const session = await getSession();
  const detail = session?.user?.id ? await getMedalDetail(medalKey, session.user.id) : null;

  // A secret medal must not leak its name through the browser tab either.
  const title =
    detail && isMedalRevealed(detail.medal)
      ? t("meta.medalTitle", { name: t(`medals.${detail.medal.medalKey}.name`) })
      : t("meta.medalsTitle");

  return { title, robots: { index: false, follow: false } };
}

type FactRowProps = { label: string; children: React.ReactNode };

/** One label/value row of the fact list. The label column is fixed so the values line up. */
function FactRow({ label, children }: FactRowProps) {
  return (
    <div className="border-border flex flex-wrap gap-[var(--space-3)] border-b py-[var(--space-3)] last:border-b-0">
      <span className="text-text-muted w-[148px] shrink-0 [font-size:var(--text-caption)]">{label}</span>
      <span className="text-text-primary min-w-0 flex-1 [font-size:var(--text-body)]">{children}</span>
    </div>
  );
}

/**
 * One medal's detail: a subview of the album, never a fourth tab (`FR-12-34`).
 *
 * Always resolved together with the collector's own unlock state, so the page can never answer
 * "is this unlocked" for somebody else, and an unknown key is a 404 rather than an empty shell.
 *
 * Back navigation is the app's ordinary `BackNavLink` to the album, which is a normal client-side
 * navigation and therefore restores the album's scroll position through the router's own history
 * handling rather than through a bespoke mechanism.
 */
export default async function MedalDetailPage({ params }: MedalDetailPageProps) {
  const { locale, medalKey } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/${locale}${ROUTES.signIn}`);
  }

  const detail = await getMedalDetail(medalKey, session.user.id);
  if (!detail) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "progress" });
  const medal: MedalAlbumEntry = detail.medal;
  const revealed = isMedalRevealed(medal);
  const name = t(`medals.${medal.medalKey}.name`);
  const rarityLabel = t(`rarity.${medal.rarity}`);
  const seriesName = t(`series.${medal.series}.name`);
  const isSecretSeries = medal.series === MEDAL_SERIES.SECRETS;

  return (
    <>
      <SetHeaderTitle title={t("album.title")} />
      <MedalDetailViewedCapture medalKey={medal.medalKey} rarity={medal.rarity} unlocked={medal.unlocked} />

      <div>
        <BackNavLink href={`/${locale}${ROUTES.progressMedals}`}>{t("detail.back")}</BackNavLink>
      </div>

      <div className="grid items-start gap-[var(--space-6)] lg:grid-cols-[320px_1fr]">
        {/* Fills its own column rather than floating centred inside it: at 320px a 208px stage left
            a third of the column as dead margin on either side of the piece. */}
        <Card
          variant="elevated"
          padding="lg"
          className="relative flex w-full flex-col items-center gap-[var(--space-5)] overflow-hidden"
        >
          {/* The prototype's soft radial behind the piece, in its own rarity hue. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(70% 50% at 50% 34%, color-mix(in oklch, ${getRarityRingVar(medal.rarity)} 14%, transparent), transparent 70%)`,
            }}
          />
          <MedalStage
            className="relative"
            medalKey={medal.medalKey}
            grade={medal.rarity}
            size="2xl"
            locked={!medal.unlocked}
            imageSrc={resolveMedalArtSrc(medal.imageKey)}
            label={
              revealed
                ? t("detail.artLabel", { name, rarity: rarityLabel })
                : t("detail.lockedArtLabel", { rarity: rarityLabel })
            }
          />
          <span className="relative">
            <RarityChip grade={medal.rarity} label={rarityLabel} />
          </span>
        </Card>

        <div className="min-w-0">
          <Eyebrow as="p">{isSecretSeries ? t("detail.secretEyebrow") : seriesName}</Eyebrow>
          <h1 className="text-text-title mt-[var(--space-2)] mb-[var(--space-2)] [font-family:var(--font-display)] [font-size:var(--text-title)] [line-height:var(--text-title--line-height)] [font-weight:var(--font-weight-title)] [letter-spacing:var(--text-title--letter-spacing)]">
            {revealed ? name : t("album.lockedTitle")}
          </h1>
          <p className="text-text-secondary m-0 mb-[var(--space-5)] max-w-[56ch] [font-size:var(--text-body)]">
            {revealed ? t(`medals.${medal.medalKey}.lore`) : t("album.noHint")}
          </p>

          <section aria-label={t("album.title")}>
            <FactRow label={medal.unlocked ? t("detail.howUnlocked") : t("detail.howToUnlock")}>
              {revealed
                ? medal.shipped
                  ? t(`medals.${medal.medalKey}.hint`)
                  : t("album.upcomingHint")
                : t("album.noHint")}
            </FactRow>

            {medal.unlockedAt && (
              <FactRow label={t("detail.date")}>{medal.unlockedAt.toLocaleDateString(locale, LONG_DATE)}</FactRow>
            )}

            <FactRow label={t("detail.page")}>
              {isSecretSeries ? t("detail.pageSecret", { series: seriesName }) : seriesName}
            </FactRow>

            <FactRow label={t("detail.rarity")}>{rarityLabel}</FactRow>

            {medal.isCurrentlyValid !== null && (
              <FactRow label={t("detail.state")}>
                {medal.isCurrentlyValid ? t("album.current") : t("album.notCurrent")}
              </FactRow>
            )}

            {!detail.obtainable && <FactRow label={t("album.seriesUpcoming")}>{t("detail.notObtainable")}</FactRow>}

            <FactRow label={t("detail.points")}>{t("detail.pointsValue")}</FactRow>
          </section>

          {/* The comparison figure is not a live stat yet, and is shown switched off rather than
              silently absent, so the collector knows it exists and knows it is not being computed
              from a population too small to mean anything. */}
          <Card
            variant="subtle"
            padding="sm"
            className="mt-[var(--space-5)] flex items-center gap-[var(--space-3)] [border:1px_dashed_var(--border-strong)]"
          >
            <Users className="text-text-muted size-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-text-secondary m-0 [font-size:var(--text-body)] font-semibold">
                {t("detail.soonTitle")}
              </p>
              <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("detail.soonCaption")}</p>
            </div>
          </Card>

          <SectionTitleWithAccent as="h2" className="mt-[var(--space-6)] mb-[var(--space-3)]">
            {t("detail.nextTitle")}
          </SectionTitleWithAccent>
          {detail.nextInSeries ? (
            // Capped only from `sm` up, where the grid is a single stretching track. Below it the
            // grid is still two columns, and capping the wrapper would squeeze the one card into
            // half of 240px.
            <div className="sm:max-w-[240px]">
              <MedalGrid entries={[detail.nextInSeries]} size="md" />
            </div>
          ) : (
            <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("detail.nextEmpty")}</p>
          )}
        </div>
      </div>
    </>
  );
}
