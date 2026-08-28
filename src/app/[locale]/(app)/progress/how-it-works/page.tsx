import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import BackNavLink from "@/components/core/BackNavLink";
import Card from "@/components/core/Card";
import Eyebrow from "@/components/core/Eyebrow";
import { getSession } from "@/lib/auth/auth-server";
import { ROUTES } from "@/lib/constants";
import HowItWorksGuide, { type HowItWorksBlock } from "./_components/HowItWorksGuide";
import HowItWorksViewedCapture from "./_components/HowItWorksViewedCapture";
import { HOW_IT_WORKS_BLOCK_KEYS } from "./_utils/howItWorksBlocks";

type HowItWorksPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: HowItWorksPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "progress" });
  return { title: t("meta.howItWorksTitle"), robots: { index: false, follow: false } };
}

/**
 * The rules of the progression, in plain copy: a subview of `Resumen`, never a fourth tab.
 *
 * A tab would give the rulebook the same standing as the medals and the ladder, and it is read
 * once. It is reached instead from a quiet link beside the honesty line on `Resumen`, and it lives
 * one level under the section so the tab bar above keeps `Resumen` marked while it is open, exactly
 * as the medal detail keeps `Medallas` marked.
 *
 * What it publishes is the RULE and the reason for it, never the price list: no point value, no cap
 * figure, no anti-split threshold and no secret medal condition. That boundary is the owner's
 * decision about transparency versus abuse, and it is guarded by a test rather than by memory.
 *
 * No data is loaded. The page is the same for every collector, so it reads only the session the
 * section layout already requires and its own copy.
 */
export default async function ProgressHowItWorksPage({ params }: HowItWorksPageProps) {
  const { locale } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/${locale}${ROUTES.signIn}`);
  }

  const t = await getTranslations({ locale, namespace: "progress" });

  const blocks: HowItWorksBlock[] = HOW_IT_WORKS_BLOCK_KEYS.map((key) => ({
    key,
    title: t(`howItWorks.blocks.${key}.title`),
    body: t(`howItWorks.blocks.${key}.body`),
    why: t(`howItWorks.blocks.${key}.why`),
  }));

  return (
    <>
      <SetHeaderTitle title={t("section.howItWorks")} />
      <HowItWorksViewedCapture />

      <div>
        <BackNavLink href={`/${locale}${ROUTES.progress}`}>{t("howItWorks.back")}</BackNavLink>
      </div>

      <header className="flex flex-col gap-[var(--space-2)]">
        <Eyebrow as="p">{t("howItWorks.eyebrow")}</Eyebrow>
        <h1 className="text-text-title m-0 [font-family:var(--font-display)] [font-size:var(--text-title)] [line-height:var(--text-title--line-height)] [font-weight:var(--font-weight-title)] [letter-spacing:var(--text-title--letter-spacing)]">
          {t("howItWorks.title")}
        </h1>
        <p className="text-text-secondary m-0 max-w-[64ch] [font-size:var(--text-body)]">{t("howItWorks.lead")}</p>
      </header>

      <HowItWorksGuide blocks={blocks} />

      {/* Same sunken treatment the Resumen and the medal detail use for "this exists and is off",
          so the collector reads one visual pattern for it instead of three. */}
      <Card
        as="section"
        variant="subtle"
        padding="md"
        className="flex items-start gap-[var(--space-3)] [border:1px_dashed_var(--border-strong)]"
      >
        <Users className="text-text-muted mt-[var(--space-1)] size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <Eyebrow as="h2">{t("howItWorks.closingTitle")}</Eyebrow>
          <p className="text-text-muted m-0 [font-size:var(--text-caption)]">{t("howItWorks.closingBody")}</p>
        </div>
      </Card>
    </>
  );
}
