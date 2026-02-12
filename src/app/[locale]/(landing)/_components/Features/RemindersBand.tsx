import Chip from "@/components/core/Chip";
import IconBox from "@/components/core/IconBox";
import { Bell } from "lucide-react";

export default function RemindersBand() {
  return (
    <section className="border-border bg-card w-full rounded-2xl border p-6 md:p-8" aria-labelledby="reminders-heading">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <IconBox variant="soft" accentClassName="bg-accent/20 text-accent">
          <Bell className="h-6 w-6" aria-hidden />
        </IconBox>
        <div className="min-w-0 flex-1">
          <h3 id="reminders-heading" className="text-text-title text-lg font-semibold md:text-xl">
            Recordatorios y alertas útiles
          </h3>
          <p className="text-text-body mt-2 text-sm leading-relaxed md:text-base">
            Recibe recordatorios para pedir updates y no olvidar preventas largas. Define un presupuesto y recibe
            alertas cuando te estés acercando al límite.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>Recordatorios</Chip>
            <Chip>Presupuesto</Chip>
          </div>
        </div>
      </div>
    </section>
  );
}
