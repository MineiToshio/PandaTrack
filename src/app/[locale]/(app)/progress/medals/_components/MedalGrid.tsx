import { useLocale, useTranslations } from "next-intl";
import { resolveMedalArtSrc } from "@/components/core/MedalStage";
import MedalCard from "@/components/modules/MedalCard";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { MedalAlbumEntry } from "@/lib/data/progression/medalQueries";

export type MedalGridProps = {
  entries: readonly MedalAlbumEntry[];
  /** `md` for the compact preview row on the detail view, `lg` for the album's own pages. */
  size?: "md" | "lg";
};

/** How much of a medal a collector may see, given whether they hold it and whether it is secret. */
export function isMedalRevealed(entry: MedalAlbumEntry): boolean {
  return entry.unlocked || !entry.secret;
}

/**
 * The album's grid of medals, and the same grid the detail view reuses for its preview row.
 *
 * The column count comes from a minimum card width rather than from a breakpoint, so the album
 * reflows continuously instead of snapping between two hand-picked layouts.
 *
 * Copy is resolved here rather than passed down because there are three genuinely different
 * readings of the same row: a medal the collector holds states its condition in the past, a locked
 * one states it as an instruction, and a locked secret one states nothing at all (`FR-12-25`).
 */
export default function MedalGrid({ entries, size = "lg" }: MedalGridProps) {
  const t = useTranslations("progress");
  const locale = useLocale();

  return (
    <ul
      className={cn(
        "grid list-none grid-cols-2 gap-[var(--space-4)] p-0",
        // `auto-fill` in the album, where the empty slot at the end of a short series is the album's
        // own rhythm and every page has to draw its pieces at the same size. `auto-fit` in the
        // showcase and the "next in this series" preview, which carry a fixed handful of medals:
        // there `auto-fill` kept laying out tracks for cards that are not there, leaving a couple of
        // hundred pixels of dead grid beside the last one.
        size === "lg"
          ? "sm:[grid-template-columns:repeat(auto-fill,minmax(216px,1fr))]"
          : "sm:[grid-template-columns:repeat(auto-fit,minmax(168px,1fr))]",
      )}
    >
      {entries.map((entry) => {
        const revealed = isMedalRevealed(entry);
        const name = t(`medals.${entry.medalKey}.name`);
        const rarityLabel = t(`rarity.${entry.rarity}`);
        const locked = !entry.unlocked;

        // An unshipped piece is not "locked": it is a promise. Saying "how to get it" about something
        // this build cannot award would be an instruction the collector cannot follow. No medal is
        // in that state today; the branch is what keeps it true if one ever is.
        const statusLabel = !entry.shipped
          ? t("album.seriesUpcoming")
          : entry.isCurrentlyValid === false
            ? t("album.notCurrent")
            : null;

        return (
          <li key={entry.medalKey} className="flex">
            <MedalCard
              className="w-full"
              medalKey={entry.medalKey}
              grade={entry.rarity}
              size={size}
              locked={locked}
              imageSrc={resolveMedalArtSrc(entry.imageKey)}
              title={revealed ? name : t("album.lockedTitle")}
              artLabel={
                revealed
                  ? t("detail.artLabel", { name, rarity: rarityLabel })
                  : t("detail.lockedArtLabel", { rarity: rarityLabel })
              }
              hintLabel={locked && entry.shipped ? t("album.hintLabel") : null}
              description={
                revealed
                  ? entry.shipped
                    ? t(`medals.${entry.medalKey}.hint`)
                    : t("album.upcomingHint")
                  : t("album.noHint")
              }
              rarityLabel={rarityLabel}
              unlockedOn={entry.unlockedAt ? entry.unlockedAt.toLocaleDateString(locale, DATE_SHAPE) : null}
              statusLabel={statusLabel}
              href={`/${locale}${ROUTES.progressMedals}/${entry.medalKey}`}
              linkLabel={revealed ? t("album.openDetail", { name }) : t("album.openLockedDetail")}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** `unlockedAt` is a real instant, not a civil day, so it renders in the viewer's own time. */
const DATE_SHAPE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
