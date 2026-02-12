import FeatureCard from "./FeatureCard";
import { useTranslations } from "next-intl";
import { BadgeDollarSign, Bell, ShoppingBag, Store, Truck } from "lucide-react";

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
  {
    key: "reminders",
    icon: <Bell className="h-6 w-6" aria-hidden />,
    accentClassName: "text-highlight",
    titleBarClassName: "bg-highlight",
    hoverAccentClassName: "hover:border-highlight/50 hover:shadow-lg hover:shadow-highlight/20",
  },
] as const;

const REMINDERS_INDEX = 4;

export default function FeaturesGrid() {
  const tCards = useTranslations("landing.features.cards");
  const tReminders = useTranslations("landing.features.reminders");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
      {FEATURES_CONFIG.map((feature, index) => {
        const isReminders = feature.key === "reminders";
        const title = isReminders ? tReminders("heading") : tCards(`${feature.key}.title`);
        const description = isReminders ? tReminders("description") : tCards(`${feature.key}.description`);
        const bullets: [string, string] = isReminders
          ? [tReminders("chips.0"), tReminders("chips.1")]
          : [tCards(`${feature.key}.bullets.0`), tCards(`${feature.key}.bullets.1`)];

        const card = (
          <FeatureCard
            key={feature.key}
            icon={feature.icon}
            title={title}
            description={description}
            bullets={bullets}
            accentClassName={feature.accentClassName}
            titleBarClassName={feature.titleBarClassName}
            hoverAccentClassName={feature.hoverAccentClassName}
          />
        );

        if (index === REMINDERS_INDEX) {
          return (
            <div key={feature.key} className="w-full lg:col-span-2 lg:flex lg:justify-center">
              <div className="w-full lg:max-w-[calc((100%-1.5rem)/2)]">{card}</div>
            </div>
          );
        }

        return card;
      })}
    </div>
  );
}
