import Link from "next/link";
import { useTranslations } from "next-intl";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { buttonVariants } from "@/components/core/Button";
import { cn } from "@/lib/styles";

export default function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section id="get-started" className="bg-background text-foreground border-border w-full border-b">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="flex flex-col gap-6">
          <span className="text-primary bg-primary/10 w-fit rounded-full px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase">
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
          <div className="from-primary/15 via-accent/10 to-secondary/15 absolute -inset-6 rounded-[32px] bg-linear-to-br blur-2xl" />
          <div className="border-border bg-surface relative overflow-hidden rounded-3xl border p-8 shadow-2xl">
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
