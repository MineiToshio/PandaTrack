import { ArrowRight, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";

/** Full-width gradient CTA band (`.mk-banner-section`) → sign-up. */
export default function Banner() {
  const locale = useLocale();
  const t = useTranslations("landing.banner");
  const signUpHref = `/${locale}${ROUTES.signUp}`;

  return (
    <section className="mk-section mk-banner-section" aria-labelledby="banner-heading">
      <div className="mk-container">
        <div className="mk-banner-inner">
          <span className="mk-eyebrow">
            <Sparkles aria-hidden="true" /> {t("eyebrow")}
          </span>
          <h2 id="banner-heading">{t("title")}</h2>
          <p>{t("subtitle")}</p>
          <Button
            as="a"
            href={signUpHref}
            variant="primary"
            size="lg"
            className="mt-8"
            leadingIcon={<ArrowRight className="size-[18px]" aria-hidden="true" />}
            posthogEvent={POSTHOG_EVENTS.LANDING.BANNER_CTA_CLICKED}
            posthogProps={{ location: "banner", destination: "sign-up" }}
          >
            {t("cta")}
          </Button>
        </div>
      </div>
    </section>
  );
}
