import { useTranslations } from "next-intl";
import { PackageSearch, Truck, Wallet } from "lucide-react";
import ProblemCard from "@/app/[locale]/(landing)/_components/UserFit/ProblemCard";
import SectionHeader from "@/app/[locale]/(landing)/_components/SectionHeader";

export default function UserFit() {
  const t = useTranslations("landing.userFit");

  return (
    <section
      id="user-fit"
      className="bg-background text-foreground border-border w-full border-b"
      aria-labelledby="user-fit-heading"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-16">
        <SectionHeader
          id="user-fit-heading"
          title={t("title")}
          subtitle={t("subtitle")}
          className="mb-12 md:mb-16"
        />
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
      </div>
    </section>
  );
}
