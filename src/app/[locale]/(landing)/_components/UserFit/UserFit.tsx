import { useTranslations } from "next-intl";
import { PackageSearch, Truck, Wallet } from "lucide-react";
import FeatureCard from "@/app/[locale]/(landing)/_components/UserFit/FeatureCard";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

export default function UserFit() {
  const t = useTranslations("landing.userFit");

  return (
    <section id="user-fit" className="bg-background text-foreground border-border w-full border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="flex flex-col items-center gap-4 text-center">
          <Heading as="h2" size="md" className="text-text-title">
            {t("title")}
          </Heading>
          <Typography size="md" className="text-text-body max-w-2xl">
            {t("subtitle")}
          </Typography>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            index="01"
            icon={<PackageSearch className="h-6 w-6" strokeWidth={2} />}
            accentClassName="bg-primary"
            hoverBorderClassName="hover:border-primary/40"
            hoverTitleClassName="group-hover:text-primary"
            title={t("cards.card1.title")}
            description={t("cards.card1.description")}
          />
          <FeatureCard
            index="02"
            icon={<Truck className="h-6 w-6" strokeWidth={2} />}
            accentClassName="bg-secondary"
            hoverBorderClassName="hover:border-secondary/40"
            hoverTitleClassName="group-hover:text-secondary"
            title={t("cards.card2.title")}
            description={t("cards.card2.description")}
          />
          <FeatureCard
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
