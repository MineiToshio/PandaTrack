import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";
import { getProgressionVisibility } from "@/lib/data/progression/progressionQueries";
import ProgressTabs from "./_components/ProgressTabs";
import { PROGRESS_PANEL_ID } from "./_utils/progressTabs";

type ProgressSectionLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Section shell for `Progreso`: the three-tab subnav and the visibility gate every page under it
 * inherits.
 *
 * The gate lives here rather than on each page so a route added later cannot forget it. It is a
 * server-side `notFound()`, not a hidden nav entry: a collector who switched the layer off must not
 * be able to reach the section by bookmark or by typing the URL (`FR-12-38`, `AC-12-13`).
 */
export default async function ProgressSectionLayout({ children, params }: ProgressSectionLayoutProps) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/${locale}${ROUTES.signIn}`);
  }

  const { hideProgression } = await getProgressionVisibility(session.user.id);
  if (hideProgression) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "progress" });

  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      <ProgressTabs
        locale={locale}
        ariaLabel={t("section.tabsAriaLabel")}
        labels={{
          summary: t("section.tabSummary"),
          medals: t("section.tabMedals"),
          ranks: t("section.tabRanks"),
        }}
      />
      {/* The region the bar's `aria-controls` names. One element for all three tabs, because each
          tab is a route: only the selected panel is ever in the document. */}
      <div id={PROGRESS_PANEL_ID} role="tabpanel">
        {children}
      </div>
    </div>
  );
}
