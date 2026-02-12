import Link from "next/link";
import { useTranslations } from "next-intl";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { buttonVariants } from "@/components/core/Button";
import { cn } from "@/lib/styles";

export default function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section id="get-started" className="bg-background text-foreground relative w-full overflow-hidden">
      <div
        className="from-primary/8 via-primary/3 pointer-events-none absolute inset-0 bg-linear-to-b to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-6 md:py-24 lg:px-8">
        <div className="flex flex-col gap-6">
          <span className="text-primary bg-primary/15 ring-primary/20 w-fit rounded-full px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase ring-1">
            {t("eyebrow")}
          </span>
          <Heading as="h1" size="lg" className="text-text-title">
            {t("title")}
          </Heading>
          <Typography size="lg" className="text-text-body max-w-xl">
            {t("subtitle")}
          </Typography>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="#get-started" className={cn(buttonVariants({ variant: "primary", size: "lg" }))}>
              {t("primaryCta")}
            </Link>
            <Link href="#features" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              {t("secondaryCta")}
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="bg-primary/15 pointer-events-none absolute -inset-4 rounded-[28px] blur-2xl" aria-hidden />
          <div className="border-border bg-surface shadow-primary/5 relative overflow-hidden rounded-3xl border p-8 shadow-xl">
            <div className="bg-surface-2 border-border flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
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
