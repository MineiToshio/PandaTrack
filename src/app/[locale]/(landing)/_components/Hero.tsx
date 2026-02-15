import AnchorLink from "@/components/core/AnchorLink";
import { useTranslations } from "next-intl";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";

const ANIMATION_DURATION_MS = 600;
const STAGGER_MS = 80;

export default function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section id="get-started" className="bg-background text-foreground relative w-full overflow-hidden">
      <div
        className="bg-primary/25 pointer-events-none absolute top-1/4 -left-1/4 size-[480px] rounded-full opacity-40 blur-[120px]"
        style={{
          animation: `hero-glow-pulse 8s ease-in-out infinite`,
        }}
        aria-hidden
      />
      <div
        className="bg-highlight/20 pointer-events-none absolute top-1/2 -right-1/4 size-[400px] rounded-full opacity-40 blur-[100px]"
        style={{
          animation: `hero-glow-pulse 10s ease-in-out infinite 1s`,
        }}
        aria-hidden
      />
      <div
        className="bg-accent/15 pointer-events-none absolute bottom-1/4 left-1/3 size-[320px] rounded-full opacity-40 blur-[80px]"
        style={{
          animation: `hero-glow-pulse 9s ease-in-out infinite 0.5s`,
        }}
        aria-hidden
      />
      <div
        className="from-primary/8 via-primary/3 pointer-events-none absolute inset-0 bg-linear-to-b to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-6 md:py-24 lg:px-8">
        <div className="flex flex-col gap-6">
          <span
            className="bg-primary/35 text-primary-foreground ring-primary/40 w-fit rounded-full px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase ring-1"
            style={{
              animation: `hero-fade-in-up ${ANIMATION_DURATION_MS}ms ease-out both`,
              animationDelay: "0ms",
            }}
          >
            {t("eyebrow")}
          </span>
          <Heading
            as="h1"
            size="lg"
            className="text-text-title"
            style={{
              animation: `hero-fade-in-up ${ANIMATION_DURATION_MS}ms ease-out both`,
              animationDelay: `${STAGGER_MS}ms`,
            }}
          >
            <span className="from-primary via-highlight to-info bg-linear-to-r bg-clip-text text-transparent">
              {t("title")}
            </span>
          </Heading>
          <Typography
            size="lg"
            className="text-text-body max-w-xl"
            style={{
              animation: `hero-fade-in-up ${ANIMATION_DURATION_MS}ms ease-out both`,
              animationDelay: `${STAGGER_MS * 2}ms`,
            }}
          >
            {t("subtitle")}
          </Typography>
          <div
            className="flex flex-wrap items-center gap-3"
            style={{
              animation: `hero-fade-in-up ${ANIMATION_DURATION_MS}ms ease-out both`,
              animationDelay: `${STAGGER_MS * 3}ms`,
            }}
          >
            <AnchorLink
              href="#waitlist"
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "animate-[hero-cta-glow_2.5s_ease-in-out_infinite]",
              )}
              posthogEvent={POSTHOG_EVENTS.LANDING.HERO_CTA_CLICKED}
              posthogProps={{ location: "hero", cta_type: "primary" }}
            >
              {t("primaryCta")}
            </AnchorLink>
            <AnchorLink href="#features" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              {t("secondaryCta")}
            </AnchorLink>
          </div>
        </div>

        <div
          className="relative"
          style={{
            animation: `hero-fade-in-up ${ANIMATION_DURATION_MS}ms ease-out both`,
            animationDelay: `${STAGGER_MS * 2}ms`,
          }}
        >
          <div
            className="bg-primary/20 pointer-events-none absolute -inset-4 rounded-[28px] blur-2xl"
            style={{ animation: "hero-glow-pulse 6s ease-in-out infinite" }}
            aria-hidden
          />
          <div
            className="border-border bg-surface shadow-primary/10 relative overflow-hidden rounded-3xl border p-8 shadow-xl"
            style={{
              animation: "hero-float 5s ease-in-out infinite",
            }}
          >
            <div className="bg-surface-2 border-border ring-primary/20 flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center ring-1">
              <div className="text-text-title text-xl font-semibold">{t("image.title")}</div>
              <div className="text-text-muted max-w-sm text-sm">{t("image.description")}</div>
              <div className="text-text-muted text-xs">{t("image.placeholder")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
