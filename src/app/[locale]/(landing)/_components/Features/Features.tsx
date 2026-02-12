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
      className="relative overflow-hidden"
      background={
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 0%, var(--muted) 0%, transparent 60%)",
          }}
          aria-hidden
        />
      }
    >
      <FeaturesGrid />
    </Section>
  );
}
