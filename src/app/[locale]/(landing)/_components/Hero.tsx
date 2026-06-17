import type { CSSProperties } from "react";
import { BookOpen, LayoutDashboard, Package, Sparkles, Store, Truck, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import AnchorLink from "@/components/core/AnchorLink";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Chip from "@/components/core/Chip";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";

/** Journey stations: hero object travels store → order → payment → delivery. */
const JOURNEY_STEPS = [
  { key: "store", tile: "var(--accent-cool)", Icon: Store },
  { key: "order", tile: "var(--accent)", Icon: Package },
  { key: "payment", tile: "var(--accent-warm)", Icon: Wallet },
  { key: "delivery", tile: "var(--success)", Icon: Truck },
] as const;

/** Illustrative sample figures for the decorative product window (aria-hidden). */
const DEMO_STATS: { key: string; value: string; accent?: string }[] = [
  { key: "spent", value: "$486" },
  { key: "pending", value: "$152", accent: "var(--warning)" },
  { key: "incoming", value: "3" },
];

export default function Hero() {
  const locale = useLocale();
  const t = useTranslations("landing.hero");
  const tDemo = useTranslations("landing.hero.demo");

  const signUpHref = `/${locale}${ROUTES.signUp}`;

  return (
    <section className="mk-hero">
      <div className="mk-hero-glow" aria-hidden="true" />
      <div className="mk-container">
        <div className="mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-eyebrow">
              <Sparkles aria-hidden="true" /> {t("eyebrow")}
            </span>
            <h1>{t.rich("title", { hl: (chunks) => <span className="mk-grad-text">{chunks}</span> })}</h1>
            <p className="mk-hero-sub">{t("subtitle")}</p>
            <div className="mk-hero-cta">
              <Button
                as="a"
                href={signUpHref}
                variant="primary"
                size="lg"
                leadingIcon={<Sparkles className="size-[18px]" aria-hidden="true" />}
                posthogEvent={POSTHOG_EVENTS.LANDING.HERO_CTA_CLICKED}
                posthogProps={{ location: "hero", destination: "sign-up" }}
              >
                {t("ctaPrimary")}
              </Button>
              <AnchorLink href="#features" className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>
                {t("ctaSecondary")}
              </AnchorLink>
            </div>
            <p className="mk-hero-trust">
              <span className="dot" aria-hidden="true" /> {t("trust")}
            </p>
          </div>

          <div className="mk-hero-visual">
            <div className="mk-window mk-window-anim" role="img" aria-label={tDemo("windowLabel")}>
              <div className="mk-window-bar" aria-hidden="true">
                <span className="mk-window-dot" />
                <span className="mk-window-dot" />
                <span className="mk-window-dot" />
              </div>

              <div className="mk-journey" aria-hidden="true">
                <span className="mk-journey-cap">{tDemo("caption")}</span>
                <div className="mk-journey-rail">
                  <div className="mk-journey-line" />
                  <div className="mk-journey-token">
                    <BookOpen />
                  </div>
                </div>
                <div className="mk-journey-steps">
                  {JOURNEY_STEPS.map(({ key, tile, Icon }, index) => (
                    <div
                      key={key}
                      className="mk-journey-step"
                      style={{ "--s": index, "--tile": tile } as CSSProperties}
                    >
                      <span className="mk-journey-tile">
                        <Icon />
                      </span>
                      <span className="jl">{tDemo(`steps.${key}`)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mk-window-body" aria-hidden="true">
                <div className="mk-dash-head">
                  <span className="mk-eyebrow-plain">{tDemo("panelTitle")}</span>
                  <span className="mk-dash-badge">
                    <LayoutDashboard /> {tDemo("panelBadge")}
                  </span>
                </div>
                <div className="mk-mini-stat">
                  {DEMO_STATS.map(({ key, value, accent }) => (
                    <div key={key}>
                      <div className="lbl">{tDemo(`stats.${key}`)}</div>
                      <div className="val numeric" style={accent ? { color: accent } : undefined}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mk-mini-row">
                  <span
                    className="mk-mini-ava"
                    style={{
                      background: "color-mix(in oklch, var(--accent) 14%, transparent)",
                      color: "var(--accent)",
                    }}
                  >
                    <Package className="size-4" />
                  </span>
                  <span className="body">
                    <strong>{tDemo("item1.title")}</strong>
                    <small>{tDemo("item1.store")}</small>
                  </span>
                  <Chip variant="warning" size="sm" className="ml-auto shrink-0" icon={<Wallet className="size-3" />}>
                    {tDemo("item1.chip")}
                  </Chip>
                </div>
                <div className="mk-mini-row">
                  <span
                    className="mk-mini-ava"
                    style={{
                      background: "color-mix(in oklch, var(--accent-warm) 16%, transparent)",
                      color: "var(--accent-warm)",
                    }}
                  >
                    <BookOpen className="size-4" />
                  </span>
                  <span className="body">
                    <strong>{tDemo("item2.title")}</strong>
                    <small>{tDemo("item2.store")}</small>
                  </span>
                  <Chip variant="info" size="sm" className="ml-auto shrink-0" icon={<Truck className="size-3" />}>
                    {tDemo("item2.chip")}
                  </Chip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
