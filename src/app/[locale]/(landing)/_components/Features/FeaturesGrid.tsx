import { BadgeDollarSign, Bell, LineChart, ShoppingBag, Store, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import FeatureCard from "./FeatureCard";

/** Six MVP capabilities; icon-tile accent per card (matches the S11 demo). */
const FEATURES = [
  { key: "stores", tile: "var(--accent)", Icon: Store },
  { key: "orders", tile: "var(--accent-cool)", Icon: ShoppingBag },
  { key: "preorders", tile: "var(--success)", Icon: BadgeDollarSign },
  { key: "deliveries", tile: "var(--accent-warm)", Icon: Truck },
  { key: "reminders", tile: "var(--info)", Icon: Bell },
  { key: "dashboard", tile: "var(--accent)", Icon: LineChart },
] as const;

export default function FeaturesGrid() {
  const t = useTranslations("landing.features.cards");

  return (
    <div className="mk-feature-grid">
      {FEATURES.map(({ key, tile, Icon }) => (
        <FeatureCard
          key={key}
          tile={tile}
          icon={<Icon aria-hidden="true" />}
          title={t(`${key}.title`)}
          description={t(`${key}.description`)}
        />
      ))}
    </div>
  );
}
