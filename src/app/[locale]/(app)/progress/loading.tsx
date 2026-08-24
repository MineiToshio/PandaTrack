import { getTranslations } from "next-intl/server";
import Skeleton from "@/components/core/Skeleton";

type ProgressLoadingProps = { params?: Promise<{ locale: string }> };

/**
 * Loading boundary for the `Resumen` tab.
 *
 * It mirrors the real layout (hero, the two-card row, the showcase) so the shimmer does not jump
 * when the payload arrives, following the same structure-matching approach the dashboard's own
 * boundary uses. The tab bar itself lives in the layout and is already painted, so it is
 * deliberately absent here.
 */
export default async function ProgressLoading({ params }: ProgressLoadingProps) {
  // `loading.tsx` does not receive params reliably, so the default locale is the fallback.
  const resolved = params ? await params : { locale: "es" };
  const t = await getTranslations({ locale: resolved.locale, namespace: "components" });

  return (
    <div
      className="flex flex-col gap-[var(--space-5)]"
      aria-busy="true"
      aria-live="polite"
      aria-label={t("skeleton.loading")}
    >
      <Skeleton variant="rect" height={180} />
      <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
        <Skeleton variant="rect" height={160} />
        <Skeleton variant="rect" height={160} />
      </div>
      <Skeleton variant="text" width={220} height={22} />
      <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} variant="rect" height={200} />
        ))}
      </div>
    </div>
  );
}
