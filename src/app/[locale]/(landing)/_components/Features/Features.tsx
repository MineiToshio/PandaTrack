import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import Section from "../Section";
import FeaturesGrid from "./FeaturesGrid";

export default function Features() {
  const t = useTranslations("landing.features");

  return (
    <Section
      id="features"
      headingId="features-heading"
      eyebrow={t("eyebrow")}
      eyebrowIcon={<LayoutGrid aria-hidden="true" />}
      title={t("title")}
      subtitle={t("subtitle")}
      tinted
    >
      <FeaturesGrid />
    </Section>
  );
}
