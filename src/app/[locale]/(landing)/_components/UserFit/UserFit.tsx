import { useTranslations } from "next-intl";
import { PackageSearch, Truck, Wallet } from "lucide-react";
import Section from "@/app/[locale]/(landing)/_components/Section";
import ProblemCard from "@/app/[locale]/(landing)/_components/UserFit/ProblemCard";

export default function UserFit() {
  const t = useTranslations("landing.userFit");

  return (
    <Section
      sectionId="user-fit"
      ariaLabelledby="user-fit-heading"
      title={t("title")}
      subtitle={t("subtitle")}
      headingId="user-fit-heading"
      className="border-border border-b"
    >
      <div className="grid gap-6 md:grid-cols-3">
        <ProblemCard
          index="01"
          icon={<PackageSearch className="h-6 w-6" strokeWidth={2} />}
          accentClassName="bg-primary"
          hoverBorderClassName="hover:border-primary/40"
          hoverTitleClassName="group-hover:text-primary"
          title={t("cards.card1.title")}
          description={t("cards.card1.description")}
        />
        <ProblemCard
          index="02"
          icon={<Truck className="h-6 w-6" strokeWidth={2} />}
          accentClassName="bg-secondary"
          hoverBorderClassName="hover:border-secondary/40"
          hoverTitleClassName="group-hover:text-secondary"
          title={t("cards.card2.title")}
          description={t("cards.card2.description")}
        />
        <ProblemCard
          index="03"
          icon={<Wallet className="h-6 w-6" strokeWidth={2} />}
          accentClassName="bg-accent"
          hoverBorderClassName="hover:border-accent/40"
          hoverTitleClassName="group-hover:text-accent"
          title={t("cards.card3.title")}
          description={t("cards.card3.description")}
        />
      </div>
    </Section>
  );
}
