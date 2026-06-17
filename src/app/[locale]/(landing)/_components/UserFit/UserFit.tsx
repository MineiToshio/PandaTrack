import { Layers, Target, Truck, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import Section from "../Section";
import ProblemCard from "./ProblemCard";

export default function UserFit() {
  const t = useTranslations("landing.userFit");

  return (
    <Section
      id="user-fit"
      headingId="user-fit-heading"
      eyebrow={t("eyebrow")}
      eyebrowIcon={<Target aria-hidden="true" />}
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="mk-fit-grid">
        <ProblemCard
          index="01"
          tile="var(--accent)"
          icon={<Layers aria-hidden="true" />}
          title={t("cards.card1.title")}
          description={t("cards.card1.description")}
        />
        <ProblemCard
          index="02"
          tile="var(--accent-warm)"
          icon={<Wallet aria-hidden="true" />}
          title={t("cards.card2.title")}
          description={t("cards.card2.description")}
        />
        <ProblemCard
          index="03"
          tile="var(--accent-cool)"
          icon={<Truck aria-hidden="true" />}
          title={t("cards.card3.title")}
          description={t("cards.card3.description")}
        />
      </div>
    </Section>
  );
}
