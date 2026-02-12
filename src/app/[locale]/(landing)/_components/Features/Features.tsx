import Section from "@/app/[locale]/(landing)/_components/Section";
import FeaturesGrid from "./FeaturesGrid";
import { useTranslations } from "next-intl";

export default function FeaturesSection() {
  const t = useTranslations("landing.features");
  return (
    <Section
      ariaLabelledby="features-heading"
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle")}
      headingId="features-heading"
      className="relative"
      background={
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background: "radial-gradient(ellipse 70% 50% at 50% 0%, var(--muted) 0%, transparent 55%)",
          }}
          aria-hidden
        />
      }
    >
      <FeaturesGrid />
    </Section>
  );
}
