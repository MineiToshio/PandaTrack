import SectionHeader from "@/app/[locale]/(landing)/_components/SectionHeader";
import ComingSoonBlock from "./ComingSoonBlock";
import FeaturesGrid from "./FeaturesGrid";
import RemindersBand from "./RemindersBand";

export default function FeaturesSection() {
  return (
    <section
      className="bg-background relative overflow-hidden px-4 py-16 md:px-6 md:py-24 lg:px-8"
      aria-labelledby="features-heading"
    >
      {/* Gradiente sutil con tokens del tema */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, var(--muted) 0%, transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl">
        <SectionHeader
          id="features-heading"
          title="Todo tu coleccionismo, en un solo sistema"
          subtitle="Descubre tiendas confiables, registra compras, controla preventas y sigue envíos—con un dashboard que te dice qué viene y qué falta pagar."
          className="mb-12 md:mb-16"
        />
        <FeaturesGrid />
        <div className="mt-10 space-y-6 md:mt-14 lg:grid lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8 lg:space-y-0">
          <RemindersBand />
          <ComingSoonBlock />
        </div>
      </div>
    </section>
  );
}
