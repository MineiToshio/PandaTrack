import { getTranslations } from "next-intl/server";
import DashboardLoadingSkeleton from "./_components/DashboardLoadingSkeleton";

type DashboardLoadingProps = { params?: Promise<{ locale: string }> };

/**
 * Dashboard loading boundary. The page loads every order the collector owns in one aggregation
 * pass, so it renders a structure-matching skeleton while that server work resolves (ADR 0013).
 */
export default async function DashboardLoading({ params }: DashboardLoadingProps) {
  // `loading.tsx` doesn't receive params reliably in Next 15+ — fall back to `es` if absent.
  const resolved = params ? await params : { locale: "es" };
  const t = await getTranslations({ locale: resolved.locale, namespace: "components" });
  return <DashboardLoadingSkeleton label={t("skeleton.loading")} />;
}
