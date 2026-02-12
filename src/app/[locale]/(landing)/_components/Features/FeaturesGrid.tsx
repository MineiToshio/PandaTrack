import FeatureCard from "./FeatureCard";
import { useTranslations } from "next-intl";
import { BadgeDollarSign, ShoppingBag, Store, Truck } from "lucide-react";

const FEATURES_CONFIG = [
  {
    key: "stores",
    icon: <Store className="h-6 w-6" aria-hidden />,
    accentClassName: "text-primary",
    titleBarClassName: "bg-primary",
    hoverAccentClassName: "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20",
  },
  {
    key: "purchases",
    icon: <ShoppingBag className="h-6 w-6" aria-hidden />,
    accentClassName: "text-info",
    titleBarClassName: "bg-info",
    hoverAccentClassName: "hover:border-info/50 hover:shadow-lg hover:shadow-info/20",
  },
  {
    key: "preorders",
    icon: <BadgeDollarSign className="h-6 w-6" aria-hidden />,
    accentClassName: "text-secondary",
    titleBarClassName: "bg-secondary",
    hoverAccentClassName: "hover:border-secondary/50 hover:shadow-lg hover:shadow-secondary/20",
  },
  {
    key: "shipments",
    icon: <Truck className="h-6 w-6" aria-hidden />,
    accentClassName: "text-accent",
    titleBarClassName: "bg-accent",
    hoverAccentClassName: "hover:border-accent/50 hover:shadow-lg hover:shadow-accent/20",
  },
] as const;

export default function FeaturesGrid() {
  const t = useTranslations("landing.features.cards");
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
      {FEATURES_CONFIG.map((feature, index) => (
        <FeatureCard
          key={feature.key}
          icon={feature.icon}
          title={t(`${feature.key}.title`)}
          description={t(`${feature.key}.description`)}
          bullets={[t(`${feature.key}.bullets.0`), t(`${feature.key}.bullets.1`)]}
          accentClassName={feature.accentClassName}
          titleBarClassName={feature.titleBarClassName}
          hoverAccentClassName={feature.hoverAccentClassName}
        />
      ))}
    </div>
  );
}
