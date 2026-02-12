import FeatureCard from "./FeatureCard";
import { BadgeDollarSign, ShoppingBag, Store, Truck } from "lucide-react";

const FEATURES = [
  {
    title: "Tiendas confiables",
    description:
      "Descubre tiendas según tu tipo de colección y guarda tus favoritas en un solo lugar. Revisa referencias y feedback para comprar con más seguridad.",
    bullets: ["Descubre por categoría", "Reviews de la comunidad"] as [string, string],
    icon: <Store className="h-6 w-6" aria-hidden />,
    accentClassName: "text-primary",
    titleBarClassName: "bg-primary",
    hoverAccentClassName: "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20",
  },
  {
    title: "Compras ordenadas",
    description:
      "Registra cada compra con tienda, items, fechas y notas sin complicarte. Mantén un historial limpio para saber qué compraste y cuándo.",
    bullets: ["Items por compra", "Estados y fechas"] as [string, string],
    icon: <ShoppingBag className="h-6 w-6" aria-hidden />,
    accentClassName: "text-info",
    titleBarClassName: "bg-info",
    hoverAccentClassName: "hover:border-info/50 hover:shadow-lg hover:shadow-info/20",
  },
  {
    title: "Preventas sin sorpresas",
    description:
      "Lleva el control de adelantos y saldos sin perderte entre pagos parciales. Visualiza cuánto falta pagar y qué montos vienen por mes.",
    bullets: ["Depósitos y saldo", "Pagos por mes"] as [string, string],
    icon: <BadgeDollarSign className="h-6 w-6" aria-hidden />,
    accentClassName: "text-secondary",
    titleBarClassName: "bg-secondary",
    hoverAccentClassName: "hover:border-secondary/50 hover:shadow-lg hover:shadow-secondary/20",
  },
  {
    title: "Envíos bajo control",
    description:
      "Sigue envíos aunque un pedido salga en partes o en diferentes fechas. Ve qué está en espera, qué se envió y qué fue entregado.",
    bullets: ["Múltiples envíos", "En ruta y entregado"] as [string, string],
    icon: <Truck className="h-6 w-6" aria-hidden />,
    accentClassName: "text-accent",
    titleBarClassName: "bg-accent",
    hoverAccentClassName: "hover:border-accent/50 hover:shadow-lg hover:shadow-accent/20",
  },
] as const;

export default function FeaturesGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
      {FEATURES.map((feature, index) => (
        <FeatureCard
          key={index}
          icon={feature.icon}
          title={feature.title}
          description={feature.description}
          bullets={feature.bullets}
          accentClassName={feature.accentClassName}
          titleBarClassName={feature.titleBarClassName}
          hoverAccentClassName={feature.hoverAccentClassName}
        />
      ))}
    </div>
  );
}
