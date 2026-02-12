"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { buttonVariants } from "@/components/core/Button";
import { cn } from "@/lib/styles";

const BANNER_CTA_ANIMATION = "banner-cta-subtle 3s ease-in-out infinite";

export default function Banner() {
  const t = useTranslations("landing.banner");

  return (
    <section
      id="waitlist-banner"
      aria-labelledby="banner-heading"
      className="bg-surface text-foreground relative w-full px-4 py-16 md:px-6 md:py-24 lg:px-8"
    >
      <div
        className="from-primary/15 via-primary/8 pointer-events-none absolute inset-0 bg-linear-to-b to-transparent opacity-90"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Heading
            as="h2"
            id="banner-heading"
            size="md"
            className="text-text-title text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
          >
            {t("title")}
          </Heading>
          <Typography size="md" className="text-text-body mt-4 leading-relaxed md:text-lg">
            {t("subtitle")}
          </Typography>
          <div className="mt-8 flex justify-center">
            <Link
              href="#waitlist"
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "transition-transform duration-300 ease-out hover:scale-[1.02]",
              )}
              style={{ animation: BANNER_CTA_ANIMATION }}
            >
              {t("cta")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
